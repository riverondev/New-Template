"use client";

import { useState } from "react";

type ApprovalState = "pending" | "approved" | "rejected";

type ApprovalCardProps = {
  onApprove?: () => void;
  onReject?: () => void;
};

export function ApprovalCard({ onApprove, onReject }: ApprovalCardProps) {
  const [status, setStatus] = useState<ApprovalState>("pending");

  const handleApprove = () => {
    setStatus("approved");
    onApprove?.();
  };

  const handleReject = () => {
    setStatus("rejected");
    onReject?.();
  };

  if (status === "approved") {
    return (
      <div
        style={{
          marginTop: "24px",
          padding: "12px 14px",
          borderRadius: "8px",
          background: "#0f172a",
          border: "1px solid #22c55e",
          color: "#dcfce7",
          fontSize: "14px",
        }}
      >
        Plan aprobado — listo para ejecutar.
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div
        style={{
          marginTop: "24px",
          padding: "12px 14px",
          borderRadius: "8px",
          background: "#0f172a",
          border: "1px solid #f87171",
          color: "#fecaca",
          fontSize: "14px",
        }}
      >
        Plan rechazado — no se aplicarán cambios.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px",
        marginTop: "24px",
      }}
    >
      <button
        type="button"
        onClick={handleReject}
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
        Rechazar
      </button>

      <button
        type="button"
        onClick={handleApprove}
        style={{
          padding: "12px",
          borderRadius: "8px",
          border: 0,
          cursor: "pointer",
          fontWeight: 700,
          background: "#e5e7eb",
          color: "#111827",
        }}
      >
        Aprobar
      </button>
    </div>
  );
}
