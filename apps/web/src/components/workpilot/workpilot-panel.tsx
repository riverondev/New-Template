"use client";
import type { ActionPlan as Plan, ApprovalResult } from "agent-core/workpilot/action-plan";
import type { Delivery } from "../../lib/server/slack/delivery";
import { ActionPlan } from "./action-plan";
import { EvidenceCard } from "./evidence-card";
export function WorkpilotPanel({ plan, result, slack, busy, approve, reject, retry }: {
  plan: Plan | null; result?: ApprovalResult; slack?: Delivery; busy: boolean;
  approve(): void; reject(): void; retry(): void;
}) {
  const renderTextEntry = (item: { text: string } | string, index: number) => (
    <p key={index}>{typeof item === "string" ? item : item.text}</p>
  );

  return <aside className="wp-panel">
    <p className="wp-eyebrow">WORKPILOT · PROPUESTA</p>
    {!plan ? <p>Pedile al agente que prepare una propuesta para este ticket.</p> : <>
      <h2>Revisión de {plan.issueKey}</h2>
      <p>Plan v{plan.version} · {plan.status}</p>
      <h3>Hallazgos</h3>{plan.findings.map(renderTextEntry)}
      <h3>Hipótesis</h3>{plan.hypotheses.length ? plan.hypotheses.map(renderTextEntry) : <p>Ninguna registrada.</p>}
      <h3>Información faltante</h3>{plan.missingInfo.length ? plan.missingInfo.map((item, index) => renderTextEntry(item, index)) : <p>Ninguna registrada.</p>}
      <h3>Evidencia referenciada</h3>{plan.evidence.filter(e => [...plan.actions, ...plan.findings, ...plan.hypotheses, ...plan.missingInfo].some(item => item.evidenceRefs.includes(e.evidenceId))).map(e => <div key={e.evidenceId}><small>{e.sourceType} · {e.issueKey}{e.commentId ? " · " + e.commentId : ""}</small><EvidenceCard text={e.excerpt} /></div>)}
      <ActionPlan actions={plan.actions.map(a => a.type + ": " + JSON.stringify(a.after))} />
      {plan.actions.map(a => <details key={a.actionId}><summary>Antes / Después · {a.actionId}</summary>
        <pre>{JSON.stringify({ before: (a as { before?: unknown }).before ?? null, after: a.after }, null, 2)}</pre></details>)}
      <h3>Aviso privado de Slack</h3>
      <p>Destino fijo configurado en el servidor. Se enviará después del read-back de Jira.</p>
      <blockquote>{plan.slackDraft?.text || "Sin aviso."}</blockquote>
      {!plan.actions.length && <p>Este análisis no propone cambios. No necesita aprobación ni envía Slack.</p>}
      {plan.status === "pending" && plan.actions.length > 0 && <div className="wp-buttons">
        <button disabled={busy} onClick={reject}>Rechazar</button>
        <button disabled={busy} onClick={approve}>{busy ? "Procesando…" : "Aprobar cambios y aviso"}</button>
      </div>}
      {plan.status === "rejected" && <p role="status">Plan rechazado. No se aplicaron cambios.</p>}
      {result && <section aria-label="Resultado de ejecución" aria-live="polite">
        <h3>Resultado del servidor</h3>
        {result.actions.map(a => <p key={a.actionId}>{a.actionId}: {a.status}
          {a.providerId && <> · ID: <code>{a.providerId}</code></>}{a.error && <> · {a.error}</>}</p>)}
        <p>Slack: {slack?.status || result.slackStatus}</p>
        {result.actions.every(a => a.status === "succeeded") && result.slackStatus !== "sent" && result.slackStatus !== "skipped" &&
          <p>Jira actualizado; aviso de Slack pendiente.</p>}
        {slack?.status === "succeeded" && <p>ID Slack: <code>{slack.providerId}</code></p>}
        {slack && "error" in slack && <p>{slack.error.message}</p>}
        {slack?.status === "failed" && slack.error.retryable &&
          <button disabled={busy} onClick={retry}>Reintentar solo Slack</button>}
      </section>}
    </>}
  </aside>;
}
