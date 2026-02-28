CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "DomainEventOutbox" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventName" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "dispatchedAt" TIMESTAMPTZ,
  "retryCount" INT NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "correlationId" TEXT
);

CREATE INDEX "DomainEventOutbox_dispatchedAt_idx" ON "DomainEventOutbox"("dispatchedAt");
CREATE INDEX "DomainEventOutbox_createdAt_idx" ON "DomainEventOutbox"("createdAt");
CREATE INDEX "DomainEventOutbox_dispatchedAt_createdAt_idx" ON "DomainEventOutbox"("dispatchedAt", "createdAt");
