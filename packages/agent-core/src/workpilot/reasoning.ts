import type { WorkContext } from "./context";
import type { AssignmentCandidate } from "./context";
import type {
  Evidence,
  MissingInformation,
  ReasoningStatement,
} from "./action-plan";
import {
  ContractValidationError,
  type ContractIssue,
  type ContractResult,
  isRecord,
  nonEmptyString,
  uniqueStrings,
} from "./validation";

export type ReasoningCandidate =
  | {
      kind: "fact" | "hypothesis";
      statementId: string;
      text: string;
      evidenceRefs: string[];
    }
  | {
      kind: "missing_information";
      missingInfoId: string;
      text: string;
      blocking: boolean;
      evidenceRefs?: string[];
    };

export interface SeparatedReasoning {
  findings: ReasoningStatement[];
  hypotheses: ReasoningStatement[];
  missingInfo: MissingInformation[];
  rejected: ContractIssue[];
}

export function safeParseReasoningCandidates(
  value: unknown,
): ContractResult<ReasoningCandidate[]> {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ code: "invalid_type", path: "$", message: "expected an array" }],
    };
  }
  const issues: ContractIssue[] = [];
  const candidates: ReasoningCandidate[] = [];
  const seen = new Set<string>();

  value.forEach((item, index) => {
    const path = `$[${index}]`;
    const start = issues.length;
    if (!isRecord(item)) {
      issues.push({ code: "invalid_type", path, message: "expected an object" });
      return;
    }
    const text = nonEmptyString(item.text, `${path}.text`, issues);
    const evidenceRefs = item.evidenceRefs === undefined && item.kind === "missing_information"
      ? []
      : uniqueStrings(item.evidenceRefs, `${path}.evidenceRefs`, issues);
    if (item.kind === "fact" || item.kind === "hypothesis") {
      const statementId = nonEmptyString(item.statementId, `${path}.statementId`, issues);
      if (statementId && seen.has(statementId)) {
        issues.push({ code: "duplicate_value", path: `${path}.statementId`, message: `duplicate identifier ${statementId}` });
      }
      if (issues.length === start && statementId && text && evidenceRefs) {
        seen.add(statementId);
        candidates.push({ kind: item.kind, statementId, text, evidenceRefs });
      }
      return;
    }
    if (item.kind === "missing_information") {
      const missingInfoId = nonEmptyString(item.missingInfoId, `${path}.missingInfoId`, issues);
      if (
        missingInfoId &&
        ["policy:", "coverage:", "read:"].some((prefix) => missingInfoId.startsWith(prefix))
      ) {
        issues.push({
          code: "policy_violation",
          path: `${path}.missingInfoId`,
          message: "identifier uses a reserved WorkPilot namespace",
        });
      }
      if (typeof item.blocking !== "boolean") {
        issues.push({
          code: item.blocking === undefined ? "missing_value" : "invalid_type",
          path: `${path}.blocking`,
          message: "expected a boolean",
        });
      }
      if (missingInfoId && seen.has(missingInfoId)) {
        issues.push({ code: "duplicate_value", path: `${path}.missingInfoId`, message: `duplicate identifier ${missingInfoId}` });
      }
      if (
        issues.length === start &&
        missingInfoId &&
        text &&
        evidenceRefs &&
        typeof item.blocking === "boolean"
      ) {
        seen.add(missingInfoId);
        candidates.push({
          kind: "missing_information",
          missingInfoId,
          text,
          blocking: item.blocking,
          evidenceRefs,
        });
      }
      return;
    }
    issues.push({
      code: "invalid_value",
      path: `${path}.kind`,
      message: 'expected "fact", "hypothesis", or "missing_information"',
    });
  });

  return issues.length ? { ok: false, issues } : { ok: true, value: candidates };
}

export function parseReasoningCandidates(value: unknown): ReasoningCandidate[] {
  const result = safeParseReasoningCandidates(value);
  if (!result.ok) {
    throw new ContractValidationError("ReasoningCandidate[]", result.issues);
  }
  return result.value;
}

function excerpt(value: string, maximum = 280): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maximum
    ? compact
    : `${compact.slice(0, maximum - 1).trimEnd()}…`;
}

export function looksLikePromptInjection(value: string): boolean {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return [
    /\b(?:ignore|disregard|forget)\b.{0,48}\b(?:instructions|rules|prompt)\b/,
    /\b(?:ignora|olvida|descarta)\b.{0,48}\b(?:instrucciones|reglas|prompt)\b/,
    /\b(?:skip|bypass|omit)\b.{0,32}\bapproval\b/,
    /\b(?:aprueba|aprobar|apruebala|apruebalo|aprobala|aprobalo)\b.{0,48}\b(?:sin|omite)\b.{0,32}\b(?:humana|usuario|aprobacion)\b/,
    /\b(?:omite|evita|salta)\b.{0,32}\b(?:aprobacion|revision)\b/,
    /\bno\s+(?:sigas|obedezcas)\b.{0,32}\b(?:reglas|instrucciones)\b.{0,48}\b(?:asigna|ejecuta|cambia|ignora)\b/,
    /\bfollow\b.{0,32}\binstructions\b.{0,48}\b(?:instead|call|write)\b/,
    /\b(?:call|invoke|use)\b.{0,24}\bwrite\s+tool\b/,
    /\b(?:llama|usa|invoca)\b.{0,24}\bherramienta\s+de\s+escritura\b/,
    /\b(?:system|developer)\s+(?:prompt|message)\b/,
    /\b(?:pretend|roleplay)\b.{0,32}\b(?:system|developer|administrator)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function assignmentEvidenceId(
  issueKey: string,
  candidate: AssignmentCandidate,
): string {
  return `assignment:${issueKey}:${candidate.source.fieldId}:${candidate.user.accountId}`;
}

/** Builds traceable references without interpreting Jira text as instructions. */
export function evidenceFromContext(context: WorkContext): Evidence[] {
  const issueText = context.description
    ? `${context.summary} — ${context.description}`
    : context.summary;
  return [
    {
      evidenceId: `issue:${context.issueKey}`,
      sourceType: "issue",
      issueKey: context.issueKey,
      excerpt: excerpt(issueText),
      ...(context.url ? { url: context.url } : {}),
      ...(looksLikePromptInjection(issueText)
        ? { flags: ["potential_prompt_injection" as const] }
        : {}),
    },
    ...context.comments.map((comment) => ({
      evidenceId: `comment:${context.issueKey}:${comment.id}`,
      sourceType: "comment" as const,
      issueKey: context.issueKey,
      commentId: comment.id,
      excerpt: excerpt(comment.body),
      ...(comment.url ? { url: comment.url } : {}),
      ...(looksLikePromptInjection(comment.body)
        ? { flags: ["potential_prompt_injection" as const] }
        : {}),
    })),
    ...context.relatedIssues.map((related) => ({
      evidenceId: `relation:${context.issueKey}:${related.issueKey}`,
      sourceType: "relation" as const,
      issueKey: context.issueKey,
      relatedIssueKey: related.issueKey,
      excerpt: excerpt(
        `${related.relation}: ${related.issueKey} — ${related.summary} [${related.status}]`,
      ),
      ...(related.url ? { url: related.url } : {}),
      ...(looksLikePromptInjection(`${related.relation} ${related.summary} ${related.status}`)
        ? { flags: ["potential_prompt_injection" as const] }
        : {}),
    })),
    ...(context.assignmentCandidates ?? []).map((candidate) => ({
      evidenceId: assignmentEvidenceId(context.issueKey, candidate),
      sourceType: "issue" as const,
      issueKey: context.issueKey,
      excerpt: excerpt(
        `${candidate.source.fieldId}: ${candidate.user.displayName} (${candidate.user.accountId})`,
      ),
    })),
    ...context.existingSubtasks.map((subtask) => ({
      evidenceId: `subtask:${context.issueKey}:${subtask.issueKey}`,
      sourceType: "subtask" as const,
      issueKey: context.issueKey,
      subtaskKey: subtask.issueKey,
      excerpt: excerpt(`${subtask.issueKey} — ${subtask.summary} [${subtask.status}]`),
      ...(subtask.url ? { url: subtask.url } : {}),
      ...(looksLikePromptInjection(`${subtask.summary} ${subtask.status}`)
        ? { flags: ["potential_prompt_injection" as const] }
        : {}),
    })),
  ];
}

/**
 * Partitions model/runtime candidates and rejects material conclusions without
 * known evidence instead of silently promoting them to facts.
 */
export function separateReasoning(
  candidates: readonly ReasoningCandidate[],
  evidence: readonly Evidence[],
): SeparatedReasoning {
  const findings: ReasoningStatement[] = [];
  const hypotheses: ReasoningStatement[] = [];
  const missingInfo: MissingInformation[] = [];
  const rejected: ContractIssue[] = [];
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));

  candidates.forEach((candidate, index) => {
    const refs = candidate.evidenceRefs ?? [];
    const unknown = refs.filter((ref) => !evidenceIds.has(ref));
    if (unknown.length) {
      rejected.push({
        code: "unknown_reference",
        path: `$[${index}].evidenceRefs`,
        message: `unknown evidence references: ${unknown.join(", ")}`,
      });
      return;
    }

    if (candidate.kind === "missing_information") {
      missingInfo.push({
        missingInfoId: candidate.missingInfoId,
        text: candidate.text,
        blocking: candidate.blocking,
        evidenceRefs: refs,
      });
      return;
    }

    if (refs.length === 0) {
      rejected.push({
        code: "policy_violation",
        path: `$[${index}].evidenceRefs`,
        message: `${candidate.kind} requires at least one evidence reference`,
      });
      return;
    }
    const statement = {
      statementId: candidate.statementId,
      text: candidate.text,
      evidenceRefs: refs,
    };
    if (candidate.kind === "fact") {
      findings.push(statement);
    } else {
      hypotheses.push(statement);
    }
  });

  return { findings, hypotheses, missingInfo, rejected };
}
