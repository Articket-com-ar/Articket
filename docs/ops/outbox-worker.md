# Outbox Worker Operations

## Purpose
`domainEventOutboxWorker` despacha eventos pendientes desde `DomainEventOutbox` de forma segura en multi-instancia.

## Safety model
- Claim por lote con `FOR UPDATE SKIP LOCKED`.
- Lease por fila con `lockedAt` + `lockedBy`.
- Si falla dispatch:
  - `retryCount++`
  - `lastError` (truncado)
  - libera lease (`lockedAt=null`, `lockedBy=null`)
- Si dispatch ok:
  - `dispatchedAt` seteado
  - lease liberado

## Runtime flags
- `OUTBOX_WORKER_ENABLED` (default: `true`)
- `OUTBOX_WORKER_BATCH_SIZE` (default: `20`)
- `OUTBOX_WORKER_IDLE_MS` (default: `1500`)
- `OUTBOX_WORKER_ERROR_MS` (default: `3000`)
- `OUTBOX_WORKER_LEASE_MINUTES` (default: `10`)
- `WORKER_METRICS_PORT` (default: `9101`)

## Start commands
- Dev: `pnpm --filter @articket/api worker:outbox`
- Dist: `pnpm --filter @articket/api start:worker:outbox`

## Health and metrics
- `GET /health`
- `GET /metrics` (requiere `x-metrics-token` si `METRICS_TOKEN` está configurado)

## Metrics
- `domain_event_outbox_pending`
- `domain_event_outbox_dispatched_total`
- `domain_event_outbox_retry_total`

## Shutdown behavior
- Maneja `SIGTERM` y `SIGINT`.
- Cierra server de métricas.
- Cierra conexión Prisma.

## Failure triage
1. Verificar `domain_event_outbox_retry_total`.
2. Revisar `lastError` en DB.
3. Confirmar que `lockedAt/lockedBy` no queden colgados por encima de lease.
4. Si hay backlog creciente (`domain_event_outbox_pending`), aumentar capacidad o investigar errores de dispatch.
