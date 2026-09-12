import type { MissingInformation } from "./action-plan";
import type { SelectedTicket, WorkContext } from "./context";
import {
  type ContextReadGap,
  type WorkPilotReadPort,
  readWorkContext,
} from "./tools";
import {
  type ReasoningCandidate,
  evidenceFromContext,
  parseReasoningCandidates,
  separateReasoning,
} from "./reasoning";
import type { ContractIssue } from "./validation";

export type MissingInformationAnalyzer = (
  context: WorkContext,
) => Promise<readonly ReasoningCandidate[]> | readonly ReasoningCandidate[];

interface FollowUpBase {
  issueKey: string;
  gaps: ContextReadGap[];
  missingInfo: MissingInformation[];
}

export type MissingInformationFollowUp =
  | (FollowUpBase & { ok: false })
  | (FollowUpBase & {
      ok: true;
      context: WorkContext;
      snapshotVersion: string;
      snapshotChanged: boolean;
      refreshedAt: string;
      rejectedReasoning: ContractIssue[];
    });

function gapsAsMissingInfo(gaps: readonly ContextReadGap[]): MissingInformation[] {
  return gaps.map((gap) => ({
    missingInfoId: `read:${gap.source}`,
    text: `${gap.source} is unavailable: ${gap.message}`,
    blocking: true,
    evidenceRefs: [],
  }));
}

/** Always calls the read port before analysis; previous chat or plan state is informational only. */
export async function refreshMissingInformation(input: {
  selectedTicket: SelectedTicket | string;
  port: WorkPilotReadPort;
  analyze: MissingInformationAnalyzer;
  previousSnapshotVersion?: string;
  now?: () => Date;
}): Promise<MissingInformationFollowUp> {
  const read = await readWorkContext(input.selectedTicket, input.port, input.now);
  if (!read.ok) {
    return {
      ok: false,
      issueKey: read.issueKey,
      gaps: read.gaps,
      missingInfo: gapsAsMissingInfo(read.gaps),
    };
  }

  const candidates = parseReasoningCandidates(await input.analyze(read.context));
  const separated = separateReasoning(candidates, evidenceFromContext(read.context));
  return {
    ok: true,
    issueKey: read.context.issueKey,
    context: read.context,
    snapshotVersion: read.context.snapshotVersion,
    snapshotChanged:
      input.previousSnapshotVersion !== undefined &&
      input.previousSnapshotVersion !== read.context.snapshotVersion,
    refreshedAt: read.context.fetchedAt,
    gaps: read.gaps,
    missingInfo: [...separated.missingInfo, ...gapsAsMissingInfo(read.gaps)],
    rejectedReasoning: separated.rejected,
  };
}
