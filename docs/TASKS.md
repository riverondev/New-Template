# WorkPilot — reparto de tareas para 4 personas

Base: [PRD v0.1](PRD.md). Estado inicial: documentación creada; starter todavía no incorporado ni ejecutado en esta repo. P1–P4 son puestos por asignar a nombres reales.

## 1. Primer bloque conjunto · objetivo de 30–45 minutos

- [ ] T00 · Equipo: leer PRD y confirmar el alcance del traspaso de tickets bloqueados.
- [ ] T01 · P4: incorporar el starter conservando su estructura y estos documentos; registrar commit de origen y licencia. No crear otra app sobre el starter.
- [ ] T02 · P4: revisar las instrucciones reales del checkout, instalar y levantar `apps/web`; registrar qué funciona y qué requiere credenciales.
- [ ] T03 · P1/P2/P3/P4: acordar tipos de `WorkContext`, `ActionPlan` y `Execution`; preparar los dos fixtures de demo.
- [ ] T04 · P3: verificar lectura Jira, proyecto, tipo de issue/subtarea, campos y responsables admitidos.
- [ ] T05 · P4: verificar acceso al canal Slack de prueba y documentar permisos mínimos del adaptador elegido.
- [ ] T06 · P1: comprobar que el modelo de la cuenta responde y usa herramientas.
- [ ] T07 · Equipo: poner nombres, disponibilidad y sede/plazo real a la planificación.

Salida: app base ejecutable, contratos compartidos y obstáculos de acceso identificados. No dedicar este bloque a pulir el diseño.

## 2. Responsabilidades y límites de archivos

Los archivos del starter de la tabla fueron identificados en su documentación/código remoto. Los nombres nuevos son propuestas. Sólo P4 integra cambios en archivos compartidos de configuración; no asignar a dos personas el mismo archivo sin coordinarlo.

| Persona | Propiedad principal | Archivos o límites |
|---|---|---|
| P1 · Agente | Prompt de WorkPilot, lectura contextual, selección de herramientas, salida estructurada | Nuevo prompt en `packages/agent-core/src/`; coordinar uso de `makeAgent` con P4. `apps/web/src/components/app-control.tsx`. |
| P2 · Frontend | Vista Jira, propuesta, evidencia, aprobar/rechazar y resultados | `apps/web/src/app/page.tsx`; adaptar `workplace-followups.tsx`, `use-workplace.ts` y componentes visuales. |
| P3 · Jira/ejecutor | Adaptador Jira, planes, aprobación, persistencia, reconciliación | Adaptar `apps/web/src/lib/server/followups.ts` y ruta de followups; nuevos módulos de Jira y ejecución en servidor. |
| P4 · Integración/Slack | Adaptador Slack, composición, QA, ejecución conjunta y demo | Nuevo módulo Slack con interfaz acordada; endpoint CopilotKit; configuración compartida; README y submission. |

P3 consume el adaptador Slack de P4; P4 no modifica el ejecutor de P3. Los tipos compartidos se acuerdan en T03 y tienen a P3 como responsable de cambios posteriores.

## 3. Backlog ejecutable

| ID | Dueño | Tarea | Depende de | Entrega comprobable |
|---|---|---|---|---|
| A01 | P1 | Prompt propio con hechos/hipótesis/faltantes y referencias | T03 | Dos fixtures generan conclusiones y acciones distintas. |
| A02 | P1 | Inyectar ticket seleccionado y estados del plan al agente | T02, T03 | «Esto» cambia de significado al seleccionar otro ticket. |
| A03 | P1 | Herramientas de lectura y propuesta sin escrituras directas | B01, C01 | Obtiene comentarios/relaciones y devuelve un plan validado. |
| A04 | P1 | Respuesta posterior «¿qué falta?» | C04 | Relee trabajo real y omite lo ya hecho. |
| B01 | P2 | Workspace con selector, detalles y comentarios | T03 | UI navegable con fixtures compatibles con Jira. |
| B02 | P2 | Tarjeta de plan: evidencia, antes/después y texto Slack | B01, T03 | Usuario puede inspeccionar cada efecto antes de aprobar. |
| B03 | P2 | Aprobar, rechazar y mostrar estados por acción | B02, C02 | Rechazo y fallo parcial visibles sin mensajes de éxito falsos. |
| B04 | P2 | Refresh y cambio de ticket | C04 | La vista recupera el estado correcto y no mezcla propuestas. |
| C01 | P3 | Adaptador Jira de lectura y metadatos | T04 | Devuelve ticket, comentarios, relaciones y valores válidos reales. |
| C02 | P3 | Plan persistido y gate de aprobación | T03 | Valida sesión, versión, expiración y snapshot; rechazo sin efectos. |
| C03 | P3 | Escrituras Jira permitidas y lectura de verificación | C01, C02 | Subtarea/comentario reales con IDs; asignación/prioridad sólo si aprobadas. |
| C04 | P3 | Registro de ejecución y recuperación | C03 | Refresh y reinicio conservan resultados; doble clic sin duplicados. |
| C05 | P3 | Encadenar aviso y manejar errores parciales | C04, D01 | Slack sólo después de Jira verificado; reintento no repite Jira. |
| D01 | P4 | Adaptador de Slack saliente | T05, T03 | Envía texto aprobado al canal fijo y devuelve identificador del proveedor. |
| D02 | P4 | Integrar prompt/runtime y primera interacción completa | A02, B01, C01 | Seleccionar ticket → contexto → lectura → respuesta real. |
| D03 | P4 | Integrar propuesta/aprobación/Jira/Slack | A03, B03, C05 | Recorrido real completo con resultados externos verificables. |
| D04 | P4, con apoyo de todos | Pruebas de aceptación y cancelación/fallo parcial | D03 | Evidencia de F01–F13 y reporte de limitaciones. |
| D05 | P4, con apoyo de todos | Quickstart, atribución, submission y video | D04 | Paquete de entrega revisable, sin publicar por defecto. |

## 4. Orden de integración

Las duraciones son estimaciones de trabajo, no el horario oficial del evento. Ajustarlas cuando se conozca el tiempo disponible; reservar un bloque final para la entrega.

### Hito 1 · contexto y acceso · primer bloque de 1–2 horas tras setup

P1 y P2 trabajan contra fixtures; P3 hace lectura Jira; P4 prepara Slack y compone runtime. Integrar B01 + A02 + C01 cuanto antes.

**Salida:** el agente reconoce un ticket real sin que se escriba su clave. Jira y Slack tienen pruebas de acceso concretas.

### Hito 2 · una acción completa · siguiente bloque de 2 horas

P1 genera propuesta; P2 presenta aprobación; P3 ejecuta una acción Jira; P4 verifica aviso. Empezar con comentario y una subtarea. Añadir prioridad/asignación después de que el recorrido funcione.

**Salida:** prompt → evidencia → propuesta → clic → Jira real → Slack real → refresh.

### Hito 3 · confiabilidad y diferenciación · siguiente bloque de 1–2 horas

Pruebas de doble aprobación, rechazo, contexto cambiado, timeout y Slack fallido. Demostrar segundo ticket con otra propuesta y consulta de trabajo pendiente.

**Salida:** recorrido reproducible y fallos comprensibles. Los reintentos no duplican efectos.

### Hito 4 · cierre · reservar 60–90 minutos como mínimo orientativo

Ejecutar verificación/build, ensayar y grabar video de dos minutos o límite local confirmado. Completar README y submission con aportes originales y limitaciones reales.

## 5. Contrato de colaboración

- P4 mantiene la rama de integración y resuelve cambios compartidos; sugerencias de ramas: `codex/workpilot-agent`, `codex/workpilot-ui`, `codex/workpilot-jira`, `codex/workpilot-integration`.
- Integrar por hitos funcionales pequeños, sin esperar a terminar todas las tareas de una persona.
- Cada entrega incluye: qué cambió, contrato afectado, cómo verificar y si usa fixtures o servicios reales.
- Si cambia un tipo compartido, avisar antes de integrar; mantener fixtures alineados.
- Las credenciales se configuran localmente en el entorno; no van en PRD, tickets, commits o capturas.
- P4 coordina QA y demo, pero cada dueño prueba su parte y aporta evidencia. No cargar todo el cierre sobre P4.

## 6. Pruebas de aceptación asignadas

| Prueba | Dueño | Resultado esperado |
|---|---|---|
| Ticket A vs B, mismo prompt | P1/P2 | Plan pertinente, evidencia correcta y ausencia de acciones innecesarias. |
| Rechazo | P2/P3 | No escribe en Jira ni Slack. |
| Plan de otra sesión, expirado o modificado | P3 | Bloqueado antes de escribir. |
| Ticket actualizado mientras se revisa | P3 | Plan invalidado y nueva revisión necesaria. |
| Doble aprobación | P3/P4 | Un solo efecto por operación. |
| Jira actualizado, Slack falla | P3/P4 | Resultado parcial; recuperación sólo del aviso. |
| Timeout de escritura | P3/P4 | Estado incierto y reconciliación, sin reenvío ciego. |
| Refresh y reinicio del servidor | P2/P3 | Mismos registros Jira y ejecución recuperable. |
| Mensaje Jira con instrucciones maliciosas | P1/P3 | Se trata como evidencia; no cambia destinos ni permisos. |
| Verificación del starter y build web | P4 | Checks pasan; registrar aparte pruebas reales de proveedores. |

## 7. Si el tiempo se reduce

Recortar edición de prioridad/asignación, pulido visual y cualquier búsqueda adicional. Mantener el agente contextual, evidencia, una propuesta aprobable, una escritura útil en Jira, aviso Slack, persistencia y rechazo. Una integración simulada debe declararse como tal y no cuenta como el MVP completo de este PRD.
