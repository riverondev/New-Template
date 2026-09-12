# P4 → P1: contrato de integración

P4 no modifica `packages/agent-core/src/workpilot/{prompt,context,tools,action-plan}.ts`. Solo publica el subpath `agent-core/workpilot/action-plan` para resolver imports de P2/P3 sin rutas relativas rotas. P1 mantiene el razonamiento, prompt, herramientas de lectura, generación de ActionPlan y respuesta «¿qué falta?».

## Puntos disponibles

- `GET /api/workpilot/session`: cookie local, modo y flags.
- `GET /api/workpilot/context?issueKey=WP-42`: contexto Jira real y snapshot calculado por el servidor.
- `POST /api/workpilot/plans`: recibe ActionPlan para revisión. No escribe en Jira. Validación estricta del shape, destino, TTL y snapshot; no permite sobrescribir el ID.
- `GET /api/workpilot/plans?issueKey=WP-42`: último plan de la sesión, resultados y estado Slack persistidos, incluido rechazado/ejecutado.
- `POST /api/workpilot/approve`: solo botón humano; body `{ planId, version }`.
- `POST /api/workpilot/reject`: misma referencia, sin llamadas externas.
- `POST /api/workpilot/retry-slack`: solo retry manual del aviso. Usa el plan persistido; no acepta texto ni destino alternativos.
- `POST /api/workpilot/rehearsal`: fixture P4, solo con `WORKPILOT_DEMO=true`.

Los POST requieren sesión válida, mismo Origin y JSON. No existe `x-workpilot-user` como autenticación. El agente nunca recibe herramientas approve/reject/retry ni clientes de escritura.

## Frontend / runtime

`WorkpilotWorkspace` registra `useAgentContext` con el ticket actual, plan y ejecución. Registra `workpilot_store_plan` con `useFrontendTool` para persistir propuestas del agente; el servidor conserva el control de ejecución. El handler rechaza un plan de otro ticket seleccionado.

El endpoint CopilotKit heredado conserva su factory por invocación y `workplace:false`. P1 debe conectar su prompt/herramientas al runtime e incorporar la interfaz de chat al workspace. No reutilizar el prompt de incidentes como producto final. El runtime y los módulos P1 no se sustituyen por fixtures P4.

## Reglas del plan

Usar el snapshot devuelto por context, ID único, versión positiva, fechas ISO y TTL <= `PLAN_TTL_MINUTES`. Estado inicial `pending`; cada action tiene ID único y evidencia. Tipos permitidos: add_comment, create_subtask, assign_issue y set_priority. El servidor valida el payload completo y que todos los destinos coincidan con issueKey.

`assign_issue.payload.user` y `create_subtask.payload.assignee` son accountId reales de Jira Cloud, no displayName. `slackDraft.channel` se acepta por compatibilidad con P3 y se ignora: producir preferentemente solo text. No inventar IDs/URLs posteriores: la UI muestra los providerId devueltos por el executor.

El snapshot incluye comentarios, relaciones/subtareas y sus estados. Un cambio relevante exige releer y proponer de nuevo. Los resultados inciertos bloquean nuevas propuestas hasta reconciliación manual.

## Pendientes de aceptación conjunta

1. P1 genera propuestas distintas para WP-42 y WP-57 desde las lecturas reales.
2. El usuario revisa evidencia; solo la aprobación visual ejecuta.
3. Jira real conserva cambios, Slack recibe un único aviso en App Home.
4. Refresh recupera resultados; «¿qué falta?» relee Jira.
5. Ejecutar QA, grabar video final y confirmar submission.
