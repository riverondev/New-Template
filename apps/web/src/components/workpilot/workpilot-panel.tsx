"use client";
import type { ActionPlan as Plan, ApprovalResult } from "agent-core/workpilot/action-plan";
import type { Delivery } from "../../lib/server/slack/delivery";
import { ActionPlan } from "./action-plan";
import { EvidenceCard } from "./evidence-card";
export function WorkpilotPanel({ plan, result, slack, busy, approve, reject, retry }: {
  plan: Plan | null; result?: ApprovalResult; slack?: Delivery; busy: boolean;
  approve(): void; reject(): void; retry(): void;
}) {
  return <aside className="wp-panel">
    <p className="wp-eyebrow">WORKPILOT · PROPUESTA</p>
    {!plan ? <p>No hay propuesta guardada. La generación del agente está pendiente de P1.</p> : <>
      <h2>Revisión de {plan.issueKey}</h2>
      <p>Plan v{plan.version} · {plan.status}</p>
      <h3>Hallazgos</h3>{plan.findings.map((s, i) => <p key={i}>{s}</p>)}
      <h3>Hipótesis</h3>{plan.hypotheses.length ? plan.hypotheses.map((s, i) => <p key={i}>{s}</p>) : <p>Ninguna registrada.</p>}
      <h3>Información faltante</h3>{plan.missingInfo.length ? plan.missingInfo.map((s, i) => <p key={i}>{s}</p>) : <p>Ninguna registrada.</p>}
      <h3>Evidencia referenciada</h3>{[...new Set(plan.actions.flatMap(a => a.evidenceRefs))].map(s => <EvidenceCard key={s} text={s} />)}
      <ActionPlan actions={plan.actions.map(a => a.type + ": " + JSON.stringify(a.payload))} />
      {plan.actions.map(a => <details key={a.actionId}><summary>Antes / Después · {a.actionId}</summary>
        <pre>{JSON.stringify({ before: a.before ?? null, after: a.after ?? a.payload }, null, 2)}</pre></details>)}
      <h3>Aviso privado de Slack</h3>
      <p>Destino fijo configurado en el servidor. Se enviará después del read-back de Jira.</p>
      <blockquote>{plan.slackDraft.text || "Sin aviso."}</blockquote>
      {plan.status === "pending" && <div className="wp-buttons">
        <button disabled={busy} onClick={reject}>Rechazar</button>
        <button disabled={busy} onClick={approve}>{busy ? "Procesando…" : "Aprobar cambios y aviso"}</button>
      </div>}
      {plan.status === "rejected" && <p role="status">Plan rechazado. No se aplicaron cambios.</p>}
      {result && <section aria-label="Resultado de ejecución" aria-live="polite">
        <h3>Resultado del servidor</h3>
        {result.actions.map(a => <p key={a.actionId}>{a.actionId}: {a.status}
          {a.providerId && <> · ID: <code>{a.providerId}</code></>}{a.error && <> · {a.error}</>}</p>)}
        <p>Slack: {slack?.status || result.slackStatus}</p>
        {result.actions.every(a => a.status === "succeeded") && result.slackStatus !== "sent" &&
          <p>Jira actualizado; aviso de Slack pendiente.</p>}
        {slack?.status === "succeeded" && <p>ID Slack: <code>{slack.providerId}</code></p>}
        {slack && "error" in slack && <p>{slack.error.message}</p>}
        {slack?.status === "failed" && slack.error.retryable &&
          <button disabled={busy} onClick={retry}>Reintentar solo Slack</button>}
      </section>}
    </>}
  </aside>;
}
