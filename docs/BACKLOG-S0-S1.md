# Backlog inicial (Sprint 0 y Sprint 1)

## Sprint 0 — Consolidación técnica

### Objetivo
Dejar base confiable para empezar feature development sin deuda estructural.

### Tareas
1. Consolidar ramas codex en `integration/sprint-0`.
2. Correr `scripts/test.sh`, `scripts/verify.sh`, `scripts/runtime-smoke.sh`.
3. Corregir issues de entorno reproducible (Docker/Prisma/env).
4. Definir normas de branching y PR template.
5. Acordar estándares:
   - contrato de errores API,
   - versionado de eventos de dominio,
   - nomenclatura de métricas.
6. Definir ADR para:
   - seat map model,
   - QR dinámico,
   - check-in offline.

### DoD (Definition of Done)
- CI verde.
- Entorno limpia + reproducible.
- Documentación mínima vigente en `/docs`.

---

## Sprint 1 — Núcleo funcional de venta

### Objetivo
Flujo E2E mínimo en producción técnica (sin seating aún): publicar evento, vender, cobrar, emitir, validar.

### Tareas funcionales
1. Panel admin base:
   - crear organizer/evento/ticketType,
   - publicar/despublicar evento,
   - ver órdenes y estados.
2. Checkout:
   - reserve (con TTL),
   - confirm (idempotente),
   - expiración automática de reservas.
3. Pago inicial:
   - adapter 1er gateway,
   - webhook con validación de firma,
   - reconciliación de pagos pendientes.
4. Tickets:
   - emisión post-pago,
   - QR firmado (versión inicial),
   - endpoint de validación.
5. Check-in online:
   - scan endpoint,
   - reglas de duplicado/invalidado.

### Tareas no funcionales
1. Métricas clave por endpoint de checkout y check-in.
2. Dashboard básico de operación (errores, latencia, colas).
3. Script de smoke post-deploy.
4. Tests de concurrencia básicos (k6) para reserve/confirm.

### DoD
- Flujo E2E demostrable con datos semilla.
- Sin overselling en pruebas definidas.
- Trazabilidad completa con correlationId.

---

## Lista de preguntas abiertas (para cerrar en diseño)
1. Política exacta de expiración de reserva (ej. 5/10/15 min por tipo de evento).
2. Reglas de cancelación y devolución por canal.
3. Nivel de detalle para roles administrativos (owner/admin/staff/scanner).
4. Confirmar gateway prioritario para Argentina (primero Mercado Pago o dual desde inicio).
5. SLA objetivo para eventos pico.
