# Using sponsor tools — selected excerpts

Nota de WorkPilot: esta es una selección del [archivo original](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/using-sponsor-tools.md), no su reproducción completa. Consulta: 2026-09-12, rama `main`, SHA no verificado. Texto reproducido bajo [MIT](LICENSE). Se omiten recetas de autenticación, llamadas de ejemplo y secciones no necesarias para planificar. Consultar el original antes de configurar servicios.

## OpenAI

`MODEL` is the kit's configured model; choose one available to your API account.

## CopilotKit

**Access and authentication.** The React web and React Native templates need only your model-provider account for CopilotKit's existing integration. To connect either app to Intelligence, use the [official onboarding prompt](https://github.com/CopilotKit/agents-everywhere-starter-kit#copilotkit-onboarding). The Slack template additionally uses [CopilotKit Intelligence](https://intelligence.copilotkit.ai/) to manage the Channel and Slack installation.

The Channel Code must match Intelligence exactly. Use a project-scoped API key from that project's API Keys page. Managed Channels require no `xapp-` token or public tunnel.

With Ambiguous configured, ask for a follow-up proposal, approve it in the page, then refresh and read back the same provider record.

Keep the tested Channels/runtime versions and the `@ag-ui/client` override. Before editing the Slack template, read the [Channels skill](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/.agents/skills/build-channels-agent/SKILL.md).

## OpenRouter

Replace `MODEL` with an available catalog slug. OpenRouter chat does not need an OpenAI key. The independent browser voice route still requires OpenAI Realtime credentials.

## Exa

**Access and authentication.** Create an [Exa API key](https://dashboard.exa.ai/api-keys). Exa supplies public web evidence; it does not read your private incident logs.

## Ambiguous AI

**Access and authentication.** Open [Ambiguous AI](https://www.ambiguous.ai/) and choose a demo workspace you control. Use that workspace's **Connect** instructions and obtain an API key with the task read/write permissions you need. The kit sends this key as a Bearer credential to `https://app.ambiguous.ai/mcp`. Its environment name is specific to this kit; the vendor CLI manages credentials separately.

The [shared MCP connection](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/packages/agent-core/src/capabilities/workplace.ts) is also available to Slack when configured. Tool schemas come from the live workspace; never invent names, arguments, or record URLs. Approval prompts and cards guide behavior but do not enforce a gate around every MCP tool. For your own app, enforce required authorization at the write boundary. A `401` needs valid credentials; a `403` needs appropriate permissions. A new workspace does not fix access to the intended one.

## Nota de WorkPilot: adaptación decidida en el PRD

Ambiguous es el proveedor persistente del ejemplo Web, no un mecanismo genérico para entender frases ambiguas. Para el MVP propuesto, Jira ocupará el lugar de fuente de trabajo. Reutilizar el patrón de aprobación requiere adaptar el servidor y los tipos, no sólo cambiar una variable. Slack saliente se implementará como una integración nueva acotada; no se atribuye esa capacidad al ejemplo Web.
