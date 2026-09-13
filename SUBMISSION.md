# WorkPilot — submission preparada

## Descripción

WorkPilot ayuda a un líder técnico a preparar el handoff de un ticket de Jira desde un workspace web. El ticket seleccionado aporta el contexto; el diseño combina propuesta revisable, aprobación humana, escrituras verificadas en Jira y aviso privado de Slack.

Estado actual: chat WorkPilot, prompt, herramientas de lectura/propuesta, políticas P1 y seguimiento integrados. Flujo local verificable con proveedores simulados. Falta evaluar el modelo configurado y verificar proveedores reales; no afirmar Golden Path real completo. Ver docs/AI-FLOW.md.

## Construcción y atribución

Heredado: starter Agents, Everywhere, Next.js, infraestructura CopilotKit, modelo y ejemplos de incidentes. Ver docs/STARTER-REVIEW.md.

Trabajo propio versionado: UI WorkPilot, contrato ActionPlan, adaptadores Jira, executor, integración de aprobación, persistencia, Slack saliente y QA. El equipo debe confirmar cuáles piezas fueron creadas durante el evento; no se certifica elegibilidad ni fechas desde el código.

CopilotKit mantiene contexto de página y herramientas frontend. El modelo OpenAI/OpenRouter está conectado al comportamiento WorkPilot; su evaluación real requiere credenciales. Jira y Slack son servicios del producto; no se describen como sponsors del evento.

## Checklist final

- [ ] Confirmar elegibilidad y contribuciones del equipo.
- [x] Integrar P1 e invocación desde el workspace.
- [x] npm run verify:release pasa (128 tests, build, e2e HTTP) con Ollama workpilot-qwen3:4b.
- [x] Preflight live: todas las checks pasan excepto JIRA_WRITES_ENABLED (opt-in intencional).
- [x] Modelo configurado: MODEL_PROVIDER=ollama, MODEL=workpilot-qwen3:4b, loopback 127.0.0.1:11434.
- [ ] Aprobar una prueba explícita con Jira/Slack reales y mostrar read-back.
- [ ] Probar rechazo, doble aprobación, snapshot obsoleto, Slack fallido y refresh.
- [ ] Grabar video <=2 minutos siguiendo docs/P4-DEMO.md.
- [ ] Confirmar URL pública del repo, video y post.
- [ ] Confirmar deadline, ciudad y requisitos del portal local.
- [ ] Revisar secretos y publicar/subir entrega por el equipo.

## Texto para el portal, después de validar

WorkPilot prepara el próximo paso de un ticket de Jira sin copiar su contexto a un chat. Muestra evidencia y acciones propuestas; el usuario decide. Cada cambio aprobado se verifica en Jira antes de notificar por Slack, y el estado se conserva para continuar el trabajo.

Repo: pendiente de confirmar acceso público. Video: pendiente de grabación. Post: pendiente. No se ha publicado ni enviado esta submission.

## Evidencia para el jurado

| Criterio | Evidencia a reunir |
| --- | --- |
| Core Requirements & Functionality | Flujo real completo, P1 → propuesta → aprobación → Jira → Slack |
| Innovation & Theme Alignment | Mismo prompt con tickets distintos y contexto ambiental |
| Technical Execution & Integration | Read-back, persistencia y manejo de fallo parcial |
| Usefulness & Agentic Experience | Control humano y handoff con siguientes pasos claros |
