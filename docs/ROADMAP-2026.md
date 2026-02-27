# Roadmap Articket 2026 (Argentina / Español)

## Objetivo
Lanzar en producción una plataforma crítica de ticketing (evolución de articket.com.ar) con foco en estabilidad, velocidad y operación en picos de venta.

## Principios
- Estabilidad operativa > features bonitas.
- Evitar overselling con reservas/holds transaccionales.
- Observabilidad y runbooks desde temprano.
- Seguridad por defecto (idempotencia, firma, auditoría).

## Fases

## Fase 0 — Base técnica y alineación (Mar-Abr 2026)
**Objetivo:** consolidar ramas, dejar entorno reproducible, cerrar arquitectura V1.

### Entregables
- Integración de ramas técnicas actuales en una rama estable de trabajo.
- Convención de ramas y PRs.
- Documentos base: arquitectura, backlog inicial, riesgos.
- CI verde en entorno limpio.

### Criterios de salida
- `scripts/test.sh`, `scripts/verify.sh` y `runtime-smoke.sh` en verde.
- Entorno local levantable por cualquier dev con `docs/SETUP.md`.

---

## Fase 1 — Núcleo de venta (May-Jun 2026)
**Objetivo:** flujo completo de compra para cupo general + panel mínimo operativo.

### Entregables
- Auth, organizers, events, ticket types, pricing base.
- Checkout reserve/confirm con idempotencia.
- Integración inicial de pago (primer gateway).
- Emisión de tickets y QR firmado.
- Panel admin base (eventos, órdenes, stock, estado de pagos).

### Criterios de salida
- Flujo E2E: publicar evento -> vender -> emitir -> check-in online.
- Pruebas de consistencia sin oversell en alta concurrencia moderada.

---

## Fase 2 — Seating + panel avanzado (Jul-Sep 2026)
**Objetivo:** mapas de butacas y administración visual de recintos.

### Entregables
- Módulo de venues con sectores/pisos/alas.
- Editor visual de mapa de asientos con versionado (draft/published).
- Seat hold con TTL, lockeo y liberación automática.
- Checkout mixto (general + numerado).
- Permisos admin más finos para operación.

### Criterios de salida
- Venta y reserva de asientos numerados sin colisiones.
- Auditoría completa de cambios en mapa y ventas.

---

## Fase 3 — Operación real (Oct-Nov 2026)
**Objetivo:** llevar la plataforma a modo operación de campo.

### Entregables
- Check-in offline (modo degradado + sync posterior).
- Lista de espera opcional por evento.
- Puntos de venta físicos sincronizados.
- Observabilidad completa (métricas, logs, alertas) + runbooks operativos.
- Plan de soporte e incidentes (SLA internos).

### Criterios de salida
- Simulación de caída parcial (redis/db/red puerta) con recuperación guiada.
- Runbooks probados con drill.

---

## Fase 4 — Hardening y salida a producción (Dic 2026)
**Objetivo:** go-live controlado y seguro.

### Entregables
- Pruebas de carga en escenarios pico (hot event / checkout burst).
- Ajustes finales de performance (DB índices, caché, colas).
- Security review final.
- Estrategia de despliegue: canary / blue-green (según presupuesto VPS).
- Plan de rollback ensayado.

### Criterios de salida
- KPIs técnicos cumplidos en preproducción.
- Checklist de producción firmado.

---

## KPI mínimos de plataforma
- Error rate API en picos: < 1%.
- p95 reserve/confirm dentro de objetivo acordado por sprint.
- Cero overselling validado por checks SQL.
- Trazabilidad completa de orden/pago/ticket/check-in.

## Orden recomendado de integración de ramas actuales
1. `codex/initialize-articket-platform-architecture` (base)
2. `codex/compile-@articket/api-with-typescript-strict`
3. `codex/fix-database_url-setup-in-docker-compose`
4. `codex/add-articket/-to-.gitignore-and-.dockerignore`

Sugerencia: consolidar en `integration/sprint-0`, validar CI+smoke, luego PR a `main`.
