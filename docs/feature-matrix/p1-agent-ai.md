# WorkPilot — Feature Matrix — Scope P1 Agent / AI

> Corte: 2026-09-12. Rama auditada: `work/agent` en `1075737`, incluyendo
> el working tree local de P1.
> Fuente funcional: [`WORKPILOT-DEVELOPMENT-PLAN.md`](../../WORKPILOT-DEVELOPMENT-PLAN.md),
> especialmente el punto 17. Fuente de estado: inspección directa del código,
> typecheck estricto, suite local de 15 pruebas y `git diff --check`.
>
> Este repositorio aún no tiene integrado su propio toolchain ni un índice
> GitNexus vigente. La suite se verificó compilando temporalmente con el
> toolchain del starter hermano y ejecutándola con `node --test`.
>
> Esta matriz cubre exclusivamente **P1 — Agent / AI como responsabilidad del
> equipo**. No se refiere a **P1 — Debe ser confiable**, la prioridad descrita en
> el punto 28 del plan.
>
> **Regla de ownership:** este archivo pertenece únicamente a P1. Cada uno de
> los demás roles mantiene su matriz en otro Markdown dentro de este directorio
> para que las cuatro ramas puedan evolucionar y mergearse sin editar el mismo
> documento.

**Leyenda:**

- ✅ = implementado, conectado y verificable.
- 🟡 = parcial: existe, pero está incompleto o desconectado.
- ❌ = no existe; un archivo que sólo contiene `export {}` cuenta como ausente.
- 🔇 = no aplica a esta feature.
- 🔧 = trabajo en progreso.

**Status:** ✅ scope completo · 🟡 hay un gap no crítico · 🔴 gap crítico · 🔧 WIP.

**Cómo usarla:** antes de trabajar una feature, cambiar su `Status` a `🔧 WIP`
y registrar fecha e intención en `Progress`. Una celda sólo pasa a ✅ cuando
incluye una ruta o símbolo real y una verificación reproducible. La existencia
de una spec o de un archivo placeholder no implica implementación.

---

## Límite del scope de esta rama

### Incluido

- Las nueve tareas de P1 enumeradas en el punto 17 del plan.
- Los contratos y puertos que P1 necesita para recibir contexto y consultar
  datos sin acoplar el agente al proveedor.
- Pruebas unitarias y de comportamiento del agente con WP-42 y WP-57.

### Fuera de scope

- P2: selector, panel, propuesta visual, aprobación y estados de UI.
- P3: cliente Jira real, persistencia, executor, escrituras, read-back,
  idempotencia y reconciliación.
- P4: Slack, integración E2E, release, submission y demo final.
- Cualquier escritura directa del agente en Jira o Slack.

Las dependencias con P2–P4 aparecen en la matriz para coordinar contratos; no
convierten esas implementaciones en responsabilidad de esta rama.

## Resumen por bloque de scope

| Bloque | Total features | ✅ | 🟡 | 🔴 | 🔧 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contexto y lectura | 2 | 0 | 2 | 0 | 0 |
| Razonamiento y evidencia | 4 | 0 | 4 | 0 | 0 |
| Plan y seguimiento | 2 | 0 | 2 | 0 | 0 |
| Verificación del agente | 1 | 0 | 1 | 0 | 0 |
| **Total P1** | **9** | **0** | **9** | **0** | **0** |

---

## Bloque 1 — Contexto y herramientas de lectura

> Lleva el ticket seleccionado hasta un `WorkContext` utilizable por el agente
> y expone lecturas de Jira mediante puertos sin capacidad de escritura.

| # | Feature de P1 | SPEC | Contrato / datos | Agent Core | Integración | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-02 | Inyectar automáticamente el ticket seleccionado | ✅ §2, §4 y §17 | ✅ [`context.ts`](../../packages/agent-core/src/workpilot/context.ts) define y valida `SelectedTicket`, `WorkContext`, `AssignmentCandidate` y cobertura de lecturas | ✅ `workPilotAgentContextValue` modela ticket presente/ausente y `readWorkContext` construye contexto desacoplado | ❌ falta conectar el selector de P2 mediante `useAgentContext` y las lecturas reales de P3 | ✅ [`workpilot.test.ts`](../../packages/agent-core/src/workpilot/workpilot.test.ts) cubre ticket, contexto y valor ambiental presente/ausente | 🟡 | 2026-09-12: contrato y boundary local implementados y verificados; pendiente integración P2/P3. | Selector y contexto de P2; adaptadores de P3 |
| P1-03 | Consultar issue, comentarios, relaciones y proyecto con herramientas read-only | ✅ §8 y §17 | ✅ [`tools.ts`](../../packages/agent-core/src/workpilot/tools.ts) define nombres, schemas de entrada, resultados, errores y `WorkPilotReadPort` sin escrituras | ✅ `invokeReadTool` valida resultados y scope de issue/proyecto; `readWorkContext` conserva gaps y cobertura parcial | ❌ faltan adaptadores Jira de P3, timeout del proveedor y registro de tools en el runtime de P4 | ✅ la suite cubre los cinco tools, fallo parcial y rechazo de respuestas fuera de scope | 🟡 | 2026-09-12: puerto, registro, validación runtime y pruebas locales completos; integración real pendiente. | P1-02; Jira P3; runtime P4 |

## Bloque 2 — Razonamiento y evidencia

> Convierte el contexto leído en conclusiones trazables, separa certeza de
> inferencia y evita inventar o repetir trabajo.

| # | Feature de P1 | SPEC | Contrato / datos | Agent Core | Integración | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 | Aplicar el prompt propio y las reglas de WorkPilot | ✅ §9, §10 y §17 | ✅ [`prompt.ts`](../../packages/agent-core/src/workpilot/prompt.ts) exporta `WORKPILOT_ROLE` | ✅ cubre contexto ambiental, lecturas, categorías de razonamiento, aprobación, allowlist y contenido no confiable | ❌ falta componer `SURFACE_RULES + WORKPILOT_ROLE` y ejecutarlo en el modelo/runtime de P4 | 🟡 invariantes estáticos verificados; falta eval real del modelo con WP-42/WP-57 | 🟡 | 2026-09-12: prompt local completo y validado estáticamente; eval e integración pendientes. | P1-02, P1-03; modelo/runtime P4 |
| P1-04 | Separar hechos, hipótesis e información faltante | ✅ §9 regla 3 | ✅ [`reasoning.ts`](../../packages/agent-core/src/workpilot/reasoning.ts) define y valida `ReasoningCandidate` y `SeparatedReasoning` | ✅ `parseReasoningCandidates` valida JSON runtime y `separateReasoning` particiona o rechaza conclusiones sin evidencia | ❌ falta enlazar la salida real del modelo y su representación P2 | ✅ cubre las tres categorías, referencias desconocidas, namespaces reservados y conclusiones sin evidencia | 🟡 | 2026-09-12: separación y validación local completas; runtime/UI pendientes. | P1-01–P1-03; runtime P4; UI P2 |
| P1-05 | Adjuntar evidencia trazable a cada conclusión relevante | ✅ §7 y §9 regla 2 | ✅ [`action-plan.ts`](../../packages/agent-core/src/workpilot/action-plan.ts) define `Evidence`, provenance exclusiva, URLs HTTP(S) y flag `potential_prompt_injection` | ✅ [`reasoning.ts`](../../packages/agent-core/src/workpilot/reasoning.ts) deriva evidencia del contexto; el plan valida referencias, IDs y scope del ticket | ❌ faltan IDs/URLs Jira reales de P3, renderizado P2 y eval heurístico con el modelo | ✅ cubre comentario malicioso, falsos positivos básicos, referencias desconocidas, evidencia cross-ticket y URLs inseguras | 🟡 | 2026-09-12: trazabilidad, scope checks y señal anti-injection verificados localmente; integración real pendiente. | P1-03, P1-04; Jira P3; UI P2 |
| P1-07 | Evitar acciones innecesarias, duplicadas o sin responsable sustentado | ✅ §9 reglas 4–6 y §16 | ✅ [`context.ts`](../../packages/agent-core/src/workpilot/context.ts) incorpora `assignmentCandidates`; [`policy.ts`](../../packages/agent-core/src/workpilot/policy.ts) tipa rechazos | ✅ `applyActionPolicy` bloquea duplicados existentes/intra-plan, conflictos, no-op, `before` obsoleto, evidencia marcada y responsable sin campo Jira autoritativo; además canonicaliza `before` y nombre | ❌ P3 debe poblar candidatos desde campos Jira y repetir las validaciones críticas server-side | ✅ cubre WP-42, similitud semántica, duplicado intra-plan, Unicode, autoridad de asignación y `before` obsoleto | 🟡 | 2026-09-12: guardas locales completas para los casos auditados; validación real y criterio de producto pendientes. | P1-03–P1-06; contrato Jira P3 |

## Bloque 3 — Plan y seguimiento

> Produce la propuesta estructurada consumida por UI/executor y responde sobre
> faltantes a partir de una lectura actual, no de memoria de chat.

| # | Feature de P1 | SPEC | Contrato / datos | Agent Core | Integración | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-06 | Generar un `ActionPlan` válido, con acciones limitadas y evidencia | ✅ §7, §8 y §17 | 🟡 [`action-plan.ts`](../../packages/agent-core/src/workpilot/action-plan.ts) implementa el contrato candidato, aún sin congelar con P2/P3 | ✅ [`planner.ts`](../../packages/agent-core/src/workpilot/planner.ts) valida input desconocido, contexto, reasoning, acciones, expiración y genera un plan parseado | ❌ falta handoff contractual y validación independiente en P2/P3 | ✅ cubre plan válido, allowlist, referencias, scope, timestamps, expiración, relojes inválidos y JSON malformado | 🟡 | 2026-09-12: generador y validación runtime completos localmente; contrato compartido pendiente. | P1-04, P1-05; consumidores P2/P3 |
| P1-08 | Responder «¿qué falta?» releyendo el estado real | ✅ §4, §15, §23 y §25 | 🟡 [`follow-up.ts`](../../packages/agent-core/src/workpilot/follow-up.ts) define `MissingInformationFollowUp`, pero todavía no recibe estado persistido de ejecución | 🟡 `refreshMissingInformation` fuerza una lectura nueva, valida reasoning y detecta cambio de snapshot; falta reconciliar ejecuciones/read-back | ❌ faltan Jira real, persistencia y resultados de ejecución de P3, además del analyzer runtime de P4 | ✅ prueba dos lecturas, cambio de snapshot, comentario nuevo y reloj inválido | 🟡 | 2026-09-12: mecánica de relectura verificada; reconciliación y runtime pendientes. | P1-02–P1-05; persistencia P3; runtime P4 |

## Bloque 4 — Verificación del agente

> Demuestra que el mismo prompt produce propuestas distintas y seguras para
> los dos tickets canónicos.

| # | Feature de P1 | SPEC | Contrato / datos | Agent Core | Integración | Tests | Status | Progress | Depends On |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-09 | Probar comportamiento con WP-42 y WP-57 | ✅ §16, §17 y §23 | 🟡 [`fixtures.ts`](../../packages/agent-core/src/workpilot/testing/fixtures.ts) versiona ambos contextos locales; falta cotejarlos con Jira real | 🟡 [`memory-read-port.ts`](../../packages/agent-core/src/workpilot/testing/memory-read-port.ts) permite pruebas deterministas, pero no ejecuta el prompt/modelo real | ❌ faltan tickets Jira, runtime y Golden Path integrado | 🟡 [`workpilot.test.ts`](../../packages/agent-core/src/workpilot/workpilot.test.ts) pasa 15/15 localmente; falta demostrar el mismo prompt/modelo sobre ambos tickets reales | 🟡 | 2026-09-12: fixtures y suite local completos; eval de modelo e integración real pendientes. | P1-01–P1-08; Jira P3; modelo y E2E P4 |

---

## Contratos y fuentes → Features

> P1 no posee tablas de base de datos. Este índice inverso reemplaza el mapa
> `DB Tables → Features` del formato general y muestra los datos y contratos que
> atraviesan el scope del agente.

| Recurso o contrato | Features que lo usan | Owner primario | Estado |
| --- | --- | --- | --- |
| Ticket seleccionado | P1-02, P1-08 | P2 provee; P1 consume | 🟡 `SelectedTicket` y `workPilotAgentContextValue` validados; conexión P2 pendiente |
| `WorkContext` y `AssignmentCandidate` | P1-01–P1-08 | Compartido P1/P3 | 🟡 contrato y parsers implementados; mapping y congelación con P3 pendientes |
| Issue, comments, relations, project y subtasks read-only | P1-03–P1-09 | P3 provee; P1 consume | 🟡 puerto, validación y adapter en memoria completos; Jira real y registro runtime pendientes |
| `ReasoningCandidate` / `MissingInformation` | P1-04, P1-06, P1-08, P1-09 | P1 define; P4 produce | 🟡 validación local implementada; salida real del modelo pendiente |
| `Evidence` y flags anti-injection | P1-05–P1-09 | P1 | 🟡 generación y validación locales completas; IDs reales y evaluación con el modelo pendientes |
| `ActionPlan` / `Action` | P1-04–P1-09 | P1 define; P2/P3 consumen | 🟡 contrato candidato y validación runtime implementados; acuerdo P2/P3 pendiente |
| Resultado persistido de ejecución | P1-08, P1-09 | P3 provee; P1 consume | ❌ ausente |
| Fixtures WP-42 y WP-57 | P1-07–P1-09 | Coordinación P1/P3/P4 | 🟡 versionadas y cubiertas localmente; Jira real y eval del modelo pendientes |

## Gaps externos pendientes

No se identifican gaps críticos abiertos dentro del núcleo local cubierto por la
suite actual. Para cerrar P1 permanecen estos checkpoints compartidos:

1. P2 debe conectar `SelectedTicket`/`WorkContext` al `useAgentContext` real y
   verificar ausencia, selección y cambio WP-42 → WP-57.
2. P3 debe implementar `WorkPilotReadPort`, definir `snapshotVersion`, poblar
   `assignmentCandidates` exclusivamente desde campos Jira autorizados, aplicar
   timeout del proveedor y confirmar la estrategia `get_issue` frente a
   `get_subtasks`.
3. P4 debe componer `SURFACE_RULES + WORKPILOT_ROLE`, registrar sólo las
   herramientas read-only y entregar JSON desconocido a la validación runtime.
4. P1/P2/P3 deben congelar el contrato compartido. La implementación agrega
   `evidence`, `hypotheses`, objetos estructurados de missing information,
   `assignmentCandidates`, flags de evidencia y `slackDraft` opcional respecto
   de los ejemplos iniciales del plan.
5. El equipo debe auditar el criterio anti-injection y de evidencia suficiente:
   una fuente marcada no puede sustentar acciones, pero la relevancia semántica
   final requiere evaluación con el modelo real.
6. P3/P4 deben suministrar a «¿qué falta?» el estado persistido de ejecución,
   read-back y reconciliación; hoy P1 sólo relee Jira y compara snapshots.
7. WP-42 y WP-57 locales deben cotejarse con tickets Jira reales y ejecutarse con
   el mismo prompt/modelo para demostrar propuestas distintas y seguras.
8. La rama integrada debe incorporar el toolchain del starter y ejecutar
   typecheck, tests y Golden Path sin depender del repositorio hermano.

## Orden sugerido de cierre e integración

1. Auditar y congelar los contratos compartidos con P2/P3.
2. Conectar ticket ambiental y tools Jira reales con P2/P3/P4.
3. Ejecutar evals del mismo prompt/modelo con WP-42 y WP-57 reales.
4. Integrar persistencia/read-back al follow-up «¿qué falta?».
5. Cerrar typecheck, suite y Golden Path en la rama de integración.

## Verificación local del corte

| Check | Resultado | Alcance |
| --- | --- | --- |
| TypeScript 5.7 `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | ✅ PASS | Todo `packages/agent-core/src/workpilot/`, incluida la suite |
| Suite compilada temporalmente + `node --test` | ✅ 15/15 | Contratos, tools, reasoning, evidencia, policy, planner, follow-up y fixtures |
| `git diff --check` | ✅ PASS | Working tree de P1 |
| Integración P2/P3/P4 y eval del modelo | ❌ pendiente | Requiere los checkpoints externos anteriores |

## Estado global

| Status | # features | % |
| --- | ---: | ---: |
| ✅ scope completo | 0 | 0% |
| 🟡 parcial | 9 | 100% |
| 🔴 gap crítico | 0 | 0% |
| 🔧 WIP | 0 | 0% |

## Criterios de cierre de P1

P1 queda completo cuando las nueve filas están implementadas y verificadas, y
se cumplen como mínimo estos comportamientos:

- el agente recibe el ticket activo sin pedir al usuario que copie su clave;
- todas las conclusiones relevantes tienen evidencia y separan hechos de
  hipótesis;
- WP-42 no duplica la subtarea de implementación existente ni inventa owner;
- WP-57 genera una propuesta distinta y acorde a su estado;
- instrucciones maliciosas en comentarios se tratan como datos, no autoridad;
- `ActionPlan` valida contra el contrato acordado con P2/P3;
- «¿qué falta?» fuerza una nueva lectura del estado real.

## Flujo de actualización

1. Antes de empezar, marcar la fila `🔧 WIP` y añadir fecha e intención en
   `Progress`.
2. Actualizar sólo las celdas respaldadas por código, símbolo y test reales.
3. Recalcular el resumen por bloque y el estado global en el mismo cambio.
4. Auditar las capas afectadas con GitNexus cuando el repo tenga índice vigente;
   hasta entonces, usar inventario reproducible con `rg` y citar rutas.
5. Actualizar esta matriz junto con el código de cada feature.
