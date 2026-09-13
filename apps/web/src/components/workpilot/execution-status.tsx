export type ExecutionState =
  | "idle"
  | "executing"
  | "success"
  | "partial"
  | "failed";

type ExecutionStatusProps = {
  state: ExecutionState;
};

const statusCopy: Record<ExecutionState, string> = {
  idle: "Esperando aprobación.",
  executing: "Aplicando los cambios aprobados...",
  success: "Cambios verificados en Jira y notificación enviada por Slack.",
  partial: "Jira fue actualizado correctamente. La notificación de Slack está pendiente.",
  failed: "La ejecución falló. No se reintentará ninguna acción automáticamente.",
};

const palette: Record<
  ExecutionState,
  { border: string; background: string; color: string; label: string }
> = {
  idle: {
    border: "#374151",
    background: "#111827",
    color: "#d1d5db",
    label: "INACTIVO",
  },
  executing: {
    border: "#f59e0b",
    background: "#1f2937",
    color: "#fef3c7",
    label: "EJECUTANDO",
  },
  success: {
    border: "#22c55e",
    background: "#0f172a",
    color: "#dcfce7",
    label: "ÉXITO",
  },
  partial: {
    border: "#fbbf24",
    background: "#1f2937",
    color: "#fde68a",
    label: "PARCIAL",
  },
  failed: {
    border: "#f87171",
    background: "#1f2937",
    color: "#fecaca",
    label: "FALLIDO",
  },
};

export function ExecutionStatus({ state }: ExecutionStatusProps) {
  const config = palette[state];

  return (
    <div
      style={{
        marginTop: "24px",
        padding: "12px 14px",
        border: `1px solid ${config.border}`,
        borderRadius: "8px",
        background: config.background,
        color: config.color,
        fontSize: "14px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          marginBottom: "4px",
          color: config.color,
        }}
      >
        {config.label}
      </div>
      {statusCopy[state]}
    </div>
  );
}
