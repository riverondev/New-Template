import { spawn } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
// This process explicitly overrides any real credential configuration.
const next = resolve(root, "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", "--turbopack", "-p", "3100", "-H", "127.0.0.1"], {
  cwd: resolve(root, "apps/web"), stdio: "inherit",
  env: { ...process.env, WORKPILOT_DEMO: "true", JIRA_WRITES_ENABLED: "false" },
});
child.on("exit", code => { process.exitCode = code ?? 1; });
