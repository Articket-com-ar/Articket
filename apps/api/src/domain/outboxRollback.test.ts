import "dotenv/config";
import { describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { DomainEventName } from "./events.js";
import { emitDomainEventTx } from "./outbox.js";

describe("outbox transactional rollback", () => {
  it("does not persist outbox row when transaction rolls back", async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for outbox rollback test");
    }

    const correlationId = `test-outbox-rollback-${Date.now()}`;

    await prisma.domainEventOutbox.deleteMany({ where: { correlationId } });

    await expect(
      prisma.$transaction(async (tx) => {
        await emitDomainEventTx(tx, {
          eventName: DomainEventName.LATE_PAYMENT_CASE_CREATED,
          aggregateType: "LatePaymentCase",
          aggregateId: "rollback-test-case",
          correlationId,
          payload: {
            caseId: "rollback-test-case",
            action: "CREATE"
          }
        });

        throw new Error("force rollback");
      })
    ).rejects.toThrow("force rollback");

    const after = await prisma.domainEventOutbox.count({ where: { correlationId } });
    expect(after).toBe(0);
  });
});
