import type { Action, Evidence, MissingInformation } from "./action-plan";
import type { WorkContext } from "./context";
import { assignmentEvidenceId } from "./reasoning";

export type ActionRejectionCode =
  | "missing_evidence"
  | "incomplete_context"
  | "duplicate_work"
  | "duplicate_comment"
  | "duplicate_proposal"
  | "conflicting_actions"
  | "untrusted_instruction"
  | "unsubstantiated_assignee"
  | "ambiguous_assignee"
  | "no_change"
  | "stale_before_value"
  | "invalid_status";

export interface ActionRejection {
  actionId: string;
  code: ActionRejectionCode;
  message: string;
  evidenceRefs: string[];
  matchingIssueKey?: string;
}

export interface ActionPolicyResult {
  accepted: Action[];
  rejected: ActionRejection[];
}

function normalizedText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizedText(value).split(" ").filter((token) => token.length > 2));
}

function similarWork(left: string, right: string): boolean {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (leftTokens.size < 3 || rightTokens.size < 3) {
    return false;
  }
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const smaller = Math.min(leftTokens.size, rightTokens.size);
  return overlap / union >= 0.8 || (smaller >= 3 && overlap === smaller);
}

function rejection(
  action: Action,
  code: ActionRejectionCode,
  message: string,
  matchingIssueKey?: string,
): ActionRejection {
  return {
    actionId: action.actionId,
    code,
    message,
    evidenceRefs: action.evidenceRefs,
    ...(matchingIssueKey ? { matchingIssueKey } : {}),
  };
}

export function applyActionPolicy(
  context: WorkContext,
  evidence: readonly Evidence[],
  actions: readonly Action[],
): ActionPolicyResult {
  const accepted: Action[] = [];
  const rejected: ActionRejection[] = [];
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));

  for (const action of actions) {
    let canonicalAction: Action = action;
    const unknownRefs = action.evidenceRefs.filter((ref) => !evidenceIds.has(ref));
    if (!action.evidenceRefs.length || unknownRefs.length) {
      rejected.push(rejection(action, "missing_evidence", "Action evidence is missing or unknown."));
      continue;
    }
    const citedEvidence = action.evidenceRefs.flatMap((ref) => {
      const item = evidence.find((candidate) => candidate.evidenceId === ref);
      return item ? [item] : [];
    });
    if (citedEvidence.some((item) => item.flags?.includes("potential_prompt_injection"))) {
      rejected.push(rejection(action, "untrusted_instruction", "Potential prompt-injection text cannot support an action."));
      continue;
    }
    if (action.status !== "pending") {
      rejected.push(rejection(action, "invalid_status", "A newly proposed action must be pending."));
      continue;
    }

    if (action.type === "create_subtask") {
      const after = action.after as { summary?: string } | undefined;
      if (!after?.summary) {
        rejected.push(rejection(action, "incomplete_context", "Create-subtask actions require a summary."));
        continue;
      }
      if (context.coverage?.subtasks !== "complete" || context.coverage?.relatedIssues !== "complete" || context.coverage?.comments !== "complete") {
        rejected.push(rejection(action, "incomplete_context", "Cannot exclude duplicate work until subtasks, relations, and comments are available."));
        continue;
      }
      const duplicateSubtask = context.existingSubtasks.find((item) =>
        similarWork(after.summary, item.summary),
      );
      if (duplicateSubtask) {
        rejected.push(rejection(action, "duplicate_work", "Equivalent work already exists as a subtask.", duplicateSubtask.issueKey));
        continue;
      }
      const duplicateRelation = context.relatedIssues.find((item) =>
        similarWork(after.summary, item.summary),
      );
      if (duplicateRelation) {
        rejected.push(rejection(action, "duplicate_work", "Equivalent work already exists as a related issue.", duplicateRelation.issueKey));
        continue;
      }
      const normalizedSummary = normalizedText(after.summary);
      const duplicateComment = context.comments.find((item) =>
        normalizedSummary.length >= 12 && normalizedText(item.body).includes(normalizedSummary),
      );
      if (duplicateComment) {
        rejected.push(rejection(action, "duplicate_work", "A comment states that equivalent work already exists."));
        continue;
      }
      const duplicateProposal = accepted.find(
        (item): item is Extract<Action, { type: "create_subtask" }> =>
          item.type === "create_subtask" &&
          similarWork(after.summary, (item.after as { summary?: string } | undefined)?.summary ?? ""),
      );
      if (duplicateProposal) {
        rejected.push(rejection(action, "duplicate_proposal", "Equivalent work is already proposed in this plan."));
        continue;
      }
    }

    if (action.type === "assign_issue") {
      const before = action.before as { accountId?: string } | null | undefined;
      const after = action.after as { accountId?: string } | undefined;
      if (before !== undefined) {
        const actualBefore = context.assignee && typeof context.assignee !== "string" ? context.assignee.accountId ?? null : null;
        const claimedBefore = before?.accountId ?? null;
        if (actualBefore !== claimedBefore) {
          rejected.push(rejection(action, "stale_before_value", "The proposed assignee before-value does not match Jira."));
          continue;
        }
      }
      if (typeof context.assignee === "object" && context.assignee && context.assignee.accountId === after?.accountId) {
        rejected.push(rejection(action, "no_change", "The issue already has this assignee."));
        continue;
      }
      if (typeof context.assignee === "object" && context.assignee && !context.assignee.accountId) {
        rejected.push(rejection(action, "incomplete_context", "The current assignee has no stable Jira accountId."));
        continue;
      }
      const distinctCandidates = new Set(
        context.assignmentCandidates.map((candidate) => candidate.user.accountId),
      );
      if (distinctCandidates.size > 1) {
        rejected.push(rejection(action, "ambiguous_assignee", "Jira identifies more than one possible responsible user."));
        continue;
      }
      const authority = context.assignmentCandidates.find(
        (candidate) =>
          candidate.user.accountId === after?.accountId &&
          action.evidenceRefs.includes(assignmentEvidenceId(context.issueKey, candidate)),
      );
      const authorityRef = authority
        ? assignmentEvidenceId(context.issueKey, authority)
        : undefined;
      const hasCitedAuthority = authorityRef
        ? action.evidenceRefs.includes(authorityRef)
        : false;
      if (!authority || !hasCitedAuthority) {
        rejected.push(rejection(action, "unsubstantiated_assignee", "No authoritative Jira evidence supports this assignee."));
        continue;
      }
      canonicalAction = {
        ...action,
        before: context.assignee?.accountId
          ? {
              accountId: context.assignee.accountId,
              ...(context.assignee.displayName
                ? { displayName: context.assignee.displayName }
                : {}),
            }
          : null,
        after: {
          accountId: authority.user.accountId,
          displayName: authority.user.displayName,
        },
      };
    }

    if (
      action.type === "set_priority"
    ) {
      const before = action.before as string | null | undefined;
      const after = action.after as string | undefined;
      if (
        before !== undefined &&
        normalizedText(context.priority) !== normalizedText(before ?? "")
      ) {
        rejected.push(rejection(action, "stale_before_value", "The proposed priority before-value does not match Jira."));
        continue;
      }
      if (normalizedText(context.priority) === normalizedText(after ?? "")) {
        rejected.push(rejection(action, "no_change", "The issue already has this priority."));
        continue;
      }
      canonicalAction = { ...action, before: context.priority };
    }

    if (action.type === "add_comment") {
      const after = action.after as { body?: string } | undefined;
      if (context.coverage.comments !== "complete") {
        rejected.push(rejection(action, "incomplete_context", "Cannot exclude a duplicate comment until comments are available."));
        continue;
      }
      if (context.comments.some((item) => normalizedText(item.body) === normalizedText(after?.body ?? ""))) {
        rejected.push(rejection(action, "duplicate_comment", "An equivalent comment already exists."));
        continue;
      }
      const duplicateProposal = accepted.find(
        (item): item is Extract<Action, { type: "add_comment" }> =>
          item.type === "add_comment" &&
          normalizedText((item.after as { body?: string } | undefined)?.body ?? "") === normalizedText(after?.body ?? ""),
      );
      if (duplicateProposal) {
        rejected.push(rejection(action, "duplicate_proposal", "An equivalent comment is already proposed in this plan."));
        continue;
      }
    }

    accepted.push(canonicalAction);
  }
  for (const type of ["assign_issue", "set_priority"] as const) {
    const conflicts = accepted.filter((action) => action.type === type);
    if (conflicts.length <= 1) continue;
    const message = type === "assign_issue"
      ? "A plan may propose at most one assignee change."
      : "A plan may propose at most one priority change.";
    conflicts.forEach((action) => {
      rejected.push(rejection(action, "conflicting_actions", message));
      const index = accepted.indexOf(action);
      if (index >= 0) accepted.splice(index, 1);
    });
  }
  return { accepted, rejected };
}

export function policyRejectionsAsMissingInfo(
  rejections: readonly ActionRejection[],
  evidence: readonly Evidence[] = [],
): MissingInformation[] {
  const knownEvidence = new Set(evidence.map((item) => item.evidenceId));
  const missingInformationCodes = new Set<ActionRejectionCode>([
    "missing_evidence",
    "incomplete_context",
    "untrusted_instruction",
    "unsubstantiated_assignee",
    "ambiguous_assignee",
    "stale_before_value",
  ]);
  return rejections
    .filter((item) => missingInformationCodes.has(item.code))
    .map((item) => ({
      missingInfoId: `policy:${item.actionId}`,
      text: item.message,
      blocking: true,
      evidenceRefs: item.evidenceRefs.filter((ref) => knownEvidence.has(ref)),
    }));
}
