# WorkPilot

Workspace web para preparar el handoff de un ticket Jira con IA. El agente recibe el ticket seleccionado, relee Jira, separa hechos/hipótesis/faltantes y prepara una propuesta con evidencia. El usuario revisa y aprueba; el servidor verifica cada cambio en Jira antes de enviar el aviso privado de Slack.

## Inicio

Requiere Node.js 22+.

```sh
npm ci
npm run dev:rehearsal
```

Abrí http://127.0.0.1:3100. El ensayo usa Jira y Slack simulados y aislados en disco. **Cargar propuesta de ensayo** funciona sin modelo; el chat requiere un proveedor configurado.

Para usar OpenAI, copiá `.env.example` a `.env` si todavía no existe y completá `MODEL_PROVIDER=openai`, `OPENAI_API_KEY` y `MODEL` con un modelo habilitado para tu cuenta que soporte herramientas. No reemplaces un `.env` existente ni publiques credenciales. El comando de ensayo carga ese archivo y fuerza proveedores Jira/Slack simulados.

1. Seleccioná WP-42 y pulsá **Preparar propuesta**.
2. Revisá evidencia, acciones y borrador Slack. Solo el botón **Aprobar cambios y aviso** ejecuta.
3. Actualizá la página: el plan y los resultados se recuperan del disco.
4. Pulsá **¿Qué falta?**: el agente relee Jira y los resultados persistidos.
5. Repetí con WP-57 y probá **Rechazar**.

Los análisis sin acciones se muestran sin botón de aprobación. El chat no se persiste al recargar; planes y ejecuciones sí.

## Jira y Slack reales

Configurá `WORKPILOT_DEMO=false`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, `JIRA_SUBTASK_ISSUE_TYPE_ID`, `SLACK_BOT_TOKEN` y `SLACK_RECIPIENT_USER_ID`.
Habilitá `JIRA_WRITES_ENABLED=true` para permitir acciones aprobadas. Recomendamos un `WORKPILOT_DATA_DIR` absoluto persistente.

```sh
npm run preflight
npm run preflight -- --live
npm run dev:web
```

El preflight live solo consulta identidad/proyecto Jira y autenticación Slack; no invoca el modelo ni escribe. Slack usa el usuario fijo de App Home: ver [contrato](docs/SLACK-CONTRACT.md).

## Verificación

```sh
npm run verify
npm run build --workspace web
npm run test:e2e
```

Las pruebas locales usan proveedores simulados. La suite de propuestas atraviesa el contrato del agente, políticas del servidor, persistencia, aprobación, read-back y seguimiento. La suite HTTP arranca el servidor Next de producción. Ninguna certifica por sí sola la calidad de una respuesta real del modelo.

## Límites

MVP local de un operador, vinculado a loopback, con sesiones y controles de Origin. No desplegar públicamente sin agregar autenticación/autorización.

- El modelo solo dispone de lectura y propuesta; nunca de aprobación, Jira writes o envío Slack.
- IDs, tiempos, snapshot, payloads y evidencia del plan se construyen en el servidor.
- Las políticas eliminan acciones sin evidencia, duplicadas o con responsables inventados.
- El adaptador no inventa candidatos de asignación: si Jira no establece un responsable autorizado, se informa el faltante.
- Si una política elimina acciones, se descarta el borrador Slack para no anunciar cambios descartados.
- Jira falla de forma cerrada ante una lectura incompleta. Los comentarios se paginan.
- Resultados inciertos requieren inspección manual; no se repiten escrituras ni se reintenta Slack automáticamente.
- La relevancia semántica de las propuestas y la resistencia a instrucciones maliciosas requieren evaluación con el modelo real.

## Entrega

[Flujo IA y validación](docs/AI-FLOW.md) · [Submission](SUBMISSION.md) · [Origen del starter](docs/STARTER-REVIEW.md).

Los documentos P1/P4 anteriores son cortes históricos. El flujo actual se describe aquí y en AI-FLOW.md. La prueba con servicios reales, video y publicación siguen pendientes.
