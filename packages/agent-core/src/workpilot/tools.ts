import {
  type IssueSnapshot,
  type RelatedIssue,
  type SelectedTicket,
  type WorkComment,
  type WorkContext,
  type WorkSubtask,
  parseSelectedTicket,
  projectKeyFromIssueKey,
  safeParseComments,
  safeParseIssueSnapshot,
  safeParseRelatedIssues,
  safeParseSubtasks,
} from "./context";
import {
  ContractValidationError,
  type ContractIssue,
  isRecord,
  nonEmptyString,
} from "./validation";

export const REQUIRED_READ_TOOL_NAMES = [
  "get_issue",
  "get_issue_comments",
  "get_related_issues",
  "get_project_issues",
] as const;

export const OPTIONAL_READ_TOOL_NAMES = ["get_subtasks"] as const;

export type RequiredReadToolName = (typeof REQUIRED_READ_TOOL_NAMES)[number];
export type OptionalReadToolName = (typeof OPTIONAL_READ_TOOL_NAMES)[number];
export type ReadToolName = RequiredReadToolName | OptionalReadToolName;

export interface IssueKeyInput {
  issueKey: string;
}

export interface ProjectKeyInput {
  projectKey: string;
}

export type ReadToolErrorCode =
  | "invalid_arguments"
  | "invalid_result"
  | "tool_unavailable"
  | "provider_error";

export interface ReadToolError {
  code: ReadToolErrorCode;
  tool: ReadToolName;
  message: string;
  retryable: boolean;
  issues?: ContractIssue[];
}

export type ReadToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ReadToolError };

/**
 * Provider boundary owned by the Jira adapter. It exposes reads only and
 * returns unknown values so agent-core validates every provider response.
 */
export interface WorkPilotReadPort {
  getIssue(input: IssueKeyInput): Promise<unknown>;
  getIssueComments(input: IssueKeyInput): Promise<unknown>;
  getRelatedIssues(input: IssueKeyInput): Promise<unknown>;
  getProjectIssues(input: ProjectKeyInput): Promise<unknown>;
  getSubtasks?(input: IssueKeyInput): Promise<unknown>;
}

export interface ReadToolDefinition {
  name: ReadToolName;
  description: string;
  optional: boolean;
  inputSchema: {
    type: "object";
    additionalProperties: false;
    required: readonly string[];
    properties: Record<string, { type: "string"; description: string }>;
  };
}

const issueInputSchema = {
  type: "object" as const,
  additionalProperties: false as const,
  required: ["issueKey"] as const,
  properties: {
    issueKey: {
      type: "string" as const,
      description: "Selected Jira issue key, for example WP-42.",
    },
  },
};

export const WORKPILOT_READ_TOOL_DEFINITIONS: readonly ReadToolDefinition[] = [
  {
    name: "get_issue",
    description: "Read the current issue fields and snapshot version. Never writes to Jira.",
    optional: false,
    inputSchema: issueInputSchema,
  },
  {
    name: "get_issue_comments",
    description: "Read the current comments for a Jira issue. Never writes to Jira.",
    optional: false,
    inputSchema: issueInputSchema,
  },
  {
    name: "get_related_issues",
    description: "Read linked issues and their resolution state. Never writes to Jira.",
    optional: false,
    inputSchema: issueInputSchema,
  },
  {
    name: "get_project_issues",
    description: "Read issues in a Jira project when broader context is necessary. Never writes to Jira.",
    optional: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["projectKey"],
      properties: {
        projectKey: {
          type: "string",
          description: "Jira project key, for example WP.",
        },
      },
    },
  },
  {
    name: "get_subtasks",
    description: "Refresh the current subtasks when get_issue does not provide enough detail. Never writes to Jira.",
    optional: true,
    inputSchema: issueInputSchema,
  },
];

function invalidArguments(tool: ReadToolName, issues: ContractIssue[]): ReadToolResult<never> {
  return {
    ok: false,
    error: {
      code: "invalid_arguments",
      tool,
      message: "Tool arguments do not match the WorkPilot contract.",
      retryable: false,
      issues,
    },
  };
}

function parseIssueInput(tool: ReadToolName, input: unknown): ReadToolResult<IssueKeyInput> {
  try {
    return { ok: true, data: parseSelectedTicket(input) };
  } catch (error) {
    const issues = isRecord(error) && Array.isArray(error.issues)
      ? (error.issues as ContractIssue[])
      : [{ code: "invalid_value" as const, path: "$", message: "invalid issue input" }];
    return invalidArguments(tool, issues);
  }
}

function parseProjectInput(tool: ReadToolName, input: unknown): ReadToolResult<ProjectKeyInput> {
  const issues: ContractIssue[] = [];
  if (!isRecord(input)) {
    return invalidArguments(tool, [
      { code: "invalid_type", path: "$", message: "expected an object" },
    ]);
  }
  const projectKey = nonEmptyString(input.projectKey, "$.projectKey", issues)?.toUpperCase();
  if (projectKey && !/^[A-Z][A-Z0-9_]*$/.test(projectKey)) {
    issues.push({
      code: "invalid_value",
      path: "$.projectKey",
      message: "expected a Jira project key such as WP",
    });
  }
  return projectKey && issues.length === 0
    ? { ok: true, data: { projectKey } }
    : invalidArguments(tool, issues);
}

function invalidResult<T>(
  tool: ReadToolName,
  issues: ContractIssue[],
): ReadToolResult<T> {
  return {
    ok: false,
    error: {
      code: "invalid_result",
      tool,
      message: "Jira adapter returned data outside the WorkPilot contract.",
      retryable: false,
      issues,
    },
  };
}

function parseIssueList(value: unknown):
  | { ok: true; value: IssueSnapshot[] }
  | { ok: false; issues: ContractIssue[] } {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ code: "invalid_type", path: "$", message: "expected an array" }],
    };
  }
  const values: IssueSnapshot[] = [];
  const issues: ContractIssue[] = [];
  value.forEach((item, index) => {
    const parsed = safeParseIssueSnapshot(item);
    if (parsed.ok) {
      values.push(parsed.value);
    } else {
      issues.push(
        ...parsed.issues.map((issue) => ({
          ...issue,
          path: `$[${index}]${issue.path.slice(1)}`,
        })),
      );
    }
  });
  return issues.length ? { ok: false, issues } : { ok: true, value: values };
}

async function callPort(
  port: WorkPilotReadPort,
  tool: ReadToolName,
  input: IssueKeyInput | ProjectKeyInput,
): Promise<ReadToolResult<unknown>> {
  try {
    switch (tool) {
      case "get_issue":
        return { ok: true, data: await port.getIssue(input as IssueKeyInput) };
      case "get_issue_comments":
        return { ok: true, data: await port.getIssueComments(input as IssueKeyInput) };
      case "get_related_issues":
        return { ok: true, data: await port.getRelatedIssues(input as IssueKeyInput) };
      case "get_project_issues":
        return { ok: true, data: await port.getProjectIssues(input as ProjectKeyInput) };
      case "get_subtasks":
        if (!port.getSubtasks) {
          return {
            ok: false,
            error: {
              code: "tool_unavailable",
              tool,
              message: "The optional get_subtasks tool is not available.",
              retryable: false,
            },
          };
        }
        return { ok: true, data: await port.getSubtasks(input as IssueKeyInput) };
    }
  } catch {
    return {
      ok: false,
      error: {
        code: "provider_error",
        tool,
        message: "Jira read failed. Inspect server logs for provider details.",
        retryable: true,
      },
    };
  }
}

export interface ReadToolOutputMap {
  get_issue: IssueSnapshot;
  get_issue_comments: WorkComment[];
  get_related_issues: RelatedIssue[];
  get_project_issues: IssueSnapshot[];
  get_subtasks: WorkSubtask[];
}

export async function invokeReadTool<T extends ReadToolName>(
  port: WorkPilotReadPort,
  tool: T,
  rawInput: unknown,
): Promise<ReadToolResult<ReadToolOutputMap[T]>> {
  const input = tool === "get_project_issues"
    ? parseProjectInput(tool, rawInput)
    : parseIssueInput(tool, rawInput);
  if (!input.ok) {
    return input;
  }
  const result = await callPort(port, tool, input.data);
  if (!result.ok) {
    return result;
  }

  const parsed = (() => {
    switch (tool) {
      case "get_issue":
        return safeParseIssueSnapshot(result.data);
      case "get_issue_comments":
        return safeParseComments(result.data);
      case "get_related_issues":
        return safeParseRelatedIssues(result.data);
      case "get_project_issues":
        return parseIssueList(result.data);
      case "get_subtasks":
        return safeParseSubtasks(result.data);
    }
  })();
  if (parsed.ok && tool === "get_issue") {
    const requestedKey = (input.data as IssueKeyInput).issueKey;
    const returnedIssue = parsed.value as IssueSnapshot;
    if (returnedIssue.issueKey !== requestedKey) {
      return invalidResult(tool, [
        {
          code: "policy_violation",
          path: "$.issueKey",
          message: `expected ${requestedKey}, received ${returnedIssue.issueKey}`,
        },
      ]);
    }
  }
  if (parsed.ok && tool === "get_project_issues") {
    const requestedProject = (input.data as ProjectKeyInput).projectKey;
    const wrongProject = (parsed.value as IssueSnapshot[]).find(
      (item) => projectKeyFromIssueKey(item.issueKey) !== requestedProject,
    );
    if (wrongProject) {
      return invalidResult(tool, [
        {
          code: "policy_violation",
          path: "$.issueKey",
          message: `issue ${wrongProject.issueKey} is outside project ${requestedProject}`,
        },
      ]);
    }
  }
  return parsed.ok
    ? { ok: true, data: parsed.value as ReadToolOutputMap[T] }
    : invalidResult(tool, parsed.issues);
}

export interface ContextReadGap extends ReadToolError {
  source: "issue" | "comments" | "relatedIssues";
}

export type WorkContextReadResult =
  | { ok: true; context: WorkContext; gaps: ContextReadGap[] }
  | { ok: false; issueKey: string; gaps: ContextReadGap[] };

/** Reads fresh Jira state on every call; no chat-memory or plan cache is used. */
export async function readWorkContext(
  selectedTicket: SelectedTicket | string,
  port: WorkPilotReadPort,
  now: () => Date = () => new Date(),
): Promise<WorkContextReadResult> {
  const { issueKey } = parseSelectedTicket(selectedTicket);
  const input = { issueKey };
  const [issue, comments, relatedIssues] = await Promise.all([
    invokeReadTool(port, "get_issue", input),
    invokeReadTool(port, "get_issue_comments", input),
    invokeReadTool(port, "get_related_issues", input),
  ]);

  const gaps: ContextReadGap[] = [];
  const addGap = (
    source: ContextReadGap["source"],
    result: ReadToolResult<unknown>,
  ) => {
    if (!result.ok) gaps.push({ ...result.error, source });
  };
  addGap("issue", issue);
  addGap("comments", comments);
  addGap("relatedIssues", relatedIssues);
  if (!issue.ok) {
    return { ok: false, issueKey, gaps };
  }

  let fetchedAt: string;
  try {
    const currentTime = now();
    if (!(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) {
      throw new Error("invalid date");
    }
    fetchedAt = currentTime.toISOString();
  } catch {
    throw new ContractValidationError("ReadWorkContextOptions", [
      { code: "invalid_value", path: "$.now", message: "clock returned an invalid date" },
    ]);
  }

  return {
    ok: true,
    context: {
      ...issue.data,
      comments: comments.ok ? comments.data : [],
      relatedIssues: relatedIssues.ok ? relatedIssues.data : [],
      fetchedAt,
      coverage: {
        issue: "complete",
        comments: comments.ok ? "complete" : "unavailable",
        relatedIssues: relatedIssues.ok ? "complete" : "unavailable",
        subtasks: "complete",
      },
    },
    gaps,
  };
}
