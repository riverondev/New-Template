# WorkPilot

Workspace web para revisar tickets de Jira, aprobar acciones y comunicar el resultado por Slack. Conserva Web + Agent Core del starter. P4 conecta la UI de P2 con el executor de P3; el razonamiento y la generación de planes de P1 siguen pendientes.

## Quickstart

Requiere Node.js 22+ y npm. Desde un checkout de esta rama:

```sh
npm ci
npm run dev:rehearsal
```

Abrí http://127.0.0.1:3100. Seleccioná WP-42, pulsá **Cargar propuesta de ensayo**, revisá las acciones y el texto Slack y aprobá. Actualizá la página para recuperar los resultados. Probá WP-57 y Rechazar.

El ensayo usa proveedores locales simulados y planes deterministas, identificados en pantalla. No usa IA ni credenciales y no contacta Jira/Slack. El estado queda en `apps/web/.data/workpilot/rehearsal`. Para otro ensayo independiente podés configurar un nuevo `WORKPILOT_DATA_DIR`; no borres registros de ejecuciones reales.

## Jira y Slack reales

Copiá `.env.example` a `.env`. Configurá:

- `WORKPILOT_DEMO=false`.
- `JIRA_BASE_URL`: origen HTTPS de Jira Cloud.
- `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`.
- `JIRA_SUBTASK_ISSUE_TYPE_ID`: ID real de un tipo de subtarea habilitado en ese proyecto.
- `JIRA_WRITES_ENABLED=true` únicamente para habilitar las escrituras aprobadas.
- `SLACK_BOT_TOKEN` y `SLACK_RECIPIENT_USER_ID`: usuario fijo de App Home.
- `WORKPILOT_DATA_DIR`: directorio persistente absoluto recomendado.
- Variables de modelo para la futura integración P1. No se utiliza el modelo durante el ensayo.

La cuenta Jira necesita lectura del proyecto, comentarios, asignación, edición y creación de subtareas según las acciones propuestas. Slack requiere `chat:write` y la pestaña Messages de App Home habilitada en modo solo lectura; ver [contrato Slack](docs/SLACK-CONTRACT.md).

```sh
npm run preflight
npm run preflight -- --live
npm run dev:web
```

El preflight normal comprueba configuración y disco. `--live` solo consulta identidad/proyecto Jira y autenticación Slack; no escribe ni envía avisos. No comprueba razonamiento P1 ni reemplaza una demo real.

La UI real lee el ticket seleccionado. P1 debe producir y guardar un ActionPlan con el contrato de [integración](docs/P4-HANDOFF.md); hasta entonces no hay chat WorkPilot ni generación automática. No se presenta el agente de incidentes heredado como WorkPilot.

## QA y build

```sh
npm run verify
npm run build --workspace web
npm run test:e2e
```

`verify` hace typecheck y tests unitarios/de integración. `test:e2e` arranca el build Next en 127.0.0.1:3197 y comprueba las rutas HTTP, aprobación, efectos simulados, doble envío, rechazo y reinicio del servidor. Requiere el build previo; no necesita Playwright. No sustituye QA visual ni integración real.

Estado de la revisión actual: TypeScript y build web completados (exit 0); tests intentados pero bloqueados al iniciar tsx por `uv_os_get_passwd ENOMEM` en el sandbox de Windows. No se certifican tests/E2E ni clean clone. Ver [estado P4](docs/feature-matrix/p4-integration-slack-qa-release.md).

## Límites operativos

El MVP es local, de un operador, vinculado a loopback. Usa cookie HttpOnly y SameSite, control de Origin, sesiones persistidas y propiedad de planes. No es autenticación multiusuario para desplegar públicamente.

Jira se escribe solo al aprobar un plan inmutable. Cada acción se lee de nuevo; un fallo detiene las restantes. Slack solo se envía después de verificar todas las acciones y nunca toma el destinatario del plan. Reintentar Slack no escribe en Jira. Los resultados inciertos no se reenvían.

Los registros y locks se persisten en disco. Un cierre abrupto deja el intento bloqueado: inspeccionar el resultado externo antes de desbloquear; no hay recuperación destructiva ni reintento automático. La sesión dura 24 h; conservar el perfil del navegador durante el ensayo.

## Entrega

[Guion y runbook de demo](docs/P4-DEMO.md) · [Submission preparada](SUBMISSION.md) · [Handoff a P1](docs/P4-HANDOFF.md).

El video final, la prueba con servicios reales, la respuesta «¿qué falta?» y la publicación/submission externa siguen pendientes. No se han enviado mensajes reales ni publicado artefactos.

Starter incorporado: ver [revisión del starter](docs/STARTER-REVIEW.md). La autoría y fechas de construcción durante el evento deben ser confirmadas por el equipo.
