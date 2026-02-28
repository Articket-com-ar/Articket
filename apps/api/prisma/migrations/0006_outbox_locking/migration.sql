ALTER TABLE "DomainEventOutbox"
  ADD COLUMN "lockedAt" TIMESTAMPTZ,
  ADD COLUMN "lockedBy" TEXT;

CREATE INDEX "DomainEventOutbox_lockedAt_idx" ON "DomainEventOutbox"("lockedAt");
CREATE INDEX "DomainEventOutbox_dispatchedAt_lockedAt_createdAt_idx"
  ON "DomainEventOutbox"("dispatchedAt", "lockedAt", "createdAt");
