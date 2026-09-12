"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentContext, useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { ActionPlan, ApprovalResult, WorkContext } from "agent-core/workpilot/action-plan";
import type { Delivery } from "../../lib/server/slack/delivery";
import { WorkpilotPanel } from "./workpilot-panel";
import "./workspace.css";

type PlanState = { plan: ActionPlan | null; result?: ApprovalResult; slack?: Delivery };
type Session = { mode: "rehearsal" | "live"; writesEnabled: boolean; agentStatus: string };
async function api<T>(resource: string, input?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/workpilot/" + resource, {
    ...(input === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    cache: "no-store", signal,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "SERVICE_UNAVAILABLE");
  return body;
}
const messages: Record<string, string> = {
  SNAPSHOT_CHANGED: "El ticket cambió desde la propuesta. Actualizá el contexto y prepará un nuevo plan.",
  WRITES_DISABLED: "Las escrituras de Jira están deshabilitadas en el servidor.",
  SERVICE_UNAVAILABLE: "No se pudo leer Jira. Revisá el entorno con npm run preflight.",
  RECONCILIATION_REQUIRED: "Hay una operación sin confirmar. Revisá Jira antes de preparar otro plan.",
  CONCURRENT_EXECUTION: "La ejecución está en curso o quedó interrumpida. Actualizá para consultar el estado.",
};
export function WorkpilotWorkspace() {
  const [session, setSession] = useState<Session>();
  const [selected, setSelected] = useState("WP-42");
  const [input, setInput] = useState("WP-42");
  const [context, setContext] = useState<WorkContext | null>(null);
  const [state, setState] = useState<PlanState>({ plan: null });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const commandInFlight = useRef(false);
  const refresh = useCallback(async (key: string, signal?: AbortSignal) => {
    const current = ++generation.current;
    setLoading(true); setError(""); setContext(null); setState({ plan: null });
    try {
      const s = await api<Session>("session", undefined, signal);
      const [ctx, plans] = await Promise.all([
        api<{ context: WorkContext }>("context?issueKey=" + encodeURIComponent(key), undefined, signal),
        api<PlanState>("plans?issueKey=" + encodeURIComponent(key), undefined, signal),
      ]);
      if (current === generation.current && !signal?.aborted) { setSession(s); setContext(ctx.context); setState(plans); }
    } catch (e) {
      if (current === generation.current && !signal?.aborted) setError(messages[(e as Error).message] || (e as Error).message);
    } finally { if (current === generation.current && !signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void refresh(selected, controller.signal);
    return () => controller.abort(); }, [selected, refresh]);
  useAgentContext({
    description: "WorkPilot selected Jira issue and persisted proposal. Read-only context. Approval is exclusively a page button; chat never approves. P1 reasoning integration is pending.",
    value: JSON.parse(JSON.stringify({ selectedIssueKey: selected, context, plan: state.plan,
      execution: state.result, mode: session?.mode })),
  });
  useFrontendTool({
    name: "workpilot_store_plan", description: "Persist a P1 ActionPlan for page review. Never executes writes or approval.",
    parameters: z.object({ plan: z.record(z.string(), z.unknown()) }),
    handler: async ({ plan }) => {
      if (plan.issueKey !== selected) return { error: "SELECTED_ISSUE_CHANGED" };
      const saved = await api<PlanState>("plans", plan);
      await refresh(selected);
      return { status: "pending_approval", plan: saved.plan };
    },
  }, [selected, refresh]);
  const act = async (resource: string) => {
    if (commandInFlight.current) return;
    commandInFlight.current = true;
    const key = selected;
    setBusy(true); setError("");
    try {
      const payload = resource === "rehearsal" ? { issueKey: key } :
        { planId: state.plan?.planId, version: state.plan?.version };
      await api(resource, payload);
      await refresh(key);
    } catch (e) { setError(messages[(e as Error).message] || (e as Error).message); }
    finally { commandInFlight.current = false; setBusy(false); }
  };
  return <main className="wp-workspace">
    <header><p className="wp-eyebrow">WORKPILOT</p><h1>Prepará el próximo paso.</h1>
      <p>Contexto de Jira, propuesta revisable y resultados verificables.</p>
      <p className="wp-mode">{session?.mode === "rehearsal" ?
        "ENSAYO P4 · proveedores simulados · planes de prueba, sin IA ni escrituras externas" :
        "Jira real · generación del agente pendiente de P1"}</p>
    </header>
    <div className="wp-layout">
      <nav className="wp-card" aria-label="Tickets">
        <h2>Tickets</h2>
        <form onSubmit={e => { e.preventDefault(); setSelected(input.trim().toUpperCase()); }}>
          <label htmlFor="issue-key">Clave de Jira</label>
          <input id="issue-key" value={input} disabled={busy} onChange={e => setInput(e.target.value)} required pattern="[A-Za-z][A-Za-z0-9_]*-[1-9][0-9]*" />
          <button disabled={busy || loading}>Abrir ticket</button>
        </form>
        {session?.mode === "rehearsal" && ["WP-42", "WP-57"].map(key =>
          <button key={key} disabled={busy} aria-pressed={selected === key}
            onClick={() => { setSelected(key); setInput(key); }}>{key}</button>)}
        <button disabled={busy || loading} onClick={() => void refresh(selected)}>Actualizar desde Jira</button>
      </nav>
      <section className="wp-card" aria-label="Contexto Jira">
        <h2>{selected}</h2>
        {loading && <p role="status">Cargando contexto…</p>}
        {context && <>
          <h3>{context.summary}</h3><p>{context.status} · Prioridad {context.priority}</p>
          <p>Responsable: {context.assignee || "Sin asignar"}</p>
          <h3>Comentarios</h3>{context.comments.map(c => <article key={c.id}><strong>{c.author}</strong><p>{c.body}</p></article>)}
          <h3>Dependencias</h3>{context.relatedIssues.length ? context.relatedIssues.map(r =>
            <p key={r.issueKey}>{r.issueKey} · {r.linkType} · {r.status}</p>) : <p>Sin dependencias registradas.</p>}
          <h3>Subtareas existentes</h3>{context.existingSubtasks.map(s => <p key={s.issueKey}>{s.issueKey} · {s.summary} · {s.status}</p>)}
          <small>Leído: {new Date(context.fetchedAt).toLocaleString()}</small>
          {session?.mode === "rehearsal" && <p><button disabled={busy || loading} onClick={() => void act("rehearsal")}>Cargar propuesta de ensayo</button></p>}
        </>}
        {error && <p className="wp-error" role="alert">{error}</p>}
      </section>
      <WorkpilotPanel {...state} busy={busy || loading} approve={() => void act("approve")}
        reject={() => void act("reject")} retry={() => void act("retry-slack")} />
    </div>
  </main>;
}
