"use client";
import { useState, useRef, useEffect } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

export function WorkpilotChat({ issueKey, disabled, onBusy }: {
  issueKey: string; disabled: boolean; onBusy(value: boolean): void;
}) {
  const { agent, isReady } = useAgent({ agentId: "workpilot-chat-" + issueKey, runtimeAgentId: "default", threadId: "workpilot-" + issueKey });
  const { copilotkit } = useCopilotKit();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => () => { agent.abortRun(); }, [agent]);
  async function ask(text: string) {
    if (!text.trim() || !isReady || disabled || inFlight.current || agent.isRunning) return;
    inFlight.current = true; setSending(true); onBusy(true); setError(""); setInput("");
    try {
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: text.trim() });
      await copilotkit.runAgent({ agent });
    } catch {
      setError("No se pudo completar la respuesta. Revisá la conexión y la configuración del modelo; podés volver a intentarlo.");
    } finally { inFlight.current = false; setSending(false); onBusy(false); }
  }
  const running = sending || agent.isRunning;
  return <section className="wp-card wp-chat" aria-label="Chat WorkPilot">
    <h2>Consultá a WorkPilot</h2>
    <p>El agente lee {issueKey} y prepara propuestas. Revisalas antes de aprobar.</p>
    <div className="wp-buttons">
      <button disabled={disabled || !isReady || running} onClick={() => void ask("Analizá el ticket seleccionado y prepará una propuesta de handoff con evidencia.")}>Preparar propuesta</button>
      <button disabled={disabled || !isReady || running} onClick={() => void ask("¿Qué falta ahora? Releé Jira y los resultados de ejecución antes de responder.")}>¿Qué falta?</button>
    </div>
    <div className="wp-chat-messages" role="log" aria-live="polite">
      {agent.messages.filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).map(m =>
        <article key={m.id}><strong>{m.role === "user" ? "Vos" : "WorkPilot"}</strong><p>{typeof m.content === "string" ? m.content : ""}</p></article>)}
    </div>
    {running && <p role="status">Analizando el ticket… <button onClick={() => agent.abortRun()}>Detener</button></p>}
    {error && <p role="alert" className="wp-error">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void ask(input); }}>
      <label htmlFor="workpilot-message">Tu consulta</label>
      <textarea id="workpilot-message" value={input} maxLength={4000} onChange={e => setInput(e.target.value)} disabled={disabled || running} />
      <button disabled={disabled || !isReady || running || !input.trim()}>Enviar</button>
    </form>
  </section>;
}
