import type { Prisma, PrismaClient } from "@prisma/client";
import { DomainEventName } from "./events.js";

type DomainEventOutboxDb = PrismaClient | Prisma.TransactionClient;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type EmitDomainEventTxInput = {
  eventName: DomainEventName;
  aggregateType: string;
  aggregateId: string;
  payload: JsonValue;
  correlationId?: string | null;
};

export async function emitDomainEventTx(
  tx: DomainEventOutboxDb,
  input: EmitDomainEventTxInput
) {
  await tx.domainEventOutbox.create({
    data: {
      eventName: input.eventName,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload as Prisma.InputJsonValue,
      correlationId: input.correlationId ?? null
    }
  });
}
