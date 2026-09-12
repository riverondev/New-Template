# WorkPilot — Feature Matrix — Scope P3 Jira / Backend / Executor

> Corte: 2026-09-12. Rama base auditada: `work/agent` en `1075737`.
> Fuente funcional: [`WORKPILOT-DEVELOPMENT-PLAN.md`](../../WORKPILOT-DEVELOPMENT-PLAN.md),
> especialmente el punto 19. Fuente de estado: revisión del árbol y del contenido
> real con `rg`; el repositorio todavía no tiene un índice ni runner de GitNexus.
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

**Cómo usarla:** antes de trabajar una feature, cambiar su `Status` a `🔧 WIP`
y registrar fecha e intención en `Progress`. Una respuesta 2xx del proveedor no
basta para marcar ✅: las escrituras requieren read-back y resultado persistido.

---

## Límite del scope de esta rama

### Incluido

- Las dieciséis tareas de P3 enumeradas en el punto 19 del plan.
- Integración real y segura con Jira, persistencia de planes/ejecuciones y
  recuperación después de fallos o reinicios.
- Pruebas unitarias, de contrato e integración del executor.

### Fuera de scope

- Razonamiento, prompt y generación semántica del `ActionPlan` de P1.
- Presentación, estado visual y controles de aprobación de P2.
- Adaptador y envío a Slack, E2E global y release de P4.
- Ejecutar acciones no incluidas en la versión aprobada del plan.

## Resumen por bloque de scope

| Bloque | Total features | ✅ | 🟡 | 🔴 | 🔧 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Jira read y validación | 6 | 0 | 0 | 6 | 0 |
| Plan y ejecución aprobada | 5 | 0 | 0 | 5 | 0 |
| Verificación y recuperación | 5 | 0 | 0 | 5 | 0 |
| **Total P3** | **16** | **0** | **0** | **16** | **0** |

---

## Bloque 1 — Jira read y validación

> Provee datos reales y normalizados para construir `WorkContext`, sin exponer
> credenciales ni permitir escrituras desde el agente.

| # | Feature de P3 | SPEC | Datos / persistencia | Backend / servicio | Integración Jira | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-01 | Autenticar y ejecutar requests mediante un cliente Jira común | ✅ §3, §8 y §19 | ❌ configuración/secrets contract ausente | ❌ [`client.ts`](../../apps/web/src/lib/server/jira/client.ts) es stub | ❌ no hay conexión ni manejo de respuesta/error | ❌ | 🔴 | 2026-09-12: cliente Jira no implementado. | Entorno/secrets de P4 |
| P3-02 | Leer issues y campos relevantes | ✅ §7, §8 y §19 | ❌ modelo normalizado ausente | ❌ [`issues.ts`](../../apps/web/src/lib/server/jira/issues.ts) es stub | ❌ endpoint Jira no conectado | ❌ | 🔴 | 2026-09-12: lectura de issues ausente. | P3-01; `WorkContext` compartido con P1 |
| P3-03 | Leer comentarios con identidad y trazabilidad | ✅ §7, §8 y §19 | ❌ schema `Comment` ausente | ❌ [`comments.ts`](../../apps/web/src/lib/server/jira/comments.ts) es stub | ❌ endpoint de comments no conectado | ❌ | 🔴 | 2026-09-12: lectura de comentarios ausente. | P3-01, P3-02 |
| P3-04 | Leer relaciones y dependencias | ✅ §3, §8 y §19 | ❌ schema `RelatedIssue` ausente | ❌ [`relations.ts`](../../apps/web/src/lib/server/jira/relations.ts) es stub | ❌ issue links no conectados | ❌ | 🔴 | 2026-09-12: relaciones ausentes. | P3-01, P3-02 |
| P3-05 | Leer subtareas existentes antes de proponer/crear trabajo | ✅ §8, §9 y §19 | ❌ schema `Subtask` ausente | ❌ servicio dedicado ausente | ❌ lectura de subtasks no conectada | ❌ | 🔴 | 2026-09-12: subtasks no implementadas. | P3-01, P3-02; consumo de P1 |
| P3-06 | Validar campos, usuarios, transiciones y destinos permitidos | ✅ §10 y §19 | ❌ catálogo/constraints ausentes | ❌ validador de campos ausente | ❌ metadata Jira no consultada | ❌ | 🔴 | 2026-09-12: validaciones del proveedor ausentes. | P3-01, P3-02 |

## Bloque 2 — Plan y ejecución aprobada

> Persiste la propuesta, valida una aprobación contra su snapshot y ejecuta
> únicamente las acciones incluidas en la versión aprobada.

| # | Feature de P3 | SPEC | Datos / persistencia | Backend / servicio | Integración Jira | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-07 | Persistir `ActionPlan`, versión, expiración y snapshot | ✅ §7, §11, §15 y §19 | ❌ schema/store ausente | ❌ [`plans.ts`](../../apps/web/src/lib/server/workpilot/plans.ts) y [`persistence.ts`](../../apps/web/src/lib/server/workpilot/persistence.ts) son stubs | 🔇 no escribe Jira | ❌ | 🔴 | 2026-09-12: persistencia de planes ausente. | Contrato `ActionPlan` de P1 |
| P3-08 | Aplicar approval gate server-side | ✅ §6, §10 y §19 | ❌ aprobación/versionado no persistidos | ❌ [`executor.ts`](../../apps/web/src/lib/server/workpilot/executor.ts) es stub | 🔇 valida antes de Jira | ❌ | 🔴 | 2026-09-12: approval gate ausente. | P3-06, P3-07; request de P2 |
| P3-09 | Ejecutar sólo escrituras Jira permitidas y aprobadas | ✅ §8, §10 y §19 | ❌ resultados/provider IDs no persistidos | ❌ executor y handlers ausentes | ❌ `add_comment`, `create_subtask`, `assign_issue` y `set_priority` ausentes | ❌ | 🔴 | 2026-09-12: no hay escrituras Jira. | P3-01, P3-06, P3-08 |
| P3-12 | Invalidar el plan cuando cambia el snapshot relevante | ✅ §10, §11 y §19 | ❌ snapshot/version hash ausente | ❌ comparación y error `SNAPSHOT_CHANGED` ausentes | ❌ no hay relectura previa a ejecución | ❌ | 🔴 | 2026-09-12: snapshot validation ausente. | P3-02–P3-07, P3-08 |
| P3-13 | Controlar concurrencia entre aprobaciones y ejecuciones | ✅ §11, §12 y §19 | ❌ lock/constraint transaccional ausente | ❌ coordinación de ejecución ausente | 🔇 mecanismo interno | ❌ | 🔴 | 2026-09-12: concurrencia no implementada. | P3-07, P3-08, P3-11 |

## Bloque 3 — Verificación y recuperación

> Convierte intentos de proveedor en resultados verificables, reintentables y
> recuperables sin duplicar efectos.

| # | Feature de P3 | SPEC | Datos / persistencia | Backend / servicio | Integración Jira | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-10 | Verificar cada escritura mediante read-back | ✅ §13 y §19 | ❌ provider ID/estado verificado ausentes | ❌ verificador ausente | ❌ lectura posterior no implementada | ❌ | 🔴 | 2026-09-12: read-back ausente. | P3-02, P3-09 |
| P3-11 | Garantizar idempotencia y reconciliar resultados inciertos | ✅ §12 y §19 | ❌ idempotency key/store ausentes | ❌ [`idempotency.ts`](../../apps/web/src/lib/server/workpilot/idempotency.ts) y [`reconciliation.ts`](../../apps/web/src/lib/server/workpilot/reconciliation.ts) son stubs | ❌ sin búsqueda/reconciliación en Jira | ❌ | 🔴 | 2026-09-12: idempotencia y reconciliación ausentes. | P3-07–P3-10 |
| P3-14 | Registrar ejecuciones, acciones, errores y provider IDs | ✅ §7, §15 y §19 | ❌ schema/store `Execution` ausente | ❌ writer/reader de ejecución ausente | 🔇 registra resultados de Jira | ❌ | 🔴 | 2026-09-12: registro de ejecución ausente. | P3-07–P3-11 |
| P3-15 | Recuperar el estado después de refresh o restart | ✅ §15, §19 y §23 | ❌ checkpoint/estado de recuperación ausente | ❌ loader y reconciliación de arranque ausentes | ❌ estado real no se relee | ❌ | 🔴 | 2026-09-12: recuperación ausente. | P3-02, P3-07, P3-10, P3-11, P3-14 |
| P3-16 | Manejar timeouts sin convertir incertidumbre en fallo seguro de reintentar | ✅ §12, §19 y §23 | ❌ estado `unknown/retryable` no persistido | ❌ policy de timeout/retry ausente | ❌ no hay reconciliación con Jira | ❌ | 🔴 | 2026-09-12: manejo de timeout ausente. | P3-01, P3-11, P3-14, P3-15 |

---

## Datos y stores → Features

> Mapa inverso de recursos persistentes. Los nombres físicos de tablas/colecciones
> deben reemplazar estas entidades cuando P3 elija el almacenamiento.

| Recurso o store | Features que lo usan | Estado |
| --- | --- | --- |
| Configuración segura de Jira | P3-01–P3-06, P3-09, P3-10, P3-12, P3-15, P3-16 | ❌ ausente |
| `WorkContext` snapshot | P3-02–P3-07, P3-12, P3-15 | ❌ sólo documentado |
| `ActionPlan` + version | P3-07–P3-09, P3-11–P3-15 | ❌ sólo documentado |
| Idempotency record (`planId + version + actionId`) | P3-09, P3-11, P3-13–P3-16 | ❌ sólo documentado |
| `Execution` + action results | P3-09–P3-16 | ❌ sólo documentado |
| Provider IDs y estado de read-back | P3-10, P3-11, P3-14–P3-16 | ❌ ausente |

## Gaps críticos

1. Los módulos Jira y WorkPilot server-side son placeholders `export {}`.
2. No existe runtime backend, manifiesto de dependencias, configuración ni
   contrato de secrets en esta rama.
3. No hay schema ni almacenamiento para `ActionPlan`, idempotencia o
   `Execution`.
4. Approval, escrituras y read-back no tienen endpoints ni servicios.
5. No existe suite de contrato/integración para doble approve, stale plan,
   timeout, restart o recuperación.

## Orden sugerido de implementación

### Fase 1 — Cliente y lecturas

1. **P3-01** — cliente Jira y errores normalizados.
2. **P3-02–P3-05** — issue, comments, relations y subtasks.
3. **P3-06** — validación de campos y destinos.

### Fase 2 — Persistencia y approval gate

1. **P3-07** — schema/store de planes y snapshots.
2. **P3-14** — schema/store de ejecuciones y resultados.
3. **P3-08**, **P3-12** — aprobación exacta e invalidación por cambios.

### Fase 3 — Escritura segura

1. **P3-09** — `add_comment` y `create_subtask` primero.
2. **P3-10** — read-back por acción.
3. **P3-11**, **P3-13** — idempotencia y concurrencia.

### Fase 4 — Recuperación

1. **P3-16** — timeouts y estado incierto.
2. **P3-15** — recuperación tras refresh/restart.

## Estado global

| Status | # features | % |
| --- | ---: | ---: |
| ✅ scope completo | 0 | 0% |
| 🟡 parcial | 0 | 0% |
| 🔴 gap crítico | 16 | 100% |
| 🔧 WIP | 0 | 0% |

## Criterios de cierre de P3

- Jira real devuelve issue, comments, relations y subtasks normalizados;
- Reject no ejecuta nada y Approve ejecuta sólo la versión aprobada;
- doble Approve produce un único efecto;
- un snapshot cambiado o plan expirado bloquea la ejecución;
- cada escritura exitosa tiene read-back y provider ID persistido;
- un timeout se reconcilia antes de permitir retry;
- refresh y restart recuperan un estado consistente;
- P4 puede enviar Slack después, y sólo después, de Jira verificado.

## Flujo de actualización

1. Marcar la fila `🔧 WIP` y añadir fecha e intención en `Progress`.
2. Sustituir estados genéricos por rutas y símbolos reales: endpoint → servicio
   → store/Jira → tests.
3. Añadir nombres físicos al mapa de stores cuando se defina persistencia.
4. Recalcular el resumen por bloque y el estado global en el mismo cambio.
5. Actualizar únicamente este archivo desde la rama/rol P3.
6. Auditar con GitNexus cuando exista índice vigente; mientras tanto usar `rg`.
