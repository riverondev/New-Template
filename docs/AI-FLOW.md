# Integración WorkPilot IA

## Flujo implementado

1. El workspace publica el ticket seleccionado con useAgentContext.
2. El chat invoca el agente CopilotKit con el prompt WorkPilot.
3. workpilot_read_context relee Jira y devuelve evidencia canónica, snapshot, plan y resultados de ejecución/Slack.
4. workpilot_propose acepta candidatos de razonamiento y acciones, no un plan arbitrario.
5. El servidor relee Jira y rechaza un snapshot cambiado; aplica generateActionPlan y las políticas P1.
6. El servidor crea IDs, fechas y payloads consistentes y guarda el plan para revisión. No escribe en Jira.
7. El botón humano aprueba. El executor realiza read-back y solo después permite Slack.
8. ¿Qué falta? fuerza una nueva lectura mediante las instrucciones del agente; el resultado incluye la ejecución persistida. La selección se bloquea durante el turno y las herramientas comprueban el ticket antes y después de leer.

La relectura por turno es un comportamiento instruido al modelo y debe evaluarse con el modelo real; la relectura y validación antes de guardar/ejecutar se imponen en el servidor.

## Casos cubiertos localmente

- Candidato del agente → plan persistido → aprobación → Jira/Slack simulados → seguimiento.
- Dos tickets distintos, rechazo y análisis sin acciones.
- Snapshot obsoleto, evidencia inexistente, subtarea duplicada y accountId inventado.
- Asignación verificada por accountId aunque el displayName sea diferente.
- Paginación de comentarios y fallo de una página incompleta.
- Doble aprobación, persistencia tras reinicio, Slack retry independiente y resultado incierto (suite existente).

Los tests inyectan candidatos estructurados; no son respuestas de un modelo real. No afirman calidad semántica ni validación visual del chat.

## Validación real pendiente

Configurá OpenAI en el .env local y reiniciá la app. Primero usar `npm run dev:rehearsal` para evaluar el mismo prompt con WP-42/WP-57 sin escrituras externas. Comprobar lectura de contexto, herramientas ejecutadas, propuesta útil, no duplicación, seguimiento y cambio de ticket.

La prueba con Jira/Slack reales requiere sus credenciales y aprobación humana. No se invocaron servicios reales durante esta implementación. La recuperación operativa de resultados inciertos sigue requiriendo inspección manual.
