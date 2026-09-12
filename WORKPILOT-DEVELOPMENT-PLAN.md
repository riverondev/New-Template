# WorkPilot --- Plan Maestro de Desarrollo del Agente

**Versión:** 1.0\
**Fecha:** 12 de septiembre de 2026\
**Equipo:** 4 personas\
**Base:** PRD.md + TASKS.md + STARTER-REVIEW.md del proyecto
New-Template

------------------------------------------------------------------------

## 1. Objetivo del proyecto

**WorkPilot es un agente integrado en un workspace web que entiende el
ticket de Jira que el usuario está viendo, investiga qué impide avanzar
y prepara el trabajo para el siguiente responsable. Con aprobación
humana, actualiza Jira y comunica el resultado por Slack.**

### Usuario inicial

Líder técnico de un equipo de desarrollo que necesita preparar el
traspaso de un ticket bloqueado hacia otro compañero o QA.

### Problema

El estado formal de Jira no siempre refleja:

-   decisiones tomadas en comentarios;
-   dependencias;
-   trabajo ya realizado;
-   información que todavía falta;
-   qué debe hacer la siguiente persona.

Preparar un handoff requiere releer el ticket, interpretar el contexto,
decidir próximos pasos, crear seguimiento y avisar al equipo.

### Resultado esperado

WorkPilot debe producir:

1.  una comprensión contextual del ticket;
2.  hallazgos sustentados en evidencia;
3.  información faltante claramente identificada;
4.  un plan de acciones concreto;
5.  una propuesta visible y revisable;
6.  aprobación humana antes de escribir;
7.  cambios reales y verificables en Jira;
8.  un aviso verificable en Slack;
9.  un registro persistente de lo ejecutado;
10. capacidad de responder posteriormente a «¿qué falta?».

------------------------------------------------------------------------

# 2. Principio central del producto

> **El usuario no debería tener que copiar el contexto de Jira al
> agente. WorkPilot ya está dentro del contexto de trabajo.**

El ticket seleccionado representa el contexto ambiental.

El agente debe saber cuál es el ticket activo sin obligar al usuario a
escribir su clave.

Ejemplo:

``` text
Usuario selecciona:
WP-42 — Validación de checkout bloqueada

Usuario:
"Revisá esto y dejalo listo para el equipo."

WorkPilot:
- identifica WP-42;
- lee datos relevantes de Jira;
- analiza comentarios y dependencias;
- detecta faltantes;
- propone acciones;
- espera aprobación.
```

------------------------------------------------------------------------

# 3. Alcance del MVP

## Incluido

-   Jira como sistema de trabajo y fuente de verdad.
-   Slack como canal de aviso saliente.
-   Workspace web como superficie principal.
-   Ticket seleccionado como contexto.
-   Lectura de descripción, comentarios, relaciones y campos relevantes.
-   Detección de hechos, hipótesis y faltantes.
-   Evidencia trazable.
-   Propuesta estructurada.
-   Aprobación/rechazo humano.
-   Escrituras limitadas en Jira.
-   Verificación posterior de las escrituras.
-   Aviso a Slack después de verificar Jira.
-   Persistencia de propuestas y ejecuciones.
-   Prevención de duplicados.
-   Invalidación de planes obsoletos.
-   Manejo de fallos parciales.
-   Consulta posterior de próximos pasos.

## Fuera del MVP

-   Extensión de navegador.
-   Aplicación embebida dentro de Jira.
-   Bot conversacional en Slack.
-   Webhooks de Jira.
-   Vigilancia automática.
-   Recordatorios recurrentes.
-   Monitoreo permanente.
-   Despliegues o rollbacks.
-   Cierre automático de tickets.
-   Diagnóstico de producción.
-   Mobile.
-   Voz.
-   OAuth multiempresa.
-   Copia completa de Jira.
-   Historial durable completo del chat.

**Regla:** no agregar una funcionalidad fuera del MVP si pone en riesgo
el Golden Path.

------------------------------------------------------------------------

# 4. Golden Path

Este recorrido es la prioridad absoluta del equipo.

``` text
1. Usuario abre WorkPilot.
        ↓
2. Selecciona un ticket de Jira.
        ↓
3. Usuario dice:
   "Revisá esto y dejalo listo para el equipo."
        ↓
4. WorkPilot identifica el ticket activo.
        ↓
5. WorkPilot consulta Jira.
        ↓
6. Analiza comentarios, dependencias y trabajo existente.
        ↓
7. Distingue:
   hechos / hipótesis / faltantes.
        ↓
8. Genera ActionPlan.
        ↓
9. UI muestra evidencia y cambios propuestos.
        ↓
10. Usuario revisa.
        ↓
11. Usuario aprueba.
        ↓
12. Servidor valida sesión + versión + snapshot + destino.
        ↓
13. Servidor ejecuta las acciones aprobadas.
        ↓
14. WorkPilot verifica Jira mediante read-back.
        ↓
15. WorkPilot envía el aviso aprobado a Slack.
        ↓
16. Registra resultados.
        ↓
17. Usuario refresca.
        ↓
18. Usuario pregunta:
    "¿Qué falta?"
        ↓
19. WorkPilot relee el estado real y responde.
```

------------------------------------------------------------------------

# 5. Arquitectura objetivo

``` text
                         ┌──────────────────┐
                         │       JIRA       │
                         │  Source of Truth │
                         └────────┬─────────┘
                                  │
                             Jira REST API
                                  │
                                  ▼
┌─────────────────────────────────────────────────────┐
│                 WORKPILOT WEB                        │
│                                                     │
│  ┌────────────────┐      ┌────────────────────────┐ │
│  │ Ticket Context │      │ WorkPilot Agent        │ │
│  │                │─────▶│                        │ │
│  │ WP-42          │      │ Reasoning              │ │
│  │ status         │      │ Tool selection         │ │
│  │ comments       │      │ ActionPlan generation  │ │
│  │ dependencies   │      └───────────┬────────────┘ │
│  └────────────────┘                  │              │
│                                      ▼              │
│                         ┌────────────────────────┐  │
│                         │ Proposal UI             │  │
│                         │ Evidence                │  │
│                         │ Before / After          │  │
│                         │ Approve / Reject        │  │
│                         └───────────┬────────────┘  │
└────────────────────────────────────┼────────────────┘
                                     │
                              Server approval
                                     │
                                     ▼
                         ┌────────────────────────┐
                         │ Server Executor        │
                         │                        │
                         │ validation             │
                         │ idempotency            │
                         │ persistence             │
                         │ reconciliation         │
                         └───────────┬────────────┘
                                     │
                         ┌───────────┴───────────┐
                         ▼                       ▼
                      JIRA                    SLACK
                  real changes            notification
```

------------------------------------------------------------------------

# 6. Separación de responsabilidades

## Agent

El agente:

-   interpreta la solicitud;
-   identifica el ticket activo;
-   consulta herramientas de lectura;
-   analiza el contexto;
-   encuentra evidencia;
-   distingue hechos de hipótesis;
-   identifica faltantes;
-   decide qué acciones son necesarias;
-   genera una propuesta estructurada.

El agente **NO ejecuta directamente escrituras externas**.

## Server Executor

El servidor:

-   recibe la aprobación;
-   valida sesión;
-   valida versión del plan;
-   valida expiración;
-   valida snapshot;
-   valida destino;
-   ejecuta solamente acciones aprobadas;
-   registra resultados;
-   evita duplicados;
-   verifica Jira;
-   coordina Slack;
-   maneja fallos parciales.

## Frontend

La UI:

-   muestra contexto;
-   muestra evidencia;
-   muestra propuesta;
-   permite inspeccionar cambios;
-   permite aprobar/rechazar;
-   muestra estado por acción;
-   muestra fallos sin mensajes falsos;
-   recupera el estado después de refresh.

------------------------------------------------------------------------

# 7. Contratos principales

## WorkContext

``` typescript
type WorkContext = {
  issueKey: string
  summary: string
  status: string
  priority: string
  assignee?: string
  comments: Comment[]
  relatedIssues: RelatedIssue[]
  existingSubtasks: Subtask[]
  snapshotVersion: string
  fetchedAt: string
}
```

## Evidence

``` typescript
type Evidence = {
  sourceType: "issue" | "comment"
  issueKey: string
  commentId?: string
  excerpt: string
  url?: string
}
```

## ActionPlan

``` typescript
type ActionPlan = {
  planId: string
  version: number
  issueKey: string
  snapshotVersion: string

  findings: string[]
  missingInfo: string[]

  actions: Action[]

  slackDraft: {
    channel: string
    text: string
  }

  expiresAt: string
}
```

## Action

``` typescript
type Action = {
  actionId: string
  type:
    | "assign_issue"
    | "set_priority"
    | "create_subtask"
    | "add_comment"

  before?: unknown
  after?: unknown

  evidenceRefs: string[]

  status:
    | "pending"
    | "approved"
    | "executing"
    | "succeeded"
    | "failed"
}
```

## Execution

Debe registrar, como mínimo:

``` text
executionId
planId
planVersion
issueKey
actionId
startedAt
finishedAt
status
provider
providerId
error
retryable
```

------------------------------------------------------------------------

# 8. Herramientas del agente

## Lectura

Primera versión:

``` text
get_issue(issueKey)
get_issue_comments(issueKey)
get_related_issues(issueKey)
get_project_issues(projectKey)
```

Opcional si el tiempo lo permite:

``` text
get_issue_history(issueKey)
get_subtasks(issueKey)
get_project_activity(projectKey)
```

## Escrituras

Solamente mediante el executor:

``` text
assign_issue(issueKey, user)
set_priority(issueKey, priority)
create_subtask(issueKey, fields)
add_comment(issueKey, body)
```

No agregar herramientas de escritura adicionales sin necesidad del
Golden Path.

------------------------------------------------------------------------

# 9. Reglas del agente

## Regla 1 --- Contexto

Nunca pedir al usuario que copie el contenido del ticket si el ticket
está seleccionado.

## Regla 2 --- Evidencia

Toda conclusión relevante debe poder rastrearse a:

-   issue;
-   comentario;
-   relación;
-   dato obtenido de Jira.

## Regla 3 --- Hechos vs hipótesis

Separar:

``` text
FACTS
Lo que Jira demuestra.

HYPOTHESES
Interpretaciones del agente.

MISSING INFORMATION
Datos que faltan para actuar con seguridad.
```

## Regla 4 --- No inventar

No inventar:

-   usuarios;
-   IDs;
-   URLs;
-   estados;
-   comentarios;
-   relaciones;
-   resultados de herramientas.

## Regla 5 --- No repetir trabajo

Antes de crear una subtarea:

-   revisar subtareas existentes;
-   revisar comentarios;
-   revisar relaciones.

Si el trabajo ya existe, no crear otro elemento.

## Regla 6 --- Responsable

Si no existe evidencia suficiente para seleccionar responsable:

``` text
NO ASIGNAR
```

y mostrar el faltante.

## Regla 7 --- Escrituras

El agente puede proponer.

El servidor ejecuta.

La aprobación humana es obligatoria.

------------------------------------------------------------------------

# 10. Modelo de seguridad

El flujo de escritura debe ser:

``` text
Agent
  ↓
ActionPlan
  ↓
User Review
  ↓
Approve(planId, version)
  ↓
Server Validation
  ↓
Executor
  ↓
Jira
```

Nunca:

``` text
Agent → Jira write
```

## Validaciones antes de ejecutar

-   sesión válida;
-   plan existente;
-   plan no expirado;
-   versión correcta;
-   ticket correcto;
-   snapshot sin cambios relevantes;
-   destino permitido;
-   acción incluida en el plan;
-   acción no ejecutada anteriormente.

------------------------------------------------------------------------

# 11. Concurrencia y planes obsoletos

Si Jira cambia después de crear el plan:

``` text
Plan:
WP-42
Priority: High
Assignee: Carlos
```

y Jira cambia a:

``` text
Priority: Highest
Assignee: Ana
```

al aprobar:

``` text
SNAPSHOT_CHANGED
```

WorkPilot debe bloquear la ejecución.

Mensaje esperado:

> El ticket cambió desde que preparé la propuesta. Necesito revisarlo
> nuevamente.

No sobrescribir silenciosamente.

------------------------------------------------------------------------

# 12. Idempotencia

Doble clic:

``` text
Approve
Approve
```

no debe generar:

``` text
2 subtasks
2 comments
2 Slack messages
```

Debe existir una clave persistente por operación.

Ejemplo conceptual:

``` text
planId + version + actionId
```

Si una operación ya fue ejecutada:

``` text
DO NOT EXECUTE AGAIN
```

Si el resultado es incierto:

``` text
RECONCILE
```

No reenviar ciegamente.

------------------------------------------------------------------------

# 13. Read-back

Una operación no se considera completada simplemente porque la API
respondió correctamente.

Ejemplo:

``` text
create_subtask()
       ↓
Jira
       ↓
WP-43
       ↓
get_issue(WP-43)
       ↓
verify
       ↓
SUCCESS
```

El resultado debe incluir el identificador real de Jira.

------------------------------------------------------------------------

# 14. Slack

Slack es solamente un aviso saliente en el MVP.

Orden obligatorio:

``` text
Jira actions
     ↓
Jira read-back
     ↓
Jira verified
     ↓
Slack notification
```

Nunca:

``` text
Slack
  ↓
Jira
```

## Fallo parcial

Si Jira funciona y Slack falla:

``` text
Jira: SUCCESS
Slack: PENDING / FAILED
```

El usuario debe ver:

> Jira actualizado; aviso de Slack pendiente.

Reintentar Slack no debe repetir las modificaciones de Jira.

------------------------------------------------------------------------

# 15. Persistencia

Persistir:

-   ActionPlan;
-   versión;
-   snapshot;
-   execution;
-   action results;
-   provider IDs;
-   Slack status;
-   errores;
-   estado de recuperación.

No es necesario persistir todo el historial del chat.

Después de:

``` text
refresh
```

o reiniciar servidor:

``` text
WorkPilot
   ↓
lee persistencia
   ↓
consulta Jira
   ↓
reconstruye estado
```

------------------------------------------------------------------------

# 16. Fixtures de demo

Crear dos tickets reales de prueba en Jira.

## Ticket A

``` text
WP-42
Validación de checkout bloqueada
```

Debe contener:

-   descripción ambigua;
-   comentario indicando que el arreglo ya está en staging;
-   dependencia WP-39 sin resolver;
-   caso de prueba todavía no documentado;
-   subtarea de implementación ya existente.

WorkPilot debe evitar crear otra subtarea de implementación.

## Ticket B

``` text
WP-57
Revisión de accesibilidad lista para QA
```

Debe contener:

-   dependencias cerradas;
-   responsable definido;
-   solamente falta preparar el resumen de traspaso.

El mismo prompt debe producir una propuesta diferente.

------------------------------------------------------------------------

# 17. Distribución del equipo

## P1 --- Agent / AI

### Responsabilidad

Construir el comportamiento inteligente de WorkPilot.

### Tareas

-   [ ] Prompt propio de WorkPilot.
-   [ ] Inyección del ticket seleccionado.
-   [ ] Herramientas de lectura.
-   [ ] Separación hechos/hipótesis/faltantes.
-   [ ] Evidencia.
-   [ ] Generación de ActionPlan.
-   [ ] Evitar acciones innecesarias.
-   [ ] Respuesta «¿qué falta?».
-   [ ] Pruebas con WP-42 y WP-57.

### Entregable

``` text
Ticket seleccionado
      ↓
Agent
      ↓
ActionPlan válido
```

------------------------------------------------------------------------

# 18. P2 --- Frontend / UX

### Responsabilidad

Construir la experiencia visual.

### Tareas

-   [ ] Workspace.
-   [ ] Selector de tickets.
-   [ ] Detalle de ticket.
-   [ ] Comentarios.
-   [ ] Dependencias.
-   [ ] Panel de WorkPilot.
-   [ ] Evidencia.
-   [ ] Findings.
-   [ ] Missing information.
-   [ ] Before/After.
-   [ ] ActionPlan.
-   [ ] Approve.
-   [ ] Reject.
-   [ ] Estados por acción.
-   [ ] Errores parciales.
-   [ ] Refresh.
-   [ ] Cambio de ticket.

### Entregable

La UI debe hacer evidente:

``` text
qué encontró WorkPilot
qué sabe
qué no sabe
qué propone
qué va a cambiar
qué cambió realmente
```

------------------------------------------------------------------------

# 19. P3 --- Jira / Backend / Executor

### Responsabilidad

Integración real y segura con Jira.

### Tareas

-   [x] Cliente Jira.
-   [x] Lectura de issues.
-   [x] Lectura de comentarios.
-   [x] Relaciones.
-   [x] Subtasks.
-   [x] Validación de campos.
-   [x] ActionPlan persistido.
-   [x] Approval gate.
-   [x] Escrituras Jira.
-   [x] Read-back.
-   [x] Idempotencia.
-   [x] Snapshot validation.
-   [x] Concurrencia.
-   [x] Registro de ejecución.
-   [x] Recuperación.
-   [x] Manejo de timeout.

### Entregable

``` text
Approve
   ↓
Server
   ↓
Jira real
   ↓
Verified result
```

------------------------------------------------------------------------

# 20. P4 --- Integración / Slack / QA / Release

### Responsabilidad

Integrar el trabajo de todos y garantizar que el recorrido completo
funciona.

### Tareas

-   [ ] Incorporar starter.
-   [ ] Ejecutar checkout.
-   [ ] Configurar entorno.
-   [ ] Adaptar runtime.
-   [ ] Integrar Agent + Frontend + Backend.
-   [ ] Adaptador Slack.
-   [ ] Slack notification.
-   [ ] Pruebas end-to-end.
-   [ ] Build.
-   [ ] Quickstart.
-   [ ] Submission.
-   [ ] Video.
-   [ ] Ensayo de demo.

### Entregable

Golden Path completo reproducible.

------------------------------------------------------------------------

# 21. Estructura de trabajo sugerida

Adaptar el starter existente y mantener sus convenciones.

Estructura propuesta:

``` text
apps/
  web/
    src/
      app/
        page.tsx

      components/
        workplace/
        workpilot/
          workpilot-panel.tsx
          evidence-card.tsx
          action-plan.tsx
          approval-card.tsx
          execution-status.tsx

      lib/
        server/
          jira/
            client.ts
            issues.ts
            comments.ts
            relations.ts

          slack/
            client.ts
            notifications.ts

          workpilot/
            plans.ts
            executor.ts
            persistence.ts
            reconciliation.ts
            idempotency.ts

packages/
  agent-core/
    src/
      workpilot/
        prompt.ts
        tools.ts
        context.ts
        action-plan.ts

docs/
  PRD.md
  TASKS.md
  STARTER-REVIEW.md
```

Los nombres nuevos son una propuesta de organización; antes de mover
archivos existentes, conservar la estructura real del starter y adaptar
sus patrones.

------------------------------------------------------------------------

# 22. Backlog por orden

## Bloque 0 --- Setup

-   [ ] Leer documentación.
-   [ ] Incorporar starter.
-   [ ] Ejecutar `apps/web`.
-   [ ] Verificar build.
-   [ ] Confirmar accesos Jira.
-   [ ] Confirmar acceso Slack.
-   [ ] Confirmar modelo.
-   [ ] Crear WP-42 y WP-57.
-   [ ] Acordar contratos.

## Bloque 1 --- Contexto

-   [ ] Ticket selector.
-   [ ] Jira read.
-   [ ] Ticket details.
-   [ ] Comments.
-   [ ] Dependencies.
-   [ ] Context injection.

**Milestone:**

``` text
Seleccionar WP-42
→ WorkPilot conoce WP-42
→ UI muestra datos reales.
```

## Bloque 2 --- Agent

-   [ ] Prompt.
-   [ ] Read tools.
-   [ ] Evidence.
-   [ ] Findings.
-   [ ] Missing information.
-   [ ] ActionPlan.

**Milestone:**

``` text
"Revisá esto"
→ propuesta pertinente.
```

## Bloque 3 --- Approval

-   [ ] Proposal card.
-   [ ] Before/After.
-   [ ] Approve.
-   [ ] Reject.
-   [ ] Server validation.

**Milestone:**

``` text
Reject
→ cero cambios.
```

## Bloque 4 --- Jira writes

Implementar primero:

``` text
add_comment
create_subtask
```

Después, si el tiempo permite:

``` text
assign_issue
set_priority
```

**Milestone:**

``` text
Approve
→ Jira real
→ read-back
→ IDs reales.
```

## Bloque 5 --- Slack

-   [ ] Texto aprobado.
-   [ ] Canal configurado.
-   [ ] Envío después de Jira.
-   [ ] Provider ID.
-   [ ] Retry independiente.

**Milestone:**

``` text
Jira verified
→ Slack sent.
```

## Bloque 6 --- Reliability

-   [ ] Refresh.
-   [ ] Restart.
-   [ ] Double click.
-   [ ] Reject.
-   [ ] Expired plan.
-   [ ] Changed snapshot.
-   [ ] Jira timeout.
-   [ ] Slack failure.
-   [ ] Reconciliation.

## Bloque 7 --- Demo

-   [ ] Golden Path.
-   [ ] Ticket A.
-   [ ] Ticket B.
-   [ ] Failure scenario.
-   [ ] «¿Qué falta?».
-   [ ] Build.
-   [ ] README.
-   [ ] Submission.
-   [ ] Video.

------------------------------------------------------------------------

# 23. Pruebas de aceptación obligatorias

  -----------------------------------------------------------------------
  Prueba                              Resultado
  ----------------------------------- -----------------------------------
  Cambiar de WP-42 a WP-57            El contexto cambia correctamente

  Mismo prompt en ambos tickets       Las propuestas son diferentes

  Comentario relevante                Aparece como evidencia

  Subtask existente                   No se duplica

  Responsable desconocido             No se inventa

  Reject                              Cero cambios en Jira y Slack

  Approve                             Sólo ejecuta acciones aprobadas

  Doble Approve                       Un solo efecto

  Ticket cambió                       Plan invalidado

  Plan expirado                       No ejecuta

  Jira actualizado + Slack falla      Estado parcial correcto

  Retry Slack                         No repite Jira

  Refresh                             Estado conservado

  Restart server                      Ejecución recuperable

  Timeout Jira                        Estado incierto/reconciliación

  «¿Qué falta?»                       Relee estado real

  Instrucción maliciosa en comentario Se trata como evidencia, no como
                                      autoridad
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 24. Estrategia de recorte

Si el tiempo se reduce, eliminar en este orden:

1.  Pulido visual avanzado.
2.  Asignación automática.
3.  Cambio automático de prioridad.
4.  Funciones de búsqueda adicionales.
5.  Cualquier integración secundaria.

Conservar siempre:

``` text
Contexto
+
Jira real
+
Agent
+
Evidence
+
ActionPlan
+
Approval
+
Una escritura Jira real
+
Read-back
+
Slack real
+
Persistencia
+
Reject
```

Una simulación debe declararse como simulación y no presentarse como
integración real.

------------------------------------------------------------------------

# 25. Criterio de finalización

WorkPilot está listo para la demo cuando los cuatro puedan ejecutar sin
intervención manual de código:

``` text
1. Abrir WorkPilot.
2. Seleccionar WP-42.
3. Decir "Revisá esto y dejalo listo para el equipo."
4. Ver evidencia.
5. Ver propuesta.
6. Aprobar.
7. Ver cambios reales en Jira.
8. Verificación de Jira.
9. Ver aviso en Slack.
10. Refrescar.
11. Preguntar "¿Qué falta?"
12. Obtener respuesta basada en estado real.
```

Además, debe pasar las pruebas críticas:

``` text
Reject
Double Approve
Stale Plan
Partial Slack Failure
Refresh
Restart
```

------------------------------------------------------------------------

# 26. Reglas de colaboración

-   P4 mantiene la rama de integración.
-   Cada persona trabaja en una rama propia.
-   Integrar cambios pequeños y funcionales.
-   Todo cambio de contrato debe comunicarse.
-   Fixtures deben mantenerse alineados con los contratos.
-   Credenciales nunca entran en commits.
-   No compartir secretos en capturas.
-   Cada entrega debe incluir:
    -   qué cambió;
    -   cómo probarlo;
    -   dependencias;
    -   si usa fixture o servicio real.
-   No esperar al final para integrar.
-   Cada persona prueba su propia parte.
-   El equipo completo prueba el Golden Path.

------------------------------------------------------------------------

# 27. Definición de "Done" por tarea

Una tarea no está terminada porque "el código funciona".

Debe tener:

``` text
Código
+
Integración
+
Prueba
+
Resultado verificable
```

Ejemplo:

``` text
❌ "Ya hice Jira."

✅ "WP-42 se obtiene desde Jira real,
   muestra comments y dependencies,
   y la prueba confirma los datos."
```

------------------------------------------------------------------------

# 28. Prioridad absoluta durante el hackathon

Cuando haya dudas, utilizar este orden:

### P0 --- Debe funcionar

``` text
Jira real
Contexto real
Agent
Proposal
Approval
Jira write
Read-back
Slack
```

### P1 --- Debe ser confiable

``` text
Idempotencia
Snapshot validation
Persistence
Partial failure
Refresh
```

### P2 --- Debe ser convincente

``` text
Evidence
Two different tickets
"¿Qué falta?"
Beautiful UI
```

### P3 --- Extras

``` text
Advanced search
More actions
More providers
Additional surfaces
```

No sacrificar P0/P1 por P3.

------------------------------------------------------------------------

# 29. Mensaje del producto

## Una frase

> **WorkPilot entiende el ticket que estás viendo, prepara el trabajo
> que falta y, con tu aprobación, lo ejecuta en Jira y avisa al
> equipo.**

## Pitch técnico

> **WorkPilot is a contextual work agent for Jira handoffs. Instead of
> asking users to copy context into a chatbot, it starts from the ticket
> they are already working on, investigates the surrounding work,
> produces evidence-backed actions, requires human approval, executes
> those actions safely, verifies the result, and communicates completion
> to Slack.**

------------------------------------------------------------------------

# 30. Regla final

**No estamos construyendo otro chatbot.**

Estamos construyendo un agente que:

``` text
ENTIENDE
   ↓
INVESTIGA
   ↓
PROPONE
   ↓
ESPERA APROBACIÓN
   ↓
EJECUTA
   ↓
VERIFICA
   ↓
COMUNICA
   ↓
RECUERDA EL ESTADO DEL TRABAJO
```

El éxito del proyecto no se mide por lo inteligente que parece
WorkPilot.

Se mide por si puede completar de forma segura y verificable el flujo:

``` text
Jira ticket
→ contextual understanding
→ evidence
→ action plan
→ human approval
→ real Jira changes
→ verified result
→ Slack notification
→ persistent follow-up
```

**Ese es el producto que el equipo debe terminar.**
