import type { WorkContext } from "agent-core/workpilot/action-plan";
import { getIssue, getSubtasks } from "../jira/issues";
import { getIssueComments } from "../jira/comments";
import { getRelatedIssues } from "../jira/relations";
import { computeSnapshotHash } from "./plans";
import { validateIssueKey } from "./validation";
export async function readContext(key: string): Promise<WorkContext> {
  validateIssueKey(key);
  const [issue, comments, relatedIssues, existingSubtasks] = await Promise.all([
    getIssue(key), getIssueComments(key), getRelatedIssues(key), getSubtasks(key),
  ]);
  const context = { ...issue, comments, relatedIssues, existingSubtasks,
    snapshotVersion: issue.updatedAt, fetchedAt: new Date().toISOString(), snapshotHash: "" };
  context.snapshotHash = computeSnapshotHash(context);
  return context;
}
