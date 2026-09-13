export type Ticket = {
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
  comments: {
    id: string;
    author: string;
    text: string;
  }[];
  dependencies: string[];
};

export const tickets: Ticket[] = [
  {
    key: "WP-42",
    summary: "Validación de checkout bloqueada",
    status: "Blocked",
    priority: "High",
    assignee: "Equipo Checkout",
    description:
      "La validación del checkout está bloqueada y requiere revisión antes de continuar con QA.",
    comments: [
      {
        id: "c1",
        author: "Desarrollo",
        text: "El fix ya se encuentra desplegado en staging.",
      },
      {
        id: "c2",
        author: "QA",
        text: "Todavía no tenemos documentado el caso de prueba.",
      },
    ],
    dependencies: ["WP-39"],
  },
  {
    key: "WP-57",
    summary: "Revisión de accesibilidad lista para QA",
    status: "Ready for QA",
    priority: "Medium",
    assignee: "Equipo QA",
    description:
      "La implementación de accesibilidad está lista para ser validada por QA.",
    comments: [
      {
        id: "c3",
        author: "Desarrollo",
        text: "Las dependencias fueron completadas.",
      },
    ],
    dependencies: [],
  },
  {
    key: "WH-1",
    summary: "WorkPilot Hackathon Padre",
    status: "En curso",
    priority: "Medium",
    assignee: "Sin asignar",
    description: "Historia padre del proyecto WH para prueba de handoff con WorkPilot.",
    comments: [],
    dependencies: [],
  },
];

export const workpilotPlans = {
  "WP-42": {
    findings: [
      "El fix ya fue desplegado en staging.",
      "Existe una dependencia abierta: WP-39.",
      "Ya existe trabajo de implementación, por lo que no debe duplicarse.",
    ],
    missingInfo: [
      "Falta documentar el caso de prueba para QA.",
    ],
    evidence: [
      "Comentario de Desarrollo: el fix ya está en staging.",
      "Comentario de QA: el caso de prueba aún no está documentado.",
    ],
    actions: [
      "Agregar comentario de handoff.",
      "Crear una subtarea para documentar el caso de prueba.",
      "Notificar al equipo por Slack después de verificar Jira.",
    ],
  },

  "WP-57": {
    findings: [
      "Las dependencias están cerradas.",
      "El ticket está listo para QA.",
      "El siguiente responsable ya está definido.",
    ],
    missingInfo: [
      "Falta un resumen claro del handoff.",
    ],
    evidence: [
      "Comentario de Desarrollo: las dependencias fueron completadas.",
    ],
    actions: [
      "Agregar resumen de handoff.",
      "Notificar a QA por Slack después de verificar Jira.",
    ],
  },

  "WH-1": {
    findings: [
      "WH-2 (Hijo 1) está en curso.",
      "WH-3 (Hijo 2) está por hacer.",
      "No hay responsable asignado en Jira.",
    ],
    missingInfo: [
      "Falta definir el responsable del handoff.",
    ],
    evidence: [
      "Subtarea WH-2: Hijo 1 — En curso.",
      "Subtarea WH-3: Hijo 2 — Por hacer.",
    ],
    actions: [
      "Agregar comentario de handoff con estado de subtareas.",
      "Notificar por Slack después de verificar Jira.",
    ],
  },
};