import { useEffect, useRef, useState } from "react";

import { ActionPlan } from "./action-plan";
import { ApprovalCard } from "./approval-card";
import { EvidenceCard } from "./evidence-card";
import { ExecutionStatus, type ExecutionState } from "./execution-status";

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
  const [executionState, setExecutionState] = useState<ExecutionState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setExecutionState("idle");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [issueKey]);

  const handleApprove = () => {
    setExecutionState("executing");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setExecutionState("success");
    }, 900);
  };

  const handleReject = () => {
    setExecutionState("idle");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

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

      <h2 style={{ marginTop: 0 }}>Revisión de {issueKey}</h2>

      <p
        style={{
          color: "#d1d5db",
          lineHeight: 1.6,
        }}
      >
        Handoff propuesto según el contexto actual del ticket en Jira.
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
        Contexto: {issueKey} · {status}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Hallazgos</h3>

        {plan.findings.length > 0 ? (
          plan.findings.map((finding) => (
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
          ))
        ) : (
          <div
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #4b5563",
              color: "#d1d5db",
            }}
          >
            No se identificaron hallazgos.
          </div>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Información faltante</h3>

        {plan.missingInfo.length > 0 ? (
          plan.missingInfo.map((item) => (
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
          ))
        ) : (
          <div
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #4b5563",
              color: "#d1d5db",
            }}
          >
            No falta información.
          </div>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px" }}>Evidencia</h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {plan.evidence.length > 0 ? (
            plan.evidence.map((item) => (
              <EvidenceCard key={item} text={item} />
            ))
          ) : (
            <div
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #4b5563",
                color: "#d1d5db",
              }}
            >
              No hay evidencia disponible.
            </div>
          )}
        </div>
      </div>

      <ActionPlan actions={plan.actions} />

      <ApprovalCard
        key={issueKey}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <ExecutionStatus state={executionState} />
    </aside>
  );
}
