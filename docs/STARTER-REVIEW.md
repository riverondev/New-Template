# Starter integration baseline

## Source

- Repository: `CopilotKit/agents-everywhere-starter-kit`
- Upstream branch: `main`
- Incorporated commit: `5c8bf4c810bcd3abadaf573f7575bb73e098b03e`
- Commit subject: `Merge pull request #29 from CopilotKit/jerel/move-install-steps-to-templates`
- Commit timestamp: `2026-09-12T09:39:05-07:00`
- Incorporated on: `2026-09-12`

The starter was copied without its `.git` directory. The pre-existing
WorkPilot plan, proposed directory structure, and placeholder modules were
preserved. The placeholder `apps/web/src/app/page.tsx` was replaced by the
runnable starter page.

## Inherited baseline

The imported baseline included:

- the npm workspace and lockfile;
- the CopilotKit web, Channel, and mobile reference applications;
- the shared `agent-core` runtime;
- starter tests, assets, and hackathon documentation.

WorkPilot-specific Jira, Slack notification, approval/execution, persistence,
and reconciliation modules are event work and are not provided by the starter.

## Approved WorkPilot scope

After reviewing the starter against the P4 feature matrix, the team selected a
Web + Agent Core runtime. The Channel and mobile applications remain part of
the recorded upstream baseline but were removed from the active workspace, as
were the mobile-only API route and Agent Core prompt export.

Slack does not use the conversational Channel runtime. WorkPilot sends a
server-side, outgoing-only notification to one configured user's private App
Home Messages conversation after Jira has been verified.

## Baseline verification

Environment used:

- Windows / PowerShell
- Node.js `v24.13.0`
- npm `11.6.2`

Results before WorkPilot integration:

- `npm ci`: passed; 1,296 packages installed from the lockfile.
- workspace typecheck: passed.
- web tests: 34 passed.
- agent-core tests: 37 passed after removing POSIX-only single quotes from the
  npm glob.
- Channel tests: 22 passed after the same Windows portability correction.
- `npm run build --workspace web`: passed.

The web build emits an inherited dynamic-dependency warning from
`@ai-sdk/google-vertex` through `@copilotkit/runtime`; it does not fail the
build. CopilotKit also reports that anonymous telemetry is enabled unless
`COPILOTKIT_TELEMETRY_DISABLED=true` is set.

## Current verification

Post-trim results on 2026-09-12:

- the root workspace and lockfile contain only `apps/web` and
  `packages/agent-core`;
- `npm ci`: passed for the reduced workspace (1,256 packages from the
  regenerated lockfile);
- `npm run verify`: passed (37 Agent Core tests + 42 Web tests = 79);
- the Web count includes 8 isolated Slack adapter/notification tests;
- `npm run build --workspace web`: passed without using the previous `.next`
  cache.

The build retains the inherited dynamic-dependency warning from
`@ai-sdk/google-vertex`. A clean-checkout verification is still required before
closing P4-01/P4-09. The local install audit reported 11 transitive dependency
vulnerabilities (8 moderate, 2 high, 1 critical); no automatic audit fix was
applied.

## Integration rule

Preserve the server approval boundary and the starter's page-context patterns.
For WorkPilot, Jira is the source of truth and Slack is an outgoing notification
only. Slack must run after a successful Jira read-back, and a Slack retry must
never repeat Jira writes.
