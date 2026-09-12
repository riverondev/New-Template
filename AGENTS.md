# Notes for coding agents

Read `hackathon-overview.md`, `hackathon-rules.md`,
`using-sponsor-tools.md`, and `apps/web/README.md` before changing the
application. WorkPilot intentionally keeps only the Web surface and the shared
Agent Core runtime from the imported starter.

## Product boundaries

- Jira is the source of truth.
- The agent may draft actions, but external writes require explicit approval.
- Jira mutations run on the server and must be verified with a read-back.
- Slack is an outgoing notification only. It runs only after Jira is verified.
- Slack targets the configured user's private App Home conversation; never let
  agent output select the recipient.
- A Slack retry must never repeat Jira writes.
- Do not add Channels, mobile, inbound Slack events, Socket Mode, or automatic
  notification retries without an approved scope change.

## Starter conventions retained

- Node.js 22 or newer is required.
- Preserve CopilotKit's React page-context patterns and the server-side approval
  boundary.
- `@ag-ui/client` must remain deduped. The root `package.json` pins it to the
  exact version required by `@copilotkit/runtime`; re-check
  `npm ls @ag-ui/client` when changing that runtime.
- Files containing JSX use `.tsx`.
- Run `npm run verify` and `npm run build --workspace web` before claiming the
  local implementation passes.

Never commit secrets. Document required variables in `.env.example` and keep
real Jira, model, and Slack credentials in local environment files only.
