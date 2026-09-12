export type ContractIssueCode =
  | "invalid_type"
  | "invalid_value"
  | "missing_value"
  | "duplicate_value"
  | "unknown_reference"
  | "policy_violation";

export interface ContractIssue {
  code: ContractIssueCode;
  path: string;
  message: string;
}

export type ContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ContractIssue[] };

export class ContractValidationError extends Error {
  readonly issues: ContractIssue[];

  constructor(contractName: string, issues: ContractIssue[]) {
    super(
      `${contractName} is invalid: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function nonEmptyString(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): string | undefined {
  if (typeof value !== "string") {
    issues.push({
      code: value === undefined ? "missing_value" : "invalid_type",
      path,
      message: "expected a string",
    });
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    issues.push({ code: "invalid_value", path, message: "must not be empty" });
    return undefined;
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): string | undefined {
  return value === undefined ? undefined : nonEmptyString(value, path, issues);
}

export function optionalHttpUrl(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): string | undefined {
  const parsed = optionalString(value, path, issues);
  if (!parsed) {
    return undefined;
  }
  let canonicalUrl: string;
  try {
    if (/[\u0000-\u0020\u007f]/.test(parsed)) {
      throw new Error("URL contains whitespace or control characters");
    }
    const url = new URL(parsed);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error("unsafe URL");
    }
    canonicalUrl = url.href;
  } catch {
    issues.push({
      code: "invalid_value",
      path,
      message: "expected an absolute HTTP(S) URL without credentials",
    });
    return undefined;
  }
  return canonicalUrl;
}

export function integer(
  value: unknown,
  path: string,
  issues: ContractIssue[],
  minimum = Number.MIN_SAFE_INTEGER,
): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    issues.push({
      code: "invalid_value",
      path,
      message: `expected a safe integer greater than or equal to ${minimum}`,
    });
    return undefined;
  }
  return value as number;
}

export function isoTimestamp(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): string | undefined {
  const timestamp = nonEmptyString(value, path, issues);
  if (!timestamp) {
    return undefined;
  }
  const match = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/,
  );
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const hour = Number(match?.[4]);
  const minute = Number(match?.[5]);
  const second = Number(match?.[6]);
  const offsetHour = match?.[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match?.[8] === undefined ? 0 : Number(match[8]);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (
    !match ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    Number.isNaN(Date.parse(timestamp))
  ) {
    issues.push({
      code: "invalid_value",
      path,
      message: "expected an ISO-8601 timestamp",
    });
    return undefined;
  }
  return timestamp;
}

export function issueKey(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): string | undefined {
  const key = nonEmptyString(value, path, issues)?.toUpperCase();
  if (!key) {
    return undefined;
  }
  if (!/^[A-Z][A-Z0-9_]*-[1-9]\d*$/.test(key)) {
    issues.push({
      code: "invalid_value",
      path,
      message: "expected a Jira issue key such as WP-42",
    });
    return undefined;
  }
  return key;
}

export function uniqueStrings(
  value: unknown,
  path: string,
  issues: ContractIssue[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({
      code: value === undefined ? "missing_value" : "invalid_type",
      path,
      message: "expected an array",
    });
    return undefined;
  }

  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const parsed = nonEmptyString(item, `${path}[${index}]`, issues);
    if (!parsed) {
      return;
    }
    if (seen.has(parsed)) {
      issues.push({
        code: "duplicate_value",
        path: `${path}[${index}]`,
        message: `duplicate value ${parsed}`,
      });
      return;
    }
    seen.add(parsed);
    result.push(parsed);
  });
  return result;
}
