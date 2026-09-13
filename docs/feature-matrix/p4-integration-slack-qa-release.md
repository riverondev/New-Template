# P4 — Integración / Slack / QA / Release

Actualización 2026-09-12 sobre develop, después de integrar sebas-dev.
La revisión encontró Slack como stubs, aprobación simulada en P2, imports inválidos,
persistencia en memoria y API que confiaba en un header de usuario. Se implementó
la integración sin modificar los módulos de comportamiento de P1.

| Tarea | Estado actual | Evidencia / pendiente |
| --- | --- | --- |
| Incorporar starter | Implementado previamente | Web + Agent Core; manifiestos y lockfile |
| Ejecutar checkout | Checkout actual disponible | Clean clone no certificado |
| Configurar entorno | Implementado | .env.example, npm run preflight, modo de ensayo |
| Adaptar runtime | Punto de integración preparado | Contexto CopilotKit y herramienta de propuesta; falta runtime P1 |
| Integrar Agent + Frontend + Backend | P2/P3/P4 conectados | APIs y UI real; Agent pendiente de P1 |
| Adaptador Slack | Implementado | chat.postMessage, destinatario fijo App Home, errores controlados |
| Slack notification | Implementado | Solo tras Jira verificado; persistencia; retry manual independiente |
| Pruebas end-to-end | Suite escrita, no certificada | integration.test.ts y npm run test:e2e (Next HTTP + reinicio) |
| Build | Completado | npm run build --workspace web, exit 0; advertencia heredada de dependencia dinámica de CopilotKit |
| Quickstart | Documentado | README; modo ensayo sin credenciales y modo live |
| Submission | Preparada | SUBMISSION.md; publicación no realizada |
| Video | Guion preparado | Falta grabación real con P1 y proveedores |
| Ensayo de demo | Runbook y fixtures preparados | Falta ejecución visual y aceptación real |

## Alcance implementado

- Import compartido estable de ActionPlan, sin modificar prompt/context/tools de P1.
- UI sin temporizador de éxito; consulta contexto y planes persistidos.
- Validación de sesión local, Origin, propiedad, payload, TTL, snapshot y destinos.
- Persistencia atómica en disco para planes, ejecuciones, resultados, idempotencia y Slack.
- Locks persistentes entre procesos. Una interrupción bloquea replay; requiere inspección.
- Jira Cloud usa accountId y tipo real de subtarea configurado; sin reintento ciego de escrituras.
- Verificación por ID/campos; fallo parcial detiene acciones restantes y bloquea Slack.
- Slack sending/succeeded/failed/uncertain/blocked independiente de Jira.
- Ensayo determinista aislado: nunca usa credenciales ni se presenta como razonamiento.

## Verificación y límites

Se completaron typecheck y build web (exit 0), y se intentó npm run verify. El runner tsx falla antes de los
tests con uv_os_get_passwd ENOMEM en el sandbox Windows. Las solicitudes de
instalar Playwright y ejecutar verify fuera del sandbox fueron rechazadas.
La suite HTTP no requiere dependencias nuevas. Por pedido del usuario, la
verificación se redujo al mínimo; no se afirma E2E ni Golden Path real probado.

Faltan P1, credenciales/prueba explícita con servicios reales, checkout limpio,
QA visual, video final y publicación. P4 no puede cerrar estos gates como
completos usando fixtures.

## Handoff

Ver [P4-HANDOFF.md](../P4-HANDOFF.md), [P4-DEMO.md](../P4-DEMO.md) y
[README](../../README.md). Mantener los cambios de comportamiento de P1 en sus
propios módulos; el fixture P4 no los reemplaza.
