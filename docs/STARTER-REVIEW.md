# Revisión del starter y trazabilidad de decisiones

Fecha: 12 de septiembre de 2026. Fuente principal: [CopilotKit/agents-everywhere-starter-kit](https://github.com/CopilotKit/agents-everywhere-starter-kit). Se consultaron documentos y archivos de código públicos de `main`; no se ejecutó el starter ni se verificó un SHA. No se revisaron todos los archivos del repositorio.

Documentación preservada localmente: [índice y procedencia](reference/starter-kit/README.md). La copia documental está bajo la [licencia MIT del starter](reference/starter-kit/LICENSE).

## 1. Jerarquía de fuentes

1. Reglas vigentes de la sede para condiciones y entrega del evento; todavía falta identificar la sede del equipo.
2. Starter kit como fuente de verdad sobre su infraestructura, comandos y orientación del hackathon.
3. Instrucciones actuales del equipo: crear WorkPilot, integrar Jira, mandar avisos por Slack, repartir trabajo entre cuatro personas.
4. Conversaciones previas como antecedentes y propuestas; no como confirmación técnica de capacidades.

Antecedentes leídos: [primera conversación](https://chatgpt.com/share/6aa56b17-780c-83e9-b375-7a102088a2e0) y [segunda conversación](https://chatgpt.com/share/6aa56d2f-ab70-83e9-8a8e-204bd365e426).

## 2. Qué conservamos y qué corregimos

| Tema | Conversaciones | Fuente de verdad / decisión |
|---|---|---|
| Idea | Agente que sabe qué está mirando el usuario | Se conserva y se convierte en criterio verificable con dos tickets y el mismo prompt. |
| Web | Usar `apps/web` | Se conserva; el README Web identifica archivos para contexto, UI, aprobación y lecturas. |
| Incidentes | Caso sugerido para WorkPilot | El kit pide reemplazar el escenario de muestra. Proponemos traspaso de tickets bloqueados entre desarrollo y QA, con dataset propio. |
| Ambiguous AI | La primera conversación lo vinculó a interpretar ambigüedad | En el kit es un workspace externo con MCP y registros persistentes. La interpretación de «esto» procede del contexto y del agente. |
| Persistencia | El estado sobrevive al refresh | El ejemplo conserva tareas en Ambiguous y metadatos de aprobación en disco. Eso no prueba historial durable de chat ni soporte Jira. |
| Aprobación | «Dale» podría disparar cambios en el ejemplo narrado | El código Web exige botón de aprobación y ejecución en servidor. No basta una frase de aprobación al agente. |
| Slack | Segunda conversación lo dejaba opcional | La instrucción posterior del equipo lo incluye para avisos. El PRD limita el alcance a envío saliente. |
| Video | Narración de aproximadamente 3 minutos | La documentación del kit pide video de 2 minutos; validar la regla de la sede. |
| Puntuación | Se anticipaban notas de 4–5/5 | No se pronostica puntuación. Se usa evidencia observable para los cuatro criterios del kit. |

## 3. Código inspeccionado y reutilización

| Fuente upstream | Observación verificada | Uso propuesto |
|---|---|---|
| [app-control.tsx](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/web/src/components/app-control.tsx) | Usa `useAgentContext` y `useFrontendTool`; expone selección, propuesta y lecturas de follow-ups. | Reutilizar patrón de contexto del ticket y herramientas de propuesta; reemplazar dominio y datos. |
| [agent.ts](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/packages/agent-core/src/agent.ts) | `makeAgent` crea `BuiltInAgent`, admite prompt propio, configura `maxSteps: 10` y permite deshabilitar workplace MCP. | Conservar fábrica y límites de ejecución; añadir prompt WorkPilot. |
| [index.ts](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/packages/agent-core/src/index.ts) | Distingue exports de servidor y `agent-core/shared` para cliente. | Evitar dependencias de servidor en el bundle cliente. |
| [endpoint CopilotKit](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/web/src/app/api/copilotkit/%5B%5B...path%5D%5D/route.ts) | Fábrica por resolución y `workplace: false`; no registra el listener Channels en Next.js. | Mantener escritura fuera del agente Web; no insertar un listener Slack en la ruta. |
| [followups.ts](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/web/src/lib/server/followups.ts) | Propuestas ligadas a sesión/identidad, expiración, decisión persistida, intentos exclusivos y lectura posterior del registro. | Adaptar estas garantías al plan Jira/Slack; el manejo multiaction es nuevo. |
| [ruta followups](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/apps/web/src/app/api/followups/route.ts) | Usa runtime Node y directorio `WEB_APPROVAL_DIR` o `.data/web-approvals`; conecta Ambiguous cuando está configurado. | Conservar frontera de servidor; sustituir proveedor y ampliar registro de ejecución. |
| [package.json](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/package.json) | Node 22+, workspaces Web/Channel y scripts de desarrollo/verificación documentados por el kit. | Incorporar estructura existente y conservar versiones compatibles. |

La documentación Web también identifica `page.tsx`, `incidents.ts`, `workplace-followups.tsx`, `use-workplace.ts`, `workplace.ts`, `generative-ui.tsx` y `providers.tsx`. Esos destinos sirven para el reparto inicial; sus implementaciones completas no fueron inspeccionadas en esta revisión. Leerlas al incorporar el checkout.

## 4. Matriz de construcción

| Reutilizar | Adaptar | Construir durante el evento |
|---|---|---|
| App Next.js y conexión CopilotKit | Pantalla y contexto de ejemplo → ticket Jira | Adaptador Jira y mapeo de campos reales |
| Fábrica de agente y proveedor | Prompt de incidentes → traspaso de trabajo | Selección de acciones con evidencia y faltantes |
| Patrón de propuesta/aprobación | Follow-up único → plan de acciones | Ejecutor con resultados parciales y reconciliación |
| Lectura posterior y metadatos de intentos | Persistencia de tareas Ambiguous → Jira | Aviso Slack aprobado y recuperación independiente |
| Infraestructura de pruebas/build | Fixtures y tarjetas de ejemplo | Dataset propio, pruebas del flujo y demo |

Jira y el aviso saliente del PRD no aparecen como capacidades listas del flujo Web inspeccionado. Deben validarse con cuentas reales. El PRD no exige mantener Ambiguous como segundo almacén de trabajo; reemplazarlo es una adaptación explícita motivada por Jira.

## 5. Opciones de infraestructura que no bloquean el PRD

- La integración Web de CopilotKit puede empezar con el proveedor de modelo existente. Intelligence añade capacidades de conversación administrada y requiere su propio onboarding; no se incluye en v0.1.
- Si el producto evoluciona a agente conversacional en Slack, evaluar `apps/channel`, su proceso separado y la skill documentada por el starter antes de modificarlo. El aviso saliente actual no obliga a abrir esa segunda superficie.
- No agregar Exa para justificar investigación interna: el kit lo presenta para evidencia pública, no acceso a logs privados.
- No actualizar paquetes del runtime para redactar o ejecutar este plan; conservar la pareja compatible y la deduplicación documentada.

## 6. Evidencia de los criterios del hackathon

Los nombres provienen del [overview del kit](reference/starter-kit/hackathon-overview.md). Esta tabla es nuestra planificación de evidencia, no una evaluación anticipada.

| Criterio | Evidencia WorkPilot | Responsable |
|---|---|---|
| Core Requirements & Functionality | Ticket real → agente → plan → aprobación → cambios Jira → aviso Slack → lectura posterior. | P3/P4 |
| Innovation & Theme Alignment | El mismo «revisá esto» genera acciones distintas según ticket, comentarios y dependencias; sin contexto se pierde esa selección. | P1/P2 |
| Technical Execution & Integration | Doble aprobación, rechazo, resultado incierto, fallo parcial y recuperación verificables. | P3/P4 |
| Usefulness & Agentic Experience | El líder técnico obtiene un traspaso listo con evidencia, menos trabajo repetido y control de efectos externos. | P1/P2 |

## 7. Estado de esta entrega

Se crearon PRD, backlog y referencias documentales. No se incorporó ni ejecutó el código del starter, no se configuraron cuentas, no se enviaron mensajes y no se escribieron tickets. El primer bloque de TASKS cubre esas verificaciones e integración.
