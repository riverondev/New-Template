import type { IssueSnapshot, WorkContext } from "../context";
import type {
  IssueKeyInput,
  ProjectKeyInput,
  ReadToolName,
  WorkPilotReadPort,
} from "../tools";

type CallCounts = Record<ReadToolName, number>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function snapshot(context: WorkContext): IssueSnapshot {
  const {
    comments: _comments,
    relatedIssues: _relatedIssues,
    fetchedAt: _fetchedAt,
    coverage: _coverage,
    ...issue
  } = context;
  return clone(issue);
}

export class MemoryWorkPilotReadPort implements WorkPilotReadPort {
  readonly calls: CallCounts = {
    get_issue: 0,
    get_issue_comments: 0,
    get_related_issues: 0,
    get_project_issues: 0,
    get_subtasks: 0,
  };

  private readonly contexts = new Map<string, WorkContext>();
  private readonly failures = new Map<ReadToolName, string>();

  constructor(contexts: readonly WorkContext[]) {
    contexts.forEach((context) => this.setContext(context));
  }

  setContext(context: WorkContext) {
    this.contexts.set(context.issueKey, clone(context));
  }

  fail(tool: ReadToolName, message = `${tool} failed`) {
    this.failures.set(tool, message);
  }

  recover(tool: ReadToolName) {
    this.failures.delete(tool);
  }

  private before(tool: ReadToolName) {
    this.calls[tool] += 1;
    const failure = this.failures.get(tool);
    if (failure) throw new Error(failure);
  }

  private context(issueKey: string): WorkContext {
    const context = this.contexts.get(issueKey);
    if (!context) throw new Error(`Issue ${issueKey} was not found.`);
    return context;
  }

  async getIssue({ issueKey }: IssueKeyInput): Promise<unknown> {
    this.before("get_issue");
    return snapshot(this.context(issueKey));
  }

  async getIssueComments({ issueKey }: IssueKeyInput): Promise<unknown> {
    this.before("get_issue_comments");
    return clone(this.context(issueKey).comments);
  }

  async getRelatedIssues({ issueKey }: IssueKeyInput): Promise<unknown> {
    this.before("get_related_issues");
    return clone(this.context(issueKey).relatedIssues);
  }

  async getProjectIssues({ projectKey }: ProjectKeyInput): Promise<unknown> {
    this.before("get_project_issues");
    return [...this.contexts.values()]
      .filter((context) => context.issueKey.startsWith(`${projectKey}-`))
      .map(snapshot);
  }

  async getSubtasks({ issueKey }: IssueKeyInput): Promise<unknown> {
    this.before("get_subtasks");
    return clone(this.context(issueKey).existingSubtasks);
  }
}
