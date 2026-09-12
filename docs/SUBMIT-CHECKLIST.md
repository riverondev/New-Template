# WorkPilot — Checklist de Submit + Plan de Acción

> Hackathon: Agents Everywhere — AI Tinkerers Global, 12–13 septiembre 2026.
> Deadline: ver portal de tu ciudad en https://aitinkerers.org/hackathons/global/agents-everywhere
> ⚠️ SUBMIT primero, demos después.

---

## 1. Checklist de submit obligatorio

| # | Entregable | Estado | Notas |
|---|---|---|---|
| 1 | Equipo creado en el portal (mínimo 1 persona) | ⬜ | Todos los integrantes deben haber aceptado la invitación |
| 2 | Descripción clara del proyecto en el portal | ⬜ | Ver plantilla en sección 3 |
| 3 | Repositorio público de GitHub con código + instrucciones | ⬜ | README debe permitir clone + run desde cero |
| 4 | Video demo ≤ 2 minutos mostrando flujo real de principio a fin | ⬜ | Ver guión en sección 4 |
| 5 | Post público en redes con `#AgentsEverywhere` | ⬜ | Incluir link al repo y al video |
| 6 | Todos los links funcionan sin estar logueados | ⬜ | Verificar repo, video y post antes de submit |

---

## 2. Checklist de elegibilidad (reglas del hackathon)

| # | Requisito | Estado |
|---|---|---|
| 1 | El proyecto es nuevo, construido durante el evento | ⬜ |
| 2 | La funcionalidad core fue construida durante el evento | ⬜ |
| 3 | El starter kit y librerías heredadas están identificados separadamente | ⬜ |
| 4 | No hay credenciales ni secrets en el repositorio público | ⬜ |
| 5 | `.env` está en `.gitignore` | ⬜ |

**Qué heredamos del starter:**
- Estructura base de `apps/web` (Next.js)
- Configuración de CopilotKit
- Tipos base del workspace

**Qué construimos durante el hackathon:**
- Cliente Jira con retry, rate-limit y timeout (`jira/client.ts`)
- Lecturas de issues, comentarios, relaciones y subtasks
- Tipos de dominio completos (`action-plan.ts`)
- Executor con escrituras Jira, read-back y reconciliación
- Idempotencia y concurrencia (`idempotency.ts`)
- Snapshot validation e invalidación de planes (`plans.ts`)
- Persistencia de ActionPlan y Execution (`persistence.ts`)
- Approval gate con session, RBAC y throttle (`approve/route.ts`)
- API de planes (`plans/route.ts`)
- Agent core: prompt, tools, context, action-plan generation
- UI: WorkPilot panel, evidence card, action plan, approval card, execution status

---

## 3. Descripción del proyecto para el portal

**Título:** WorkPilot

**Qué hace:**
WorkPilot es un agente integrado en un workspace web que entiende el ticket de Jira que el usuario está viendo, investiga qué impide avanzar y prepara el trabajo para el siguiente responsable. Con aprobación humana, actualiza Jira y comunica el resultado por Slack.

**Para quién:**
Líder técnico de un equipo de desarrollo que necesita preparar el traspaso de un ticket bloqueado hacia otro compañero o QA.

**Por qué el contexto importa:**
El usuario no copia el ticket al agente — WorkPilot ya está dentro del contexto de trabajo. El ticket seleccionado es el contexto ambiental. Sin eso, sería un chatbot genérico que requiere que el usuario explique todo manualmente.

**Tecnologías sponsor usadas:**
- CopilotKit — runtime del agente y UI de aprobación
- OpenAI — razonamiento, separación hechos/hipótesis/faltantes, generación del ActionPlan
- Jira REST API — fuente de verdad, lecturas y escrituras verificadas
- Slack API — aviso saliente después de verificar Jira

---

## 4. Guión del video demo (≤ 2 minutos)

El video debe mostrar el Golden Path completo. Sin cortes que oculten pasos reales.

```
00:00 — Abrir WorkPilot en el browser
00:10 — Seleccionar WP-42 (ticket bloqueado visible en pantalla)
00:20 — Escribir: "Revisá esto y dejalo listo para el equipo."
00:30 — WorkPilot muestra: qué leyó de Jira (issue, comentarios, dependencias)
00:45 — WorkPilot muestra: hechos / hipótesis / información faltante
00:55 — WorkPilot muestra: ActionPlan con cambios propuestos (before/after)
01:05 — Usuario revisa y aprueba
01:15 — Servidor ejecuta → Jira real actualizado
01:25 — WorkPilot muestra read-back verificado (provider IDs reales)
01:35 — Slack recibe el aviso
01:45 — Usuario refresca → estado conservado
01:50 — Usuario pregunta "¿Qué falta?" → respuesta basada en estado real de Jira
02:00 — Fin
```

**Mencionar en el video:**
- "WorkPilot ya sabe qué ticket estás viendo — no necesitás copiarlo"
- "La aprobación es obligatoria antes de cualquier escritura"
- "Cada acción se verifica con un read-back real a Jira"
- Nombrar CopilotKit y OpenAI como tecnologías que lo hacen posible

---

## 5. README mínimo para el repositorio público

El README debe permitir que alguien clone y ejecute desde cero. Debe incluir:

```
## Quickstart

1. Clonar el repositorio
2. Copiar .env.example → .env y completar:
   - JIRA_BASE_URL
   - JIRA_EMAIL
   - JIRA_API_TOKEN
   - JIRA_PROJECT_KEY
   - SLACK_BOT_TOKEN
   - SLACK_DEFAULT_CHANNEL
   - OPENAI_API_KEY
   - COPILOTKIT_API_KEY (si aplica)
3. npm install
4. npm run dev
5. Abrir http://localhost:3000
```

**Lo que debe aclarar:**
- Qué es el starter heredado vs qué construimos
- Que no hay deploy público pero el flujo funciona localmente
- Cómo crear los tickets WP-42 y WP-57 en Jira para la demo
- Que `.env` nunca se commitea

---

## 6. Post en redes

Plataforma sugerida: X (Twitter) o LinkedIn.

Plantilla:
```
Construimos WorkPilot en el hackathon #AgentsEverywhere de @AItinkerers 🚀

Un agente que entiende el ticket de Jira que estás viendo,
investiga qué impide avanzar y — con tu aprobación —
actualiza Jira y avisa al equipo por Slack.

Sin copiar contexto. Sin escribir a ciegas.

🔗 Repo: [link]
🎥 Demo: [link]

Construido con @CopilotKit @OpenAI + Jira + Slack
```

---

## 7. Plan de acción para completar el submit

### Fase A — Hacer funcionar el Golden Path (prioridad máxima)

Antes de grabar el video, el flujo completo debe correr sin intervención manual.

| Tarea | Responsable | Estado |
|---|---|---|
| P1: Agent genera ActionPlan real desde WP-42 | P1 | ⬜ |
| P2: UI muestra evidence, findings, before/after, approve/reject | P2 | ⬜ |
| P3: Executor escribe en Jira real y verifica ✅ | P3 (LetAndino) | ✅ |
| P4: Slack envía aviso después de Jira verificado | P4 | ⬜ |
| P4: Integración end-to-end P1+P2+P3+P4 corriendo | P4 | ⬜ |

### Fase B — Preparar el repositorio público

| Tarea | Responsable | Estado |
|---|---|---|
| Verificar que `.env` está en `.gitignore` | todos | ⬜ |
| Crear `.env.example` con todas las variables (sin valores reales) | P4 | ⬜ |
| Escribir README con quickstart completo | P4 | ⬜ |
| Hacer el repositorio público en GitHub | P4 | ⬜ |
| Verificar que se puede clonar y correr desde cero | todos | ⬜ |

### Fase C — Grabar el video

| Tarea | Responsable | Estado |
|---|---|---|
| Crear tickets WP-42 y WP-57 en Jira con datos de demo | P3/P4 | ⬜ |
| Ensayo del Golden Path sin errores | todos | ⬜ |
| Grabar video ≤ 2 minutos siguiendo el guión de sección 4 | todos | ⬜ |
| Subir video a YouTube/Loom (sin login requerido para ver) | todos | ⬜ |

### Fase D — Submit

| Tarea | Responsable | Estado |
|---|---|---|
| Crear equipo en el portal del hackathon | todos | ⬜ |
| Todos los integrantes aceptan la invitación | todos | ⬜ |
| Completar descripción del proyecto en el portal (sección 3) | todos | ⬜ |
| Publicar post en redes con `#AgentsEverywhere` (sección 6) | todos | ⬜ |
| Completar submit en el portal con todos los links | todos | ⬜ |
| Verificar que repo, video y post abren sin login | todos | ⬜ |

---

## 8. Criterios de jurado — evidencia a mostrar

| Criterio oficial | Cómo lo cubrimos |
|---|---|
| Core Requirements & Functionality | Golden Path completo: WP-42 → agent → ActionPlan → approve → Jira real → read-back verificado → Slack |
| Innovation & Theme Alignment | El agente vive dentro del contexto del ticket — sin copiar nada. Mostrar qué se pierde si se saca el contexto ambiental |
| Technical Execution & Integration | Mostrar snapshot validation (plan invalidado si Jira cambia), idempotencia (doble approve = un solo efecto), timeout → reconciliación |
| Usefulness & Agentic Experience | El usuario solo aprueba o rechaza. WorkPilot hace el trabajo de investigación, propuesta y ejecución verificada |

---

## 9. Regla de oro

> SUBMIT primero. Demos después.
>
> Si el proyecto funciona, empezar desde ya:
> video → README → post → submit.
> No esperar a que todo esté perfecto.
