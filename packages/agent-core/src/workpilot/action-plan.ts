import {
  ContractValidationError,
  type ContractIssue,
  type ContractResult,
  integer,
  isRecord,
  isoTimestamp,
  issueKey,
  nonEmptyString,
  optionalHttpUrl,
  optionalString,
  uniqueStrings,
} from "./validation";

export type { Comment, RelatedIssue, Subtask, WorkContext, WorkSubtask } from "./context";

// ─── Evidence and reasoning contracts ────────────────────────────────────────

export type EvidenceSourceType = "issue" | "comment" | "relation" | "subtask";
export type EvidenceFlag = "potential_prompt_injection";

export interface Evidence {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  issueKey: string;
  commentId?: string;
  relatedIssueKey?: string;
  subtaskKey?: string;
  excerpt: string;
  url?: string;
  flags?: EvidenceFlag[];
}

export interface ReasoningStatement {
  statementId: string;
  text: string;
  evidenceRefs: string[];
}

export interface MissingInformation {
  missingInfoId: string;
  text: string;
  blocking: boolean;
  evidenceRefs: string[];
}

export interface SlackDraft {
  channel: string;
  text: string;
}

export type ActionStatus =
  | "pending"
  | "approved"
  | "executing"
  | "succeeded"
  | "failed"
  | "skipped"
  | "reconciling"
  | "reconciled";

export type ActionType =
  | "assign_issue"
  | "set_priority"
  | "create_subtask"
  | "add_comment";

export interface AssigneeValue {
  accountId: string;
  displayName?: string;
}

export type ActionPayloadMap = {
  assign_issue: { issueKey: string; user: string };
  set_priority: { issueKey: string; priority: string };
  create_subtask: { parentKey: string; summary: string; description?: string; assignee?: string };
  add_comment: { issueKey: string; body: string };
};

export type Action = {
  actionId: string;
  type: ActionType;
  payload?: Record<string, unknown>;
  before?: unknown;
  after?: unknown;
  evidenceRefs: string[];
  status: ActionStatus;
  dryRun?: boolean;
  errorReason?: string;
};

// ─── ActionPlan ───────────────────────────────────────────────────────────────
// Shared shape used by the contract validator and the executor/runtime.

export type ActionPlan = {
  planId: string;
  version: number;
  issueKey: string;
  snapshotVersion: string;
  snapshotHash?: string;
  evidence?: Evidence[];
  findings: Array<ReasoningStatement | string>;
  hypotheses: Array<ReasoningStatement | string>;
  missingInfo: Array<MissingInformation | string>;
  actions: Action[];
  slackDraft?: SlackDraft;
  expiresAt: string;
  createdAt?: string;
  status?: "pending" | "approved" | "rejected" | "executed" | "expired" | "invalidated";
};

// ─── Execution ────────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "uncertain"
  | "reconciled";

export type Execution = {
  executionId: string;
  planId: string;
  planVersion: number;
  issueKey: string;
  actionId: string;
  startedAt: string;
  finishedAt?: string;
  status: ExecutionStatus;
  provider: "jira" | "slack";
  providerId?: string;
  error?: string;
  errorCode?: string;
  retryable: boolean;
  dryRun: boolean;
  latencyMs?: number;
};

export type JiraErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNKNOWN";

export function statusToJiraErrorCode(status: number): JiraErrorCode {
  if (!status || status === 0) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 400) return "BAD_REQUEST";
  return "UNKNOWN";
}

// ─── Approval request/result ───────────────────────────────────────────────────

export type ApprovalRequest = {
  planId: string;
  version: number;
  dryRun?: boolean;
};

export type ActionResult = {
  actionId: string;
  status: ActionStatus;
  providerId?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
};

export type ApprovalResult = {
  planId: string;
  issueKey: string;
  actions: ActionResult[];
  slackStatus: "sent" | "pending" | "failed" | "skipped";
  slackProviderId?: string;
};

export function parseApprovalRequest(raw: unknown): ApprovalRequest {
  if (!raw || typeof raw !== "object") throw new Error("ApprovalRequest must be an object");
  const r = raw as Record<string, unknown>;
  if (typeof r.planId !== "string" || !r.planId) {
    throw new Error("ApprovalRequest.planId must be a non-empty string");
  }
  if (typeof r.version !== "number" || !Number.isInteger(r.version) || r.version < 1) {
    throw new Error("ApprovalRequest.version must be a positive integer");
  }
  return {
    planId: r.planId as string,
    version: r.version as number,
    dryRun: r.dryRun === true,
  };
}

function parseSourceType(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): EvidenceSourceType | undefined {
  if (value === "issue" || value === "comment" || value === "relation" || value === "subtask") {
    return value;
  }
  issues.push({
    code: "invalid_value",
    path,
    message: 'expected "issue", "comment", "relation", or "subtask"',
  });
  return undefined;
}

function parseEvidenceFlags(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): EvidenceFlag[] | undefined {
  if (value === undefined) return undefined;
  const flags = uniqueStrings(value, path, issues);
  if (!flags) return undefined;
  flags.forEach((flag, index) => {
    if (flag !== "potential_prompt_injection") {
      issues.push({
        code: "invalid_value",
        path: `${path}[${index}]`,
        message: 'expected "potential_prompt_injection"',
      });
    }
  });
  return issues.some((issue) => issue.path.startsWith(path))
    ? undefined
    : (flags as EvidenceFlag[]);
}

function parseEvidenceValue(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): Evidence | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issues.push({ code: "invalid_type", path, message: "expected an object" });
    return undefined;
  }
  const evidenceId = nonEmptyString(value.evidenceId, `${path}.evidenceId`, issues);
  const sourceType = parseSourceType(value.sourceType, `${path}.sourceType`, issues);
  const parsedIssueKey = issueKey(value.issueKey, `${path}.issueKey`, issues);
  const commentId = optionalString(value.commentId, `${path}.commentId`, issues);
  const relatedIssueKey = value.relatedIssueKey === undefined
    ? undefined
    : issueKey(value.relatedIssueKey, `${path}.relatedIssueKey`, issues);
  const subtaskKey = value.subtaskKey === undefined
    ? undefined
    : issueKey(value.subtaskKey, `${path}.subtaskKey`, issues);
  const excerpt = nonEmptyString(value.excerpt, `${path}.excerpt`, issues);
  const url = optionalHttpUrl(value.url, `${path}.url`, issues);
  const flags = parseEvidenceFlags(value.flags, `${path}.flags`, issues);

  if (sourceType === "comment" && !commentId) {
    issues.push({
      code: "missing_value",
      path: `${path}.commentId`,
      message: "comment evidence requires commentId",
    });
  }
  if (sourceType === "relation" && !relatedIssueKey) {
    issues.push({
      code: "missing_value",
      path: `${path}.relatedIssueKey`,
      message: "relation evidence requires relatedIssueKey",
    });
  }
  if (sourceType === "subtask" && !subtaskKey) {
    issues.push({
      code: "missing_value",
      path: `${path}.subtaskKey`,
      message: "subtask evidence requires subtaskKey",
    });
  }
  const provenanceFields = [
    ["commentId", value.commentId],
    ["relatedIssueKey", value.relatedIssueKey],
    ["subtaskKey", value.subtaskKey],
  ] as const;
  const allowedField = sourceType === "comment"
    ? "commentId"
    : sourceType === "relation"
      ? "relatedIssueKey"
      : sourceType === "subtask"
        ? "subtaskKey"
        : undefined;

  for (const [field, fieldValue] of provenanceFields) {
    if (fieldValue !== undefined && field !== allowedField) {
      issues.push({
        code: "policy_violation",
        path: `${path}.${field}`,
        message: `${field} is not valid for ${sourceType ?? "unknown"} evidence`,
      });
    }
  }

  return issues.length === start && evidenceId && sourceType && parsedIssueKey && excerpt
    ? {
        evidenceId,
        sourceType,
        issueKey: parsedIssueKey,
        ...(commentId ? { commentId } : {}),
        ...(relatedIssueKey ? { relatedIssueKey } : {}),
        ...(subtaskKey ? { subtaskKey } : {}),
        excerpt,
        ...(url ? { url } : {}),
        ...(flags ? { flags } : {}),
      }
    : undefined;
}

function parseReasoningStatement(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): ReasoningStatement | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issues.push({ code: "invalid_type", path, message: "expected an object" });
    return undefined;
  }
  const statementId = nonEmptyString(value.statementId, `${path}.statementId`, issues);
  const text = nonEmptyString(value.text, `${path}.text`, issues);
  const evidenceRefs = uniqueStrings(value.evidenceRefs, `${path}.evidenceRefs`, issues);
  if (evidenceRefs && evidenceRefs.length === 0) {
    issues.push({
      code: "missing_value",
      path: `${path}.evidenceRefs`,
      message: "a material statement requires evidence",
    });
  }
  return issues.length === start && statementId && text && evidenceRefs
    ? { statementId, text, evidenceRefs }
    : undefined;
}

function parseMissingInformation(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): MissingInformation | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issues.push({ code: "invalid_type", path, message: "expected an object" });
    return undefined;
  }
  const missingInfoId = nonEmptyString(value.missingInfoId, `${path}.missingInfoId`, issues);
  const text = nonEmptyString(value.text, `${path}.text`, issues);
  const evidenceRefs = uniqueStrings(value.evidenceRefs, `${path}.evidenceRefs`, issues);
  if (typeof value.blocking !== "boolean") {
    issues.push({
      code: value.blocking === undefined ? "missing_value" : "invalid_type",
      path: `${path}.blocking`,
      message: "expected a boolean",
    });
  }
  return issues.length === start && missingInfoId && text && evidenceRefs && typeof value.blocking === "boolean"
    ? { missingInfoId, text, blocking: value.blocking, evidenceRefs }
    : undefined;
}

function parseStatus(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): ActionStatus | undefined {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "executing" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "skipped" ||
    value === "reconciling" ||
    value === "reconciled"
  ) {
    return value;
  }
  issues.push({ code: "invalid_value", path, message: "invalid action status" });
  return undefined;
}

function parseAssigneeValue(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): AssigneeValue | undefined {
  if (!isRecord(value)) {
    issues.push({ code: "invalid_type", path, message: "expected an object" });
    return undefined;
  }
  const accountId = nonEmptyString(value.accountId, `${path}.accountId`, issues);
  const displayName = optionalString(value.displayName, `${path}.displayName`, issues);
  return accountId ? { accountId, ...(displayName ? { displayName } : {}) } : undefined;
}

function parseActionValue(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): Action | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issues.push({ code: "invalid_type", path, message: "expected an object" });
    return undefined;
  }
  const actionId = nonEmptyString(value.actionId, `${path}.actionId`, issues);
  const evidenceRefs = uniqueStrings(value.evidenceRefs, `${path}.evidenceRefs`, issues);
  const status = parseStatus(value.status, `${path}.status`, issues);
  if (evidenceRefs && evidenceRefs.length === 0) {
    issues.push({
      code: "missing_value",
      path: `${path}.evidenceRefs`,
      message: "an action requires evidence",
    });
  }

  const payload = value.payload !== undefined && isRecord(value.payload)
    ? (value.payload as Record<string, unknown>)
    : undefined;

  if (value.type === "assign_issue") {
    const after = parseAssigneeValue(value.after, `${path}.after`, issues);
    const before = value.before === undefined
      ? undefined
      : value.before === null
        ? null
        : parseAssigneeValue(value.before, `${path}.before`, issues);
    return issues.length === start && actionId && evidenceRefs && status && after
      ? {
          actionId,
          type: "assign_issue",
          ...(payload ? { payload } : {}),
          ...(value.before !== undefined ? { before: before ?? null } : {}),
          after,
          evidenceRefs,
          status,
        }
      : undefined;
  }

  if (value.type === "set_priority") {
    const before = value.before === undefined
      ? undefined
      : nonEmptyString(value.before, `${path}.before`, issues);
    const after = nonEmptyString(value.after, `${path}.after`, issues);
    return issues.length === start && actionId && evidenceRefs && status && after
      ? {
          actionId,
          type: "set_priority",
          ...(payload ? { payload } : {}),
          ...(before ? { before } : {}),
          after,
          evidenceRefs,
          status,
        }
      : undefined;
  }

  if (value.type === "create_subtask") {
    if (!isRecord(value.after)) {
      issues.push({ code: "invalid_type", path: `${path}.after`, message: "expected an object" });
      return undefined;
    }
    const summary = nonEmptyString(value.after.summary, `${path}.after.summary`, issues);
    const description = optionalString(value.after.description, `${path}.after.description`, issues);
    return issues.length === start && actionId && evidenceRefs && status && summary
      ? {
          actionId,
          type: "create_subtask",
          ...(payload ? { payload } : {}),
          after: { summary, ...(description ? { description } : {}) },
          evidenceRefs,
          status,
        }
      : undefined;
  }

  if (value.type === "add_comment") {
    if (!isRecord(value.after)) {
      issues.push({ code: "invalid_type", path: `${path}.after`, message: "expected an object" });
      return undefined;
    }
    const body = nonEmptyString(value.after.body, `${path}.after.body`, issues);
    return issues.length === start && actionId && evidenceRefs && status && body
      ? {
          actionId,
          type: "add_comment",
          ...(payload ? { payload } : {}),
          after: { body },
          evidenceRefs,
          status,
        }
      : undefined;
  }

  issues.push({
    code: "invalid_value",
    path: `${path}.type`,
    message: "action type is outside the WorkPilot allowlist",
  });
  return undefined;
}

export function safeParseActions(value: unknown): ContractResult<Action[]> {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ code: value === undefined ? "missing_value" : "invalid_type", path: "$", message: "expected an array" }],
    };
  }
  const issues: ContractIssue[] = [];
  const actions = value.flatMap((item, index) => {
    const parsed = parseActionValue(item, `$[${index}]`, issues);
    return parsed ? [parsed] : [];
  });
  return issues.length ? { ok: false, issues } : { ok: true, value: actions };
}

export function parseActions(value: unknown): Action[] {
  const result = safeParseActions(value);
  if (!result.ok) {
    throw new ContractValidationError("Action[]", result.issues);
  }
  return result.value;
}

function parseList<T>(
  value: unknown,
  path: string,
  issues: ContractIssue[],
  parser: (item: unknown, itemPath: string, itemIssues: ContractIssue[]) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({
      code: value === undefined ? "missing_value" : "invalid_type",
      path,
      message: "expected an array",
    });
    return undefined;
  }
  return value.flatMap((item, index) => {
    const parsed = parser(item, `${path}[${index}]`, issues);
    return parsed ? [parsed] : [];
  });
}

function parseSlackDraft(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): SlackDraft | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    issues.push({ code: "invalid_type", path, message: "expected an object" });
    return undefined;
  }
  const channel = nonEmptyString(value.channel, `${path}.channel`, issues);
  const text = nonEmptyString(value.text, `${path}.text`, issues);
  return channel && text ? { channel, text } : undefined;
}

function reportDuplicates(
  values: readonly { id: string; path: string }[],
  issues: ContractIssue[],
) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) {
      issues.push({
        code: "duplicate_value",
        path: value.path,
        message: `duplicate identifier ${value.id}`,
      });
    }
    seen.add(value.id);
  }
}

function reportUnknownEvidenceRefs(
  values: readonly { refs: string[]; path: string }[],
  evidenceIds: Set<string>,
  issues: ContractIssue[],
) {
  for (const value of values) {
    value.refs.forEach((ref, index) => {
      if (!evidenceIds.has(ref)) {
        issues.push({
          code: "unknown_reference",
          path: `${value.path}[${index}]`,
          message: `unknown evidence reference ${ref}`,
        });
      }
    });
  }
}

export function safeParseActionPlan(value: unknown): ContractResult<ActionPlan> {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{ code: "invalid_type", path: "$", message: "expected an object" }],
    };
  }
  const issues: ContractIssue[] = [];
  const planId = nonEmptyString(value.planId, "$.planId", issues);
  const version = integer(value.version, "$.version", issues, 1);
  const parsedIssueKey = issueKey(value.issueKey, "$.issueKey", issues);
  const snapshotVersion = nonEmptyString(value.snapshotVersion, "$.snapshotVersion", issues);
  const snapshotHash = value.snapshotHash === undefined ? undefined : nonEmptyString(value.snapshotHash, "$.snapshotHash", issues);
  const createdAt = value.createdAt === undefined ? undefined : isoTimestamp(value.createdAt, "$.createdAt", issues);
  const evidence = parseList(value.evidence, "$.evidence", issues, parseEvidenceValue);
  const findings = parseList(value.findings, "$.findings", issues, parseReasoningStatement);
  const hypotheses = parseList(value.hypotheses, "$.hypotheses", issues, parseReasoningStatement);
  const missingInfo = parseList(value.missingInfo, "$.missingInfo", issues, parseMissingInformation);
  const actions = parseList(value.actions, "$.actions", issues, parseActionValue);
  const slackDraft = parseSlackDraft(value.slackDraft, "$.slackDraft", issues);
  const expiresAt = isoTimestamp(value.expiresAt, "$.expiresAt", issues);

  if (evidence) {
    reportDuplicates(
      evidence.map((item, index) => ({ id: item.evidenceId, path: `$.evidence[${index}].evidenceId` })),
      issues,
    );
    if (parsedIssueKey) {
      evidence.forEach((item, index) => {
        if (item.issueKey !== parsedIssueKey) {
          issues.push({
            code: "policy_violation",
            path: `$.evidence[${index}].issueKey`,
            message: `evidence must belong to plan issue ${parsedIssueKey}`,
          });
        }
      });
    }
  }

  if (findings && hypotheses) {
    reportDuplicates(
      [
        ...findings.map((item, index) => ({ id: item.statementId, path: `$.findings[${index}].statementId` })),
        ...hypotheses.map((item, index) => ({ id: item.statementId, path: `$.hypotheses[${index}].statementId` })),
      ],
      issues,
    );
  }

  if (missingInfo) {
    reportDuplicates(
      missingInfo.map((item, index) => ({ id: item.missingInfoId, path: `$.missingInfo[${index}].missingInfoId` })),
      issues,
    );
  }

  if (actions) {
    reportDuplicates(
      actions.map((item, index) => ({ id: item.actionId, path: `$.actions[${index}].actionId` })),
      issues,
    );
  }

  if (evidence && findings && hypotheses && missingInfo && actions) {
    const evidenceIds = new Set(evidence.map((item) => item.evidenceId));
    reportUnknownEvidenceRefs(
      [
        ...findings.map((item, index) => ({ refs: item.evidenceRefs, path: `$.findings[${index}].evidenceRefs` })),
        ...hypotheses.map((item, index) => ({ refs: item.evidenceRefs, path: `$.hypotheses[${index}].evidenceRefs` })),
        ...missingInfo.map((item, index) => ({ refs: item.evidenceRefs, path: `$.missingInfo[${index}].evidenceRefs` })),
        ...actions.map((item, index) => ({ refs: item.evidenceRefs, path: `$.actions[${index}].evidenceRefs` })),
      ],
      evidenceIds,
      issues,
    );
  }

  if (
    issues.length ||
    !planId ||
    version === undefined ||
    !parsedIssueKey ||
    !snapshotVersion ||
    !evidence ||
    !findings ||
    !hypotheses ||
    !missingInfo ||
    !actions ||
    !expiresAt
  ) {
    return { ok: false, issues };
  }

  const plan: ActionPlan = {
    planId,
    version,
    issueKey: parsedIssueKey,
    snapshotVersion,
    evidence,
    findings,
    hypotheses,
    missingInfo,
    actions,
    ...(slackDraft ? { slackDraft } : {}),
    expiresAt,
  };

  if (snapshotHash) {
    plan.snapshotHash = snapshotHash;
  }
  if (createdAt) {
    plan.createdAt = createdAt;
  }
  if (value.status !== undefined && typeof value.status === "string") {
    plan.status = value.status as ActionPlan["status"];
  }

  return { ok: true, value: plan };
}

export function parseActionPlan(value: unknown): ActionPlan {
  const result = safeParseActionPlan(value);
  if (!result.ok) {
    throw new ContractValidationError("ActionPlan", result.issues);
  }
  return result.value;
}
