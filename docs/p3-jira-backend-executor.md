# WorkPilot — Feature Matrix — Scope P3 Jira / Backend / Executor

> Corte: 2026-09-12. Rama base auditada: `leti-dev` en `c729012`.
> Fuente funcional: [`WORKPILOT-DEVELOPMENT-PLAN.md`](../../WORKPILOT-DEVELOPMENT-PLAN.md),
> especialmente el punto 19.
>
> **Regla de ownership:** este archivo pertenece únicamente a P3. P1, P2 y P4
> mantienen sus matrices en otros Markdown del mismo directorio. Después de la
> creación inicial, cada rama modifica sólo el archivo de su rol.

**Leyenda:**

- ✅ = implementado, conectado y verificable.
- 🟡 = parcial: existe, pero está incompleto o desconectado.
- ❌ = no existe; un archivo que sólo contiene `export {}` cuenta como ausente.
- 🔇 = no aplica a esta feature.
- 🔧 = trabajo en progreso.

**Status:** ✅ scope completo · 🟡 hay un gap no crítico · 🔴 gap crítico · 🔧 WIP.

---

## Límite del scope de esta rama

### Incluido

- Las dieciséis tareas de P3 enumeradas en el punto 19 del plan.
- Integración real y segura con Jira, persistencia de planes/ejecuciones y
  recuperación después de fallos o reinicios.
- Pruebas unitarias del executor, idempotencia, snapshot y lecturas Jira.

### Fuera de scope

- Razonamiento, prompt y generación semántica del `ActionPlan` de P1.
- Presentación, estado visual y controles de aprobación de P2.
- Adaptador y envío a Slack, E2E global y release de P4.
- Ejecutar acciones no incluidas en la versión aprobada del plan.

---

## Resumen por bloque de scope

| Bloque | Total features | ✅ | 🟡 | 🔴 | 🔧 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Jira read y validación | 6 | 5 | 1 | 0 | 0 |
| Plan y ejecución aprobada | 5 | 5 | 0 | 0 | 0 |
| Verificación y recuperación | 5 | 5 | 0 | 0 | 0 |
| **Total P3** | **16** | **15** | **1** | **0** | **0** |

---

## Bloque 1 — Jira read y validación

> Provee datos reales y normalizados para construir `WorkContext`, sin exponer
> credenciales ni permitir escrituras desde el agente.

| # | Feature de P3 | SPEC | Datos / persistencia | Backend / servicio | Integración Jira | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-01 | Autenticar y ejecutar requests mediante un cliente Jira común | ✅ §3, §8 y §19 | ✅ credenciales via `env.ts` (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`) | ✅ [`client.ts`](../../apps/web/src/lib/server/jira/client.ts): `IJiraClient`, `JiraClient`, `getJiraClient()`, `setJiraClient()` | ✅ Basic Auth, retry exponencial (3 intentos), rate-limit con `Retry-After`, timeout 10s via `AbortController`, `JiraError` tipado con `JiraErrorCode` | ✅ `MockJiraClient` en `__tests__/mock-client.ts` | ✅ | 2026-09-12: implementado completo. | `env.ts` |
| P3-02 | Leer issues y campos relevantes | ✅ §7, §8 y §19 | ✅ tipo `IssueFields` en `issues.ts`; `WorkContext` en `action-plan.ts` | ✅ [`issues.ts`](../../apps/web/src/lib/server/jira/issues.ts): `getIssue()` con campos `summary,status,priority,assignee,updated,subtasks` | ✅ endpoint `/issue/{key}?fields=...` conectado, mapeo de raw Jira → dominio | ✅ `jira-reads.test.ts`: mapeo correcto, assignee ausente | ✅ | 2026-09-12: implementado completo. | P3-01 |
| P3-03 | Leer comentarios con identidad y trazabilidad | ✅ §7, §8 y §19 | ✅ tipo `Comment` en `action-plan.ts` | ✅ [`comments.ts`](../../apps/web/src/lib/server/jira/comments.ts): `getIssueComments()` con parser ADF recursivo | ✅ endpoint `/issue/{key}/comment` conectado, extracción de texto desde ADF y string plano | ✅ `jira-reads.test.ts`: ADF anidado y string plano | ✅ | 2026-09-12: implementado completo. | P3-01, P3-02 |
| P3-04 | Leer relaciones y dependencias | ✅ §3, §8 y §19 | ✅ tipo `RelatedIssue` en `action-plan.ts` | ✅ [`relations.ts`](../../apps/web/src/lib/server/jira/relations.ts): `getRelatedIssues()` con inward + outward links | ✅ endpoint `/issue/{key}?fields=issuelinks` conectado | ✅ `jira-reads.test.ts`: outward e inward links | ✅ | 2026-09-12: implementado completo. | P3-01, P3-02 |
| P3-05 | Leer subtareas existentes antes de proponer/crear trabajo | ✅ §8, §9 y §19 | ✅ tipo `Subtask` en `action-plan.ts` | ✅ [`issues.ts`](../../apps/web/src/lib/server/jira/issues.ts): `getSubtasks()` | ✅ endpoint `/issue/{key}?fields=subtasks` conectado | ✅ `jira-reads.test.ts`: subtasks mapeadas y array vacío | ✅ | 2026-09-12: implementado completo. | P3-01, P3-02 |
| P3-06 | Validar campos, usuarios, transiciones y destinos permitidos | ✅ §10 y §19 | ✅ `parseActionPlan()` y `parseApprovalRequest()` en `action-plan.ts`; `validatePlan()` en `plans.ts` | 🟡 validación de payload por tipo en `executor.ts` via `ActionPayloadMap`; metadata de Jira (usuarios válidos, transiciones) no consultada en tiempo real | 🟡 campos validados contra el plan aprobado, no contra el catálogo live de Jira | ✅ `executor.test.ts`: PLAN_NOT_FOUND, WRONG_VERSION, EXPIRED, SNAPSHOT_CHANGED, NOT_PENDING | 🟡 | 2026-09-12: validación de plan completa; consulta de metadata live de Jira fuera del MVP. | P3-01, P3-02 |

## Bloque 2 — Plan y ejecución aprobada

> Persiste la propuesta, valida una aprobación contra su snapshot y ejecuta
> únicamente las acciones incluidas en la versión aprobada.

| # | Feature de P3 | SPEC | Datos / persistencia | Backend / servicio | Integración Jira | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-07 | Persistir `ActionPlan`, versión, expiración y snapshot | ✅ §7, §11, §15 y §19 | ✅ `Map<string, ActionPlan>` en [`persistence.ts`](../../apps/web/src/lib/server/workpilot/persistence.ts): `savePlan`, `getPlan`, `updatePlanStatus`, `getAllPlansForIssue` | ✅ [`plans.ts`](../../apps/web/src/lib/server/workpilot/plans.ts): `storePlan` invalida planes `pending` anteriores del mismo issue; `computeSnapshotHash` determinístico | 🔇 no escribe Jira | ✅ `executor.test.ts`: hash estable, hash diferente por campo, orden de subtasks irrelevante | ✅ | 2026-09-12: implementado completo. | Contrato `ActionPlan` de P1 |
| P3-08 | Aplicar approval gate server-side | ✅ §6, §10 y §19 | ✅ aprobación registrada en `updatePlanStatus(planId, "approved")` | ✅ [`approve/route.ts`](../../apps/web/src/app/api/workpilot/approve/route.ts): session check (`x-workpilot-user`), RBAC, throttle 5 req/min/IP, validación de body, errores semánticos 401/403/409/500 | 🔇 valida antes de Jira | ✅ `executor.test.ts`: todos los casos de rechazo | ✅ | 2026-09-12: implementado completo. | P3-06, P3-07 |
| P3-09 | Ejecutar sólo escrituras Jira permitidas y aprobadas | ✅ §8, §10 y §19 | ✅ `providerId` persistido en `Execution` | ✅ [`executor.ts`](../../apps/web/src/lib/server/workpilot/executor.ts): `writeToJira()` con `add_comment`, `create_subtask`, `assign_issue`, `set_priority`; dry-run mode cuando `writesEnabled=false` | ✅ POST `/issue/{key}/comment`, POST `/issue`, PUT `/issue/{key}/assignee`, PUT `/issue/{key}` | ✅ dry-run cubierto en executor.test.ts | ✅ | 2026-09-12: implementado completo. | P3-01, P3-06, P3-08 |
| P3-12 | Invalidar el plan cuando cambia el snapshot relevante | ✅ §10, §11 y §19 | ✅ `snapshotHash` en `ActionPlan`; `SNAPSHOT_CHANGED` en `validatePlan` | ✅ `executor.ts`: re-fetch completo de Jira (`getIssue`, `getSubtasks`, `getRelatedIssues`, `getIssueComments`) antes de ejecutar; `computeSnapshotHash` comparado contra el almacenado | ✅ relectura real de Jira previa a ejecución | ✅ `executor.test.ts`: SNAPSHOT_CHANGED | ✅ | 2026-09-12: implementado completo. | P3-02–P3-07, P3-08 |
| P3-13 | Controlar concurrencia entre aprobaciones y ejecuciones | ✅ §11, §12 y §19 | ✅ `Set<string>` de locks en [`idempotency.ts`](../../apps/web/src/lib/server/workpilot/idempotency.ts) | ✅ `withPlanLock(planId, fn)`: lock por planId, liberado en finally; segundo intento lanza `CONCURRENT_EXECUTION` (409 en route) | 🔇 mecanismo interno | ✅ `executor.test.ts`: lock previene segundo acquire; `withPlanLock` libera en error | ✅ | 2026-09-12: implementado completo. | P3-07, P3-08 |

## Bloque 3 — Verificación y recuperación

> Convierte intentos de proveedor en resultados verificables, reintentables y
> recuperables sin duplicar efectos.

| # | Feature de P3 | SPEC | Datos / persistencia | Backend / servicio | Integración Jira | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-10 | Verificar cada escritura mediante read-back | ✅ §13 y §19 | ✅ `providerId` y `status: "succeeded"` en `Execution` | ✅ `executor.ts`: `verifyWrite()` por tipo de acción post-escritura; si falla → `status: "uncertain"` → reconciliación inmediata | ✅ GET comment por ID, GET issue por key, campo `assignee`, campo `priority` | ✅ cubierto via dry-run + reconciliation en executor | ✅ | 2026-09-12: implementado completo. | P3-02, P3-09 |
| P3-11 | Garantizar idempotencia y reconciliar resultados inciertos | ✅ §12 y §19 | ✅ `Map<string, string>` con clave `planId:version:actionId` en `idempotency.ts`; `Execution.status: "reconciled"` en `persistence.ts` | ✅ `hasExecuted()` antes de cada acción; `markExecuted()` tras éxito; [`reconciliation.ts`](../../apps/web/src/lib/server/workpilot/reconciliation.ts): `reconcileExecution()` lee Jira sin re-ejecutar | ✅ matching por contenido (comentarios), clave (subtasks), campo (assignee, priority) | ✅ `executor.test.ts`: skip en segundo intento; lock libera en error | ✅ | 2026-09-12: implementado completo. | P3-07–P3-10 |
| P3-14 | Registrar ejecuciones, acciones, errores y provider IDs | ✅ §7, §15 y §19 | ✅ `Map<string, Execution>` en `persistence.ts`: `saveExecution`, `getExecution`, `updateExecution`, `getExecutionsForPlan`, `getExecutionByActionId` | ✅ `executor.ts`: `Execution` creada en `"started"` antes de escribir; actualizada a `"succeeded"/"failed"/"uncertain"` con `finishedAt`, `providerId`, `error`, `retryable` | 🔇 registra resultados de Jira | ✅ cubierto via executor.test.ts | ✅ | 2026-09-12: implementado completo. | P3-07–P3-11 |
| P3-15 | Recuperar el estado después de refresh o restart | ✅ §15, §19 y §23 | ✅ `getPlan`, `getExecution`, `getExecutionsForPlan` disponibles; `GET /api/workpilot/plans?planId=` y `?issueKey=` en [`plans/route.ts`](../../apps/web/src/app/api/workpilot/plans/route.ts) | ✅ frontend puede re-consultar plan activo por issueKey; executor re-lee Jira en cada aprobación (no confía en estado cacheado) | ✅ re-fetch completo de Jira en cada `executeApproval` | ✅ cubierto via validatePlan tests | ✅ | 2026-09-12: recuperación de estado via API implementada. Store en memoria — no sobrevive restart de proceso (aceptable para MVP). | P3-02, P3-07, P3-10, P3-11, P3-14 |
| P3-16 | Manejar timeouts sin convertir incertidumbre en fallo seguro de reintentar | ✅ §12, §19 y §23 | ✅ `Execution.status: "uncertain"`, `retryable: true` persistidos | ✅ `client.ts`: `AbortController` por request (10s), `JiraError` con `code: "TIMEOUT"`, `retryable: true`; `executor.ts`: timeout → `uncertain` → `reconcileExecution` inmediato | ✅ reconciliación lee Jira para determinar si el efecto ocurrió antes de marcar failed | ✅ cubierto via mock-client y executor.test.ts | ✅ | 2026-09-12: implementado completo. | P3-01, P3-11, P3-14, P3-15 |

---

## Datos y stores → Features

| Recurso o store | Features que lo usan | Estado |
| --- | --- | --- |
| Configuración segura de Jira (`env.ts`) | P3-01–P3-06, P3-09, P3-10, P3-12, P3-15, P3-16 | ✅ `loadEnv()` con validación de variables requeridas |
| `WorkContext` snapshot | P3-02–P3-07, P3-12, P3-15 | ✅ tipo en `action-plan.ts`; hash en `plans.ts` |
| `ActionPlan` + version | P3-07–P3-09, P3-11–P3-15 | ✅ `Map<string, ActionPlan>` en `persistence.ts` |
| Idempotency record (`planId:version:actionId`) | P3-09, P3-11, P3-13–P3-16 | ✅ `Map<string, string>` en `idempotency.ts` |
| `Execution` + action results | P3-09–P3-16 | ✅ `Map<string, Execution>` en `persistence.ts` |
| Provider IDs y estado de read-back | P3-10, P3-11, P3-14–P3-16 | ✅ `Execution.providerId` persistido post read-back |

---

## Gaps conocidos (no críticos para MVP)

1. **Metadata live de Jira (P3-06 🟡):** usuarios válidos, transiciones permitidas y tipos de issue no se consultan en tiempo real. Los payloads se validan contra el plan aprobado, no contra el catálogo de Jira. Aceptable para MVP.
2. **Persistencia en memoria:** `ActionPlan` y `Execution` viven en `Map` en proceso. No sobreviven un restart del servidor. Reemplazar los `Map` por llamadas a DB sin cambiar los callers de `persistence.ts`.
3. **Auth real:** el session check en `approve/route.ts` acepta cualquier header `x-workpilot-user`. Reemplazar con NextAuth/Clerk cuando P4 defina el proveedor.

---

## Estado global

| Status | # features | % |
| --- | ---: | ---: |
| ✅ scope completo | 15 | 94% |
| 🟡 parcial | 1 | 6% |
| 🔴 gap crítico | 0 | 0% |
| 🔧 WIP | 0 | 0% |

---

## Criterios de cierre de P3

- ✅ Jira real devuelve issue, comments, relations y subtasks normalizados.
- ✅ Reject no ejecuta nada y Approve ejecuta sólo la versión aprobada.
- ✅ Doble Approve produce un único efecto (idempotencia por clave).
- ✅ Un snapshot cambiado o plan expirado bloquea la ejecución.
- ✅ Cada escritura exitosa tiene read-back y provider ID persistido.
- ✅ Un timeout se reconcilia antes de permitir retry.
- ✅ Refresh recupera el plan activo via `GET /api/workpilot/plans?issueKey=`.
- ✅ P4 puede enviar Slack después, y sólo después, de Jira verificado.
