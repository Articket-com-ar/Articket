# Arquitectura V1 (Articket)

## Stack propuesto
- **Frontend:** React + Next.js (panel + storefront web).
- **Backend:** Node.js + TypeScript (Fastify/NestJS).
- **DB:** PostgreSQL.
- **Cache/colas:** Redis + BullMQ.
- **ORM:** Prisma.
- **Infra:** Docker Compose en VPS (evolucionable a orquestación futura).

## Estilo arquitectónico
**Modular monolith** inicialmente, con límites claros de dominio para extraer servicios críticos más adelante sin reescritura total.

## Dominios principales
- Identity & Access
- Organizers & RBAC
- Venues & Seat Maps
- Catalog (Events / TicketTypes / Pricing)
- Checkout & Reservations
- Payments
- Ticket Issuance + QR
- Check-in (online/offline)
- Waiting List
- Box Office
- Notifications
- Audit/Activity

## Modelo de inventario
### 1) Cupo general
- Stock calculado por `vendido + reservado vigente`.
- Reserva con TTL.
- Confirmación de pago -> emite tickets.

### 2) Asiento numerado
- `SeatHold` por asiento con expiración.
- Lock transaccional por asiento al reservar.
- Evitar doble venta con constraints + transacciones.

## Anti-fraude y validez de ticket
- QR dinámico firmado (token corto + expiración).
- Validación de firma y ventana temporal.
- Anti-replay (nonce/jti + estado de uso/check-in).
- Revocación al invalidar/reembolsar ticket.

## Check-in offline (requisito crítico)
- App/PWA scanner con caché local cifrada para ventana operativa.
- Política de resolución de conflictos al sincronizar.
- Registro de eventos de scan con correlación temporal.

## Integraciones de pago
Diseño por puerto/adaptador:
- Mercado Pago
- Stripe
- PayPal

Reglas:
- idempotency key obligatoria;
- webhook firmado/verificado;
- reconciliación periódica de estados.

## Observabilidad
- Métricas API + Worker (`/metrics`).
- Correlation ID en toda la cadena.
- Logs estructurados (json).
- Alertas mínimas: error rate, cola creciendo, worker caído, latencias.

## Seguridad mínima V1
- Secrets por env + rotación.
- JWT con expiración razonable + refresh seguro.
- RBAC por organizer/evento.
- Audit log de acciones sensibles admin.
- Límite de tasa en endpoints críticos.

## Despliegue en VPS (inicio)
- Contenedores: `api`, `worker`, `postgres`, `redis`, `web`.
- Backups automáticos de Postgres + prueba de restore mensual.
- Healthchecks + restart policies.
- Ambiente staging separado de producción.

## Riesgos y mitigaciones
1. **Overselling en picos** -> holds transaccionales + pruebas de concurrencia.
2. **Pagos duplicados** -> idempotencia end-to-end.
3. **Caída de internet en acceso** -> check-in offline + sync robusto.
4. **Degradación por VPS corto** -> capacity planning + load tests tempranos.
5. **Errores operativos** -> runbooks + drills.
