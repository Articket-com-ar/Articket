import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { pino } from "pino";
import { Counter, Gauge, collectDefaultMetrics, register } from "prom-client";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

const logger = pino().child({ service: "worker", queue: "domain-event-outbox" });
const workerId = `outbox-${randomUUID()}`;

collectDefaultMetrics();

const outboxPendingGauge = new Gauge({
  name: "domain_event_outbox_pending",
  help: "Total de eventos pendientes en DomainEventOutbox"
});

const outboxDispatchedTotal = new Counter({
  name: "domain_event_outbox_dispatched_total",
  help: "Total de eventos outbox despachados"
});

const outboxRetryTotal = new Counter({
  name: "domain_event_outbox_retry_total",
  help: "Total de reintentos outbox por error"
});

type OutboxRow = {
  id: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  correlationId: string | null;
};

let stopping = false;

async function dispatchOutboxEvent(row: OutboxRow) {
  const payload = row.payload as Record<string, unknown> | null;

  // Hook de prueba controlada mientras no hay bus externo
  if (payload?.forceFail === true) {
    throw new Error("forced outbox dispatch failure");
  }

  logger.info(
    {
      outboxId: row.id,
      eventName: row.eventName,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      correlationId: row.correlationId,
      workerId
    },
    "outbox event dispatched"
  );
}

async function syncPendingGauge() {
  const pending = await prisma.domainEventOutbox.count({ where: { dispatchedAt: null } });
  outboxPendingGauge.set(pending);
}

async function claimBatch(limit: number): Promise<OutboxRow[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<OutboxRow[]>`
      SELECT
        id,
        "eventName",
        "aggregateType",
        "aggregateId",
        payload,
        "correlationId"
      FROM "DomainEventOutbox"
      WHERE "dispatchedAt" IS NULL
        AND (
          "lockedAt" IS NULL
          OR "lockedAt" < NOW() - (${env.outboxWorkerLeaseMinutes} * INTERVAL '1 minute')
        )
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;

    if (rows.length === 0) {
      return [];
    }

    const lockAt = new Date();

    for (const row of rows) {
      await tx.domainEventOutbox.update({
        where: { id: row.id },
        data: {
          lockedAt: lockAt,
          lockedBy: workerId
        }
      });
    }

    return rows;
  });
}

async function markDispatched(id: string) {
  await prisma.domainEventOutbox.update({
    where: { id },
    data: {
      dispatchedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null
    }
  });

  outboxDispatchedTotal.inc();
}

async function markRetry(id: string, error: unknown) {
  const message = String((error as Error | undefined)?.message ?? "unknown outbox dispatch error").slice(0, 500);

  await prisma.domainEventOutbox.update({
    where: { id },
    data: {
      retryCount: { increment: 1 },
      lastError: message,
      lockedAt: null,
      lockedBy: null
    }
  });

  outboxRetryTotal.inc();
}

async function processBatch(limit: number): Promise<{ processed: number; failed: number }> {
  const rows = await claimBatch(limit);
  if (rows.length === 0) {
    await syncPendingGauge();
    return { processed: 0, failed: 0 };
  }

  let failed = 0;

  for (const row of rows) {
    try {
      await dispatchOutboxEvent(row);
      await markDispatched(row.id);
    } catch (error) {
      failed += 1;
      await markRetry(row.id, error);

      logger.error(
        {
          err: error,
          outboxId: row.id,
          eventName: row.eventName,
          correlationId: row.correlationId,
          workerId
        },
        "outbox dispatch failed"
      );
    }
  }

  await syncPendingGauge();
  return { processed: rows.length, failed };
}

const metricsServer = createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  if (req.url === "/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/metrics") {
    if (env.metricsToken) {
      const token = req.headers["x-metrics-token"];
      if (token !== env.metricsToken) {
        res.statusCode = 401;
        res.end("Unauthorized");
        return;
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", register.contentType);
    res.end(await register.metrics());
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;

  logger.info({ workerId, signal }, "outbox worker shutting down");

  await new Promise<void>((resolve) => {
    metricsServer.close(() => resolve());
  });

  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

async function runLoop() {
  if (!env.outboxWorkerEnabled) {
    logger.info({ workerId }, "OUTBOX_WORKER_ENABLED=false, outbox worker disabled");
    return;
  }

  logger.info({ workerId }, "domain outbox worker started");

  while (!stopping) {
    try {
      const result = await processBatch(env.outboxWorkerBatchSize);

      if (result.failed > 0) {
        await new Promise((resolve) => setTimeout(resolve, env.outboxWorkerErrorMs));
      } else if (result.processed === 0) {
        await new Promise((resolve) => setTimeout(resolve, env.outboxWorkerIdleMs));
      }
    } catch (error) {
      logger.error({ err: error, workerId }, "outbox worker loop error");
      await new Promise((resolve) => setTimeout(resolve, env.outboxWorkerErrorMs));
    }
  }
}

metricsServer.listen(env.workerMetricsPort, "0.0.0.0", () => {
  logger.info({ port: env.workerMetricsPort }, "domain outbox metrics server listening");
});

void runLoop();
