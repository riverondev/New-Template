import {
  type Action,
  type ActionPlan,
  type MissingInformation,
  type SlackDraft,
  parseActions,
  parseActionPlan,
} from "./action-plan";
import { type WorkContext, parseWorkContext } from "./context";
import {
  type ReasoningCandidate,
  evidenceFromContext,
  parseReasoningCandidates,
  separateReasoning,
} from "./reasoning";
import {
  type ActionRejection,
  applyActionPolicy,
  policyRejectionsAsMissingInfo,
} from "./policy";
import {
  ContractValidationError,
  type ContractIssue,
  isRecord,
} from "./validation";

export interface GenerateActionPlanInput {
  planId: string;
  version: number;
  context: WorkContext;
  reasoning: readonly ReasoningCandidate[];
  proposedActions: readonly Action[];
  expiresAt: string;
  slackDraft?: SlackDraft;
}

export interface GenerateActionPlanOptions {
  now?: () => Date;
}

export interface GeneratedActionPlan {
  plan: ActionPlan;
  rejectedActions: ActionRejection[];
  rejectedReasoning: ContractIssue[];
}

function coverageMissingInfo(context: WorkContext): MissingInformation[] {
  const values: MissingInformation[] = [];
  if (context.coverage.comments === "unavailable") {
    values.push({
      missingInfoId: "coverage:comments",
      text: "Comments could not be read from Jira.",
      blocking: true,
      evidenceRefs: [],
    });
  }
  if (context.coverage.relatedIssues === "unavailable") {
    values.push({
      missingInfoId: "coverage:relatedIssues",
      text: "Related issues could not be read from Jira.",
      blocking: true,
      evidenceRefs: [],
    });
  }
  if (context.coverage.subtasks === "unavailable") {
    values.push({
      missingInfoId: "coverage:subtasks",
      text: "Existing subtasks could not be read from Jira.",
      blocking: true,
      evidenceRefs: [],
    });
  }
  return values;
}

/**
 * Converts analyzed candidates into a validated proposal. Unsafe actions are
 * removed and surfaced as blocking missing information; they are never
 * rewritten into plausible values.
 */
export function generateActionPlan(
  input: unknown,
  options: GenerateActionPlanOptions = {},
): GeneratedActionPlan {
  if (!isRecord(input)) {
    throw new ContractValidationError("GenerateActionPlanInput", [
      { code: "invalid_type", path: "$", message: "expected an object" },
    ]);
  }
  const context = parseWorkContext(input.context);
  const candidates = parseReasoningCandidates(input.reasoning);
  const proposedActions = parseActions(input.proposedActions);
  let currentTime: Date;
  try {
    currentTime = (options.now ?? (() => new Date()))();
  } catch {
    throw new ContractValidationError("GenerateActionPlanOptions", [
      { code: "invalid_value", path: "$.now", message: "clock failed" },
    ]);
  }
  if (!(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) {
    throw new ContractValidationError("GenerateActionPlanOptions", [
      { code: "invalid_value", path: "$.now", message: "clock returned an invalid date" },
    ]);
  }
  if (
    typeof input.expiresAt === "string" &&
    (Date.parse(input.expiresAt) <= Date.parse(context.fetchedAt) ||
      Date.parse(input.expiresAt) <= currentTime.getTime())
  ) {
    throw new ContractValidationError("ActionPlan", [
      {
        code: "invalid_value",
        path: "$.expiresAt",
        message: "must be later than the context fetch time and current time",
      },
    ]);
  }

  const evidence = evidenceFromContext(context);
  const reasoning = separateReasoning(candidates, evidence);
  const policy = applyActionPolicy(
    context,
    evidence,
    proposedActions,
  );
  const missingInfo = [
    ...reasoning.missingInfo,
    ...coverageMissingInfo(context),
    ...policyRejectionsAsMissingInfo(policy.rejected, evidence),
  ];

  const plan = parseActionPlan({
    planId: input.planId,
    version: input.version,
    issueKey: context.issueKey,
    snapshotVersion: context.snapshotVersion,
    evidence,
    findings: reasoning.findings,
    hypotheses: reasoning.hypotheses,
    missingInfo,
    actions: policy.accepted,
    ...(input.slackDraft !== undefined ? { slackDraft: input.slackDraft } : {}),
    expiresAt: input.expiresAt,
  });

  return {
    plan,
    rejectedActions: policy.rejected,
    rejectedReasoning: reasoning.rejected,
  };
}
