# README original — extractos de referencia

Fuente: [README.md upstream](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/README.md). Consulta: 2026-09-12, rama `main`, sin SHA verificado. **Extractos, no copia completa.** Texto de origen en inglés bajo la [licencia MIT](LICENSE). Los encabezados de delimitación son nuestros.

## Extracto: Overview

Build for [Agents, Everywhere: Bots, Channels, & More](https://aitinkerers.org/hackathons/global/agents-everywhere), the AI Tinkerers global hackathon on September 12–13, 2026. Choose your city on the event page for its local schedule. Put an agent inside a conversation, an app, a phone, or a physical environment. Make the context of that place essential to what it can do.

This kit gives you three runnable templates, files to hand to your coding agent, and sponsor setup notes. Pick a user, a problem, and one complete interaction. You can use any stack; you do not need every sponsor or every surface.

Your project and its core functionality must be created during the event. Existing libraries, templates, and starter code are allowed; describe what you reuse and what you build. Read [the rules](hackathon-rules.md), then follow your city's participant portal for the current deadline and judging criteria.

## Extracto: Get started

Use Node.js 22+, then clone and install the kit:

```bash
git clone https://github.com/CopilotKit/agents-everywhere-starter-kit.git
cd agents-everywhere-starter-kit
npm ci
cp .env.example .env
```

Choose one template and configure only the credentials it needs. Slack and web use the root install; React Native has its own install under `apps/mobile` because Expo pins its React Native stack separately.

## Extracto: Make the demo yours

The supplied on-call and finance assistants are infrastructure examples: read ambient context, call a tool, render useful UI, and return a verifiable result. Choose a different user, problem, dataset, and interaction; the goal is your own project, not another version of the starter scenario.

Use the [demo prompts](https://github.com/CopilotKit/agents-everywhere-starter-kit/blob/main/dev-docs/demo-prompts.md) to learn how the pieces connect, then replace the sample domain. In the Slack sample incident flow, approval cards record decisions without executing production actions. In the web follow-up flow, the page approval button saves the reviewed Ambiguous task. In the mobile finance flow, approval changes local in-memory data. Enforce the same kind of write boundary around any external action you add.

Want another surface pattern? The web app also includes a voice route, and the shared agent can connect to remote MCP tools when configured. The event surfaces are inspiration, not separate tracks or a requirement to build multiple apps.

## Nota de WorkPilot

Los enlaces de dos extractos se resolvieron a sus destinos upstream para facilitar la lectura local. Los comandos son referencia documental; aún no se ejecutaron ni se incorporó el starter en este workspace. En Windows adaptar la copia de `.env.example` al shell y conservar valores existentes.
