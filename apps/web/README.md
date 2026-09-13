# WorkPilot Web

Aplicación Next.js con CopilotKit React y el runtime compartido Agent Core.

Seguí el [quickstart de WorkPilot](../../README.md). El flujo activo usa Jira como fuente de verdad y Slack como aviso saliente. La documentación de incidentes/Ambiguous del starter se conserva en [reference](../../docs/reference/starter-kit/apps/web/README.md).

## Puntos de integración

- `src/components/workpilot/workpilot-workspace.tsx`: contexto de página y herramientas frontend.
- `workpilot-chat.tsx`: conversación por ticket, streaming, cancelación y accesos rápidos.
- `workpilot-panel.tsx`: propuesta, evidencia y aprobación humana.
- `api/copilotkit/[[...path]]`: agente con SURFACE_RULES + WORKPILOT_ROLE.
- `GET /api/workpilot/agent-context`: lectura Jira actual, evidencia y resultados persistidos.
- `POST /api/workpilot/propose`: candidatos del modelo; validación y construcción del plan en el servidor.
- `POST /api/workpilot/approve`: ejecución exclusiva del botón humano.
- `src/lib/server/workpilot/agent-proposal.ts`: adaptación Jira/P1, políticas, metadata y payloads.
- `agent-core/workpilot/proposal-schema`: contrato compartido de la herramienta de propuesta.

El agente no registra herramientas approve/reject/retry. Una aceptación por chat nunca ejecuta. El modo de ensayo simula Jira/Slack y permite una propuesta fija sin IA; el chat siempre usa el modelo configurado.

Desde la raíz, ejecutar `npm run verify`, `npm run build --workspace web` y `npm run test:e2e`. La prueba real requiere credenciales del modelo y autorización explícita antes de modificar Jira o enviar Slack.
