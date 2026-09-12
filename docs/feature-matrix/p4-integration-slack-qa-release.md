# WorkPilot — Feature Matrix — Scope P4 Integración / Slack / QA / Release

> Corte: 2026-09-12. Rama base auditada: `work/agent` en `1075737`.
> Fuente funcional: [`WORKPILOT-DEVELOPMENT-PLAN.md`](../../WORKPILOT-DEVELOPMENT-PLAN.md),
> especialmente el punto 20. Fuente de estado: revisión del árbol y del contenido
> real con `rg`; el repositorio todavía no tiene un índice ni runner de GitNexus.
>
> **Regla de ownership:** este archivo pertenece únicamente a P4. P1, P2 y P3
> mantienen sus matrices en otros Markdown del mismo directorio. Después de la
> creación inicial, cada rama modifica sólo el archivo de su rol.

**Leyenda:**

- ✅ = implementado, conectado y verificable.
- 🟡 = parcial: existe, pero está incompleto o desconectado.
- ❌ = no existe; un archivo que sólo contiene `export {}` cuenta como ausente.
- 🔇 = no aplica a esta feature o gate.
- 🔧 = trabajo en progreso.

**Status:** ✅ scope completo · 🟡 hay un gap no crítico · 🔴 gap crítico · 🔧 WIP.

**Cómo usarla:** antes de trabajar una fila, cambiar su `Status` a `🔧 WIP` y
registrar fecha e intención en `Progress`. P4 es owner del Golden Path integrado:
un módulo aislado no pasa a ✅ hasta estar incorporado y verificarse en conjunto.

---

## Límite del scope de esta rama

### Incluido

- Las trece tareas de P4 enumeradas en el punto 20 del plan.
- Integración de los entregables P1/P2/P3, Slack saliente, pruebas E2E, build,
  documentación de arranque y preparación de la entrega.
- Mantenimiento de la rama de integración según el punto 26.

### Fuera de scope

- Reimplementar el comportamiento interno asignado a P1, P2 o P3.
- Enviar Slack antes de que Jira complete read-back.
- Presentar simulaciones como integraciones reales.
- Incorporar extras fuera del MVP que pongan en riesgo el Golden Path.

## Resumen por bloque de scope

| Bloque | Total filas | ✅ | 🟡 | 🔴 | 🔧 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter, entorno y runtime | 4 | 0 | 1 | 2 | 1 |
| Integración y Slack | 3 | 0 | 0 | 2 | 1 |
| QA, documentación y release | 6 | 0 | 2 | 4 | 0 |
| **Total P4** | **13** | **0** | **3** | **8** | **2** |

> Las filas P4-01–P4-04 y P4-09–P4-13 son habilitadores o gates de entrega,
> no capacidades de negocio independientes. Se conservan porque pertenecen al
> scope contractual de P4, pero no deben inflar el score funcional del producto.

---

## Bloque 1 — Starter, entorno y runtime

> Convierte el esqueleto versionado en una aplicación instalable y ejecutable
> con configuración reproducible y sin secretos en commits.

| # | Feature o gate de P4 | SPEC | Artefacto / configuración | Runtime / integración | Verificación | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P4-01 | Incorporar el starter conservando sus convenciones | ✅ §20–§22 | ✅ starter, manifests, lockfile y revisión del SHA incorporados | ✅ alcance aprobado Web + Agent Core; runtimes Channel/móvil retirados | 🟡 `npm ci`, 79 tests y build sin caché pasan; falta validar desde checkout limpio | 🔧 WIP | 2026-09-12: starter `5c8bf4c` incorporado sin su `.git` y recortado al alcance aprobado; cambios aún sin commit. | Fuente upstream del starter |
| P4-02 | Ejecutar el checkout de `apps/web` | ✅ §20 y §22 | ✅ `package.json`, lockfile y configuración de Next.js presentes | ✅ `apps/web` inició en `127.0.0.1:3100` | 🟡 smoke local HTTP 200; falta repetir desde checkout limpio | 🟡 | 2026-09-12: instalación y ejecución local verificadas; reproducibilidad aún abierta. | P4-01 |
| P4-03 | Configurar entorno, servicios y secretos de forma segura | ✅ §20, §22 y §26 | 🟡 `.env.example`, exclusión de secretos y contrato Slack aprobados | 🟡 modelo del starter y Slack App Home configurables; Jira y accesos reales ausentes | ❌ no existe preflight integral | 🔴 | 2026-09-12: Slack requiere sólo token del bot y user ID fijo; aún sin credenciales ni validación de servicios reales. | Accesos externos; P4-01 |
| P4-04 | Adaptar el runtime del agente al starter | ✅ §20 y §21 | 🟡 dependencias y entrypoints del starter presentes; módulos WorkPilot siguen como stubs | 🟡 runtime heredado ejecutable, todavía no conectado al comportamiento WorkPilot | 🟡 typecheck y tests del baseline pasan; falta prueba de invocación WorkPilot | 🔴 | 2026-09-12: runtime base disponible; adaptación depende del contrato y entrega de P1. | P4-01–P4-03; contrato de P1 |

## Bloque 2 — Integración y Slack

> Ensambla el Golden Path y comunica a Slack únicamente después de verificar
> los cambios reales en Jira.

| # | Feature o gate de P4 | SPEC | Artefacto / configuración | Runtime / integración | Verificación | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P4-05 | Integrar Agent + Frontend + Backend en un flujo único | ✅ §4, §5 y §20 | 🟡 superficies del starter presentes; contratos WorkPilot no versionados | ❌ entrypoints WorkPilot de P1/P2/P3 siguen desconectados o como stubs | ❌ no existe vertical slice | 🔴 | 2026-09-12: baseline ejecutable, integración de negocio ausente. | Entregables P1, P2 y P3; P4-04 |
| P4-06 | Proveer un adaptador Slack saliente | ✅ §14 y §20 | ✅ contrato aprobado: App Home privado, sólo salida, destinatario fijo y texto plano | 🟡 [`client.ts`](../../apps/web/src/lib/server/slack/client.ts) usa `chat.postMessage` y devuelve `conversationId:messageTs`; aún sin proveedor real ni executor | 🟡 ocho pruebas mock pasan; falta prueba con la Slack App real | 🔧 WIP | 2026-09-12: adaptador aislado ajustado a las decisiones aprobadas; no se considera integrado. | P4-03 |
| P4-07 | Enviar una sola notificación aprobada después de Jira verified | ✅ §14, §20 y §23 | 🟡 estados y retry simple definidos; persistencia e idempotencia dependen de P3 | 🟡 [`notifications.ts`](../../apps/web/src/lib/server/slack/notifications.ts) bloquea Jira no verificado e inyecta el destinatario del servidor, pero no existe secuencia Jira → Slack | 🟡 guardas, éxito y clasificación de errores cubiertos; sin prueba de orden, retry persistente ni fallo parcial E2E | 🔴 | 2026-09-12: sólo retry manual de fallos confirmados; resultados inciertos no se reenvían. Integración pendiente de P3. | P3 read-back/ejecución; P4-05, P4-06 |

## Bloque 3 — QA, documentación y release

> Demuestra que la integración completa es reproducible y prepara los artefactos
> necesarios para que otra persona pueda ejecutarla y evaluarla.

| # | Feature o gate de P4 | SPEC | Artefacto / configuración | Runtime / integración | Verificación | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P4-08 | Ejecutar pruebas end-to-end del Golden Path y fallos críticos | ✅ §20, §23 y §25 | ❌ fixtures/runner E2E ausentes; sólo existen tests del starter y unitarios Slack | ❌ aplicación integrada ausente | ❌ no hay suite ni resultados E2E | 🔴 | 2026-09-12: tests offline pasan, pero no cubren el Golden Path. | P4-05, P4-07; WP-42/WP-57 |
| P4-09 | Producir un build limpio y reproducible | ✅ §20, §22 y §25 | ✅ scripts, workspace reducido y configuración de build incorporados | 🟡 compila Web + Agent Core; producto WorkPilot todavía no integrado | 🟡 `npm ci` y build web sin caché aprobados con una advertencia heredada; falta clean checkout/CI | 🟡 | 2026-09-12: 79 tests y build de producción pasan en el alcance reducido; gate final aún abierto. | P4-01–P4-08 |
| P4-10 | Documentar un quickstart verificable | ✅ §20 y §22 | 🟡 [`README.md`](../../README.md) contiene un quickstart preliminar | 🔇 documentación operativa | ❌ no fue validado desde clean clone ni con Jira/Slack reales | 🟡 | 2026-09-12: documentación inicial presente; debe ajustarse al alcance y servicios acordados. | P4-02, P4-03, P4-09 |
| P4-11 | Preparar la submission del proyecto | ✅ §20 y §25 | 🟡 hay referencia del starter, no submission propia | 🔇 artefacto de entrega | ❌ checklist/submission final ausente | 🔴 | 2026-09-12: submission del proyecto no existe. | P4-09, P4-10 |
| P4-12 | Producir el video de demostración | ✅ §20 y §22 | ❌ guion/captura final ausentes | 🔇 artefacto audiovisual | ❌ video no disponible | 🔴 | 2026-09-12: video pendiente. | P4-08–P4-11 |
| P4-13 | Ensayar una demo reproducible sin intervención de código | ✅ §20 y §25 | ❌ runbook de demo ausente | ❌ Golden Path no ejecutable | ❌ no hay registro de ensayo | 🔴 | 2026-09-12: ensayo de demo pendiente. | P4-08–P4-12 |

---

## Artefactos y servicios → Features / gates

| Recurso | Filas que lo usan | Owner primario | Estado |
| --- | --- | --- | --- |
| Starter y manifests | P4-01–P4-05, P4-09, P4-10 | P4 | 🟡 incorporados sin commit ni validación desde clean checkout |
| Configuración Jira/modelo/Slack | P4-03–P4-08, P4-10, P4-13 | P4 coordina | 🟡 contrato Slack aprobado; credenciales reales, Jira y preflight ausentes |
| Entregable P1 Agent | P4-04, P4-05, P4-08, P4-13 | P1 provee; P4 integra | ❌ stub |
| Entregable P2 Frontend | P4-05, P4-08, P4-12, P4-13 | P2 provee; P4 integra | ❌ stub |
| Entregable P3 Jira/Executor | P4-05, P4-07, P4-08, P4-13 | P3 provee; P4 integra | ❌ stub |
| Slack provider ID/status | P4-07, P4-08, P4-13 | P4 define; P3 persiste | 🟡 contrato acordado `${conversationId}:${messageTs}`; aún no persistido |
| Fixtures WP-42/WP-57 | P4-08, P4-12, P4-13 | Coordinación P1/P3/P4 | ❌ no versionadas |
| Build, quickstart y submission | P4-09–P4-13 | P4 | 🟡 build del starter y quickstart preliminar; submission final ausente |

## Gaps críticos

1. El starter está incorporado, recortado al alcance Web + Agent Core y ejecuta
   localmente, pero sigue sin commit ni validación desde un checkout limpio.
2. Agent, frontend, Jira/executor y Slack permanecen como placeholders sin un
   vertical slice integrado.
3. Existe configuración base para modelo y un adaptador Slack con contrato
   aprobado, pero no hay preflight ni validación contra Jira/modelo/Slack reales.
4. No existen pruebas E2E de Golden Path ni de Reject, Double Approve, stale
   plan, fallo parcial, refresh o restart.
5. El build del starter y un quickstart preliminar existen; build integrado,
   submission, video y ensayo de demo siguen abiertos.

## Orden sugerido de implementación

### Fase 1 — Aplicación ejecutable

1. **P4-01**, **P4-02** — incorporar starter y levantar `apps/web`.
2. **P4-03**, **P4-04** — configurar servicios y adaptar runtime.

### Fase 2 — Vertical slice

1. **P4-05** — integrar ticket → agente → propuesta → aprobación → Jira.
2. **P4-06**, **P4-07** — añadir Slack después de Jira verified.

### Fase 3 — Confiabilidad E2E

1. **P4-08** — Golden Path con WP-42/WP-57.
2. Añadir Reject, Double Approve, stale plan, fallo parcial, refresh y restart.
3. **P4-09** — cerrar build reproducible.

### Fase 4 — Entrega

1. **P4-10**, **P4-11** — quickstart y submission.
2. **P4-12**, **P4-13** — video y ensayo de demo.

## Estado global

| Status | # filas | % |
| --- | ---: | ---: |
| ✅ scope completo | 0 | 0% |
| 🟡 parcial | 3 | 23% |
| 🔴 gap crítico | 8 | 62% |
| 🔧 WIP | 2 | 15% |

## Estado funcional de P4

| Status | # capacidades funcionales | % |
| --- | ---: | ---: |
| ✅ E2E completa | 0 | 0% |
| 🟡 parcial | 1 | 33% |
| 🔴 gap crítico | 2 | 67% |

> El score funcional cuenta P4-05, P4-06 y P4-07. Las otras diez filas son
> habilitadores o gates y se controlan en el estado global del scope.

## Criterios de cierre de P4

- un checkout limpio instala, configura y ejecuta `apps/web` siguiendo README;
- el Golden Path completo funciona con Jira y Slack reales;
- Slack sólo se envía después del read-back exitoso de Jira;
- un fallo de Slack conserva Jira como success y permite retry independiente;
- WP-42 y WP-57 producen propuestas distintas;
- las pruebas críticas del punto 25 tienen resultado reproducible;
- build, submission, video y demo no requieren cambios manuales de código;
- credenciales y secretos no aparecen en commits ni capturas.

## Flujo de actualización

1. Marcar la fila `🔧 WIP` y añadir fecha e intención en `Progress`.
2. Actualizar P4-05 al integrar cada vertical slice, sin apropiarse del detalle
   interno ya trackeado por P1/P2/P3.
3. Registrar comandos y resultados reproducibles para checkout, build y E2E.
4. Recalcular el resumen por bloque, estado global y score funcional.
5. Actualizar únicamente este archivo desde la rama/rol P4.
6. Auditar con GitNexus cuando exista índice vigente; mientras tanto usar `rg`.
