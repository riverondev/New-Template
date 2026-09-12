# WorkPilot — submission preparada

## Descripción

WorkPilot ayuda a un líder técnico a preparar el handoff de un ticket de Jira desde un workspace web. El ticket seleccionado aporta el contexto; el diseño combina propuesta revisable, aprobación humana, escrituras verificadas en Jira y aviso privado de Slack.

Estado actual: P2/P3/P4 integrados a nivel de código y modo de ensayo disponible. P1 (razonamiento, generación real de propuestas y respuesta «¿qué falta?») pendiente. No afirmar Golden Path real completo hasta terminar esa integración y verificar proveedores.

## Construcción y atribución

Heredado: starter Agents, Everywhere, Next.js, infraestructura CopilotKit, modelo y ejemplos de incidentes. Ver docs/STARTER-REVIEW.md.

Trabajo propio versionado: UI WorkPilot, contrato ActionPlan, adaptadores Jira, executor, integración de aprobación, persistencia, Slack saliente y QA. El equipo debe confirmar cuáles piezas fueron creadas durante el evento; no se certifica elegibilidad ni fechas desde el código.

CopilotKit mantiene contexto de página y herramientas frontend. El modelo OpenAI/OpenRouter aún requiere la integración P1 para el comportamiento WorkPilot. Jira y Slack son servicios del producto; no se describen como sponsors del evento.

## Checklist final

- [ ] Confirmar elegibilidad y contribuciones del equipo.
- [ ] Completar P1 e invocación desde el workspace.
- [ ] Ejecutar npm run verify, build y test:e2e en entorno sin restricciones.
- [ ] Validar checkout limpio y preflight real.
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
