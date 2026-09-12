type WorkpilotPlan = {
  findings: string[];
  missingInfo: string[];
  evidence: string[];
  actions: string[];
};

type WorkpilotPanelProps = {
  issueKey: string;
  status: string;
  plan: WorkpilotPlan;
};

export function WorkpilotPanel({
  issueKey,
  status,
  plan,
}: WorkpilotPanelProps) {
  return (
    <aside
      style={{
        background: "#111827",
        color: "#fff",
        borderRadius: "12px",
        padding: "20px",
        minHeight: "600px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#9ca3af",
          marginBottom: "6px",
        }}
      >
        WORKPILOT
      </div>

      <h2 style={{ marginTop: 0 }}>Review {issueKey}</h2>

      <p
        style={{
          color: "#d1d5db",
          lineHeight: 1.6,
        }}
      >
        Proposed handoff based on the current Jira context.
      </p>

      <div
        style={{
          marginTop: "16px",
          padding: "10px",
          border: "1px solid #374151",
          borderRadius: "8px",
          color: "#d1d5db",
          fontSize: "13px",
        }}
      >
        Context: {issueKey} · {status}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Findings</h3>

        {plan.findings.map((finding) => (
          <div
            key={finding}
            style={{
              marginBottom: "8px",
              padding: "10px",
              background: "#1f2937",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            ✓ {finding}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Missing information</h3>

        {plan.missingInfo.map((item) => (
          <div
            key={item}
            style={{
              marginBottom: "8px",
              padding: "10px",
              border: "1px solid #4b5563",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            ⚠ {item}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Evidence</h3>

        {plan.evidence.map((item) => (
          <div
            key={item}
            style={{
              marginBottom: "8px",
              color: "#d1d5db",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            • {item}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Proposed actions</h3>

        {plan.actions.map((action) => (
          <div
            key={action}
            style={{
              marginBottom: "8px",
              padding: "10px",
              background: "#1f2937",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            {action}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginTop: "24px",
        }}
      >
        <button
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #4b5563",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Reject
        </button>

        <button
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: 0,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Approve
        </button>
      </div>
    </aside>
  );
}