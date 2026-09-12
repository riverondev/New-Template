"use client";

import { WorkpilotPanel } from "../components/workpilot/workpilot-panel";
import { useState } from "react";
import { tickets, workpilotPlans } from "../data/workpilot-mock";

export default function HomePage() {
  const [selectedKey, setSelectedKey] = useState(tickets[0].key);

  const selectedTicket =
    tickets.find((ticket) => ticket.key === selectedKey) ?? tickets[0];

    const plan =
  workpilotPlans[selectedTicket.key as keyof typeof workpilotPlans];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            marginBottom: "20px",
          }}
        >
          <h1 style={{ margin: 0 }}>WorkPilot</h1>
          <p style={{ marginTop: "6px", color: "#666" }}>
            Contextual workspace for Jira handoffs
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr 380px",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h2 style={{ fontSize: "16px", marginTop: 0 }}>Jira Tickets</h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {tickets.map((ticket) => {
                const isSelected = ticket.key === selectedTicket.key;

                const plan =
                     workpilotPlans[selectedTicket.key as keyof typeof workpilotPlans];

                return (
                  <button
                    key={ticket.key}
                    onClick={() => setSelectedKey(ticket.key)}
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      borderRadius: "8px",
                      border: isSelected
                        ? "2px solid #111827"
                        : "1px solid #e5e7eb",
                      background: isSelected ? "#f3f4f6" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{ticket.key}</strong>

                    <div
                      style={{
                        fontSize: "13px",
                        marginTop: "4px",
                        color: "#4b5563",
                      }}
                    >
                      {ticket.summary}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* CENTER COLUMN */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    marginBottom: "6px",
                  }}
                >
                  {selectedTicket.key}
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "24px",
                  }}
                >
                  {selectedTicket.summary}
                </h2>
              </div>

              <span
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "999px",
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
              >
                {selectedTicket.status}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: "24px",
                marginTop: "20px",
                paddingBottom: "20px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  Priority
                </div>
                <strong>{selectedTicket.priority}</strong>
              </div>

              <div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  Assignee
                </div>
                <strong>{selectedTicket.assignee}</strong>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <h3>Description</h3>
              <p
                style={{
                  lineHeight: 1.6,
                  color: "#374151",
                }}
              >
                {selectedTicket.description}
              </p>
            </div>

            <div style={{ marginTop: "28px" }}>
              <h3>Comments</h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {selectedTicket.comments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "4px",
                      }}
                    >
                      {comment.author}
                    </strong>

                    <span
                      style={{
                        color: "#4b5563",
                        lineHeight: 1.5,
                      }}
                    >
                      {comment.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "28px" }}>
              <h3>Dependencies</h3>

              {selectedTicket.dependencies.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {selectedTicket.dependencies.map((dependency) => (
                    <span
                      key={dependency}
                      style={{
                        background: "#f3f4f6",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "13px",
                      }}
                    >
                      {dependency}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#6b7280" }}>No open dependencies.</p>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN */}
          {/* RIGHT COLUMN */}
              <WorkpilotPanel
  issueKey={selectedTicket.key}
  status={selectedTicket.status}
  plan={plan}
/>
        </div>
      </div>
    </main>
  );
}