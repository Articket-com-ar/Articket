# Articket Platform

![CI](https://github.com/<owner>/articket-platform/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)
![Issues](https://img.shields.io/github/issues/<owner>/articket-platform)

Monorepo TypeScript para ticketing multi-organizador.

## Estructura
- `apps/web` → React + Vite
- `apps/api` → Fastify + Prisma
- `packages/shared` → tipos/schemas compartidos
- `loadtests` → k6 + SQL checks
- `scripts` → scripts operativos
- `docs` → ADRs, endpoints, runbooks
- `tests` → integración/contract tests (reserva de carpeta)

## Setup local
### Prerrequisitos
- Docker + Docker Compose
- Bash

### Variables
1. Copiar variables:
   ```bash
   cp .env.example .env
   ```
2. Nunca comitear `.env`.

### Levantar entorno
```bash
./scripts/start.sh
```

## Scripts útiles
- `./scripts/start.sh` → levanta entorno completo (dev)
- `./scripts/test.sh` → comando oficial reproducible de tests en máquina limpia
- `./scripts/verify.sh` → tests + `verify-consistency.sh`
- `./scripts/lint.sh` → lint + format

## Tests reproducibles (máquina limpia)
Comando oficial:
```bash
./scripts/test.sh
```

Este comando corre en Docker (`api-test`) y evita depender de Corepack para descargar pnpm.

## Dashboard de actividad
Ruta:
- `/dashboard/events/:eventId/activity`

Incluye:
- cursor pagination (`occurredAt DESC, id DESC`)
- filtros por `types`
- `includePayload` restringido por rol (owner/admin)
- visualización de `correlationId`, actor y summary server-side

## Loadtests + consistencia
Ejecutar carga:
```bash
k6 run loadtests/hot-event.js -e API_URL=http://localhost:3000 -e ORGANIZER_ID=<org> -e EVENT_ID=<event> -e TICKET_TYPE_ID=<tt> -e QUOTA=<quota>
```

Verificar consistencia:
```bash
DATABASE_URL=postgresql://articket:articket@localhost:5432/articket?schema=public EVENT_ID=<event> ./loadtests/verify-consistency.sh
```

## Endpoints importantes
Ver `docs/api-endpoints.md`.

## Runbooks
- `docs/runbooks/email-queue-growing.md`
- `docs/runbooks/worker-down.md`
- `docs/runbooks/redis-down.md`

## Seguridad y privacidad
- Repo objetivo: `articket-platform` (privado).
- No subir secretos ni `.env`.
- Rotar claves periódicamente: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_SECRET`, `SENDGRID_API_KEY`.
- Para rotación: actualizar secretos en entorno, redeploy API/worker, invalidar tokens antiguos si aplica.

## CI / GitHub Actions
Workflow en `.github/workflows/ci.yml`:
- checkout
- setup node + docker
- build
- run tests
- run verify scripts
- report status

## Branch protection (main)
Recomendado en GitHub:
- Require pull request before merging
- Require status checks to pass (`CI`)
- Require branches up to date before merge
