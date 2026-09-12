type ActionPlanProps = {
  actions: string[];
};

export function ActionPlan({ actions }: ActionPlanProps) {
  if (actions.length === 0) {
    return (
      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Proposed actions</h3>
        <div
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #4b5563",
            color: "#d1d5db",
          }}
        >
          No hay acciones propuestas.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "24px" }}>
      <h3 style={{ fontSize: "15px" }}>Acciones propuestas</h3>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {actions.map((action, index) => (
          <div
            key={`${index}-${action}`}
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              marginBottom: "8px",
              padding: "10px",
              background: "#1f2937",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            <div
              style={{
                minWidth: "72px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#d1d5db",
                paddingTop: "2px",
              }}
            >
              ACCIÓN {index + 1}
            </div>

            <div style={{ color: "#f3f4f6", lineHeight: 1.5 }}>{action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
