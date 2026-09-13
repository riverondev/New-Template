import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveModel } from "./model";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

function withEnv(config: NodeJS.ProcessEnv, callback: () => void) {
  for (const key of [
    "MODEL_PROVIDER",
    "MODEL",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "OLLAMA_BASE_URL",
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, config);
  callback();
}

function resolvedChatModel() {
  const model = resolveModel();
  if (typeof model === "string") {
    return model;
  }
  return { modelId: model.modelId, provider: model.provider };
}

test("Ollama preserves local tags and needs no cloud API key", () => {
  withEnv({ MODEL_PROVIDER: "ollama", MODEL: "workpilot-qwen3:4b" }, () => {
    assert.deepEqual(resolvedChatModel(), { modelId: "workpilot-qwen3:4b", provider: "openai.chat" });
  });
});

test("Ollama rejects remote endpoints and cloud model aliases", () => {
  for (const base of ["https://api.openai.com/v1", "http://remote.example/v1", "http://user:password@localhost:11434/v1", "http://localhost:11434/api"]) {
    withEnv({ MODEL_PROVIDER: "ollama", OLLAMA_BASE_URL: base }, () => assert.throws(resolveModel, /local HTTP/));
  }
  withEnv({ MODEL_PROVIDER: "ollama", MODEL: "qwen:cloud" }, () => assert.throws(resolveModel, /local Ollama/));
});

test("Ollama sends tool calls to loopback without forwarding OpenAI credentials", async () => {
  process.env.MODEL_PROVIDER = "ollama";
  process.env.MODEL = "qwen3:4b";
  process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
  process.env.OPENAI_API_KEY = "private-cloud-key";
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer ollama");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.reasoning_effort, "none");
    assert.equal(body.tools[0].function.name, "read_ticket");
    return Response.json({ id: "local-test", created: 1, model: "qwen3:4b", choices: [{ index: 0,
      message: { role: "assistant", content: null, tool_calls: [{ id: "call1", type: "function",
        function: { name: "read_ticket", arguments: '{"issueKey":"WH-1"}' } }] }, finish_reason: "tool_calls" }] });
  };
  try {
    const model = resolveModel();
    assert.notEqual(typeof model, "string");
    if (typeof model === "string") throw new Error("Expected local model");
    const result = await model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "Read WH-1" }] }],
      tools: [{ type: "function", name: "read_ticket", inputSchema: { type: "object", properties: { issueKey: { type: "string" } }, required: ["issueKey"] } }] });
    assert.ok(result.content.some(c => c.type === "tool-call" && c.toolName === "read_ticket"));
  } finally { globalThis.fetch = original; }
});

test("explicit OpenAI wins over a configured OpenRouter key", () => {
  withEnv({
    MODEL_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    OPENROUTER_API_KEY: "sk-or-test",
    MODEL: "gpt-test",
  }, () => {
    assert.equal(resolvedChatModel(), "openai:gpt-test");
  });
});

for (const [input, expected] of [
  ["openai:gpt-test", "openai/gpt-test"],
  ["openai/gpt-test", "openai/gpt-test"],
  ["meta-llama/llama-test:free", "meta-llama/llama-test:free"],
  ["gpt-test:free", "openai/gpt-test:free"],
  ["gpt-test:nitro", "openai/gpt-test:nitro"],
  ["openai:gpt-test:free", "openai/gpt-test:free"],
  ["OpenAI:gpt-test:free", "openai/gpt-test:free"],
  ["OpenAI/gpt-test:free", "openai/gpt-test:free"],
  ["Google:gemini-test:free", "google/gemini-test:free"],
  ["Gemini:gemini-test:free", "google/gemini-test:free"],
  ["Google-Gemini:gemini-test:free", "google/gemini-test:free"],
  ["gpt-test", "openai/gpt-test"],
] as const) {
  test(`OpenRouter uses chat completions and preserves slug: ${input}`, () => {
    for (const provider of [undefined, "openrouter", " OpenRouter "] as const) {
      withEnv({
        OPENROUTER_API_KEY: "sk-or-test",
        MODEL: input,
        ...(provider ? { MODEL_PROVIDER: provider } : {}),
      }, () => {
        assert.deepEqual(resolvedChatModel(), { modelId: expected, provider: "openai.chat" });
      });
    }
  });
}

for (const [config, error] of [
  [{ MODEL_PROVIDER: "openrouter", OPENAI_API_KEY: "sk-test" }, /OPENROUTER_API_KEY/],
  [{ MODEL_PROVIDER: "invalid" }, /Unsupported/],
  [{ MODEL_PROVIDER: "openai", MODEL: "anthropic/claude-test", OPENAI_API_KEY: "sk-test" }, /does not match/],
] as const) {
  test(`model resolver rejects invalid config: ${JSON.stringify(config)}`, () => {
    withEnv(config, () => {
      assert.throws(() => resolveModel(), error);
    });
  });
}

for (const provider of ["google", "gemini", "google-gemini"] as const) {
  for (const prefix of ["google", "gemini", "google-gemini"] as const) {
    test(`Google aliases agree: ${provider} / ${prefix}`, () => {
      withEnv({ MODEL_PROVIDER: provider, MODEL: `${prefix}:gemini-test`, GOOGLE_API_KEY: "test" }, () => {
        assert.equal(resolvedChatModel(), "google:gemini-test");
      });
    });
  }
}

for (const config of [
  { MODEL: "OpenAI:gpt-test", OPENAI_API_KEY: "test" },
  { MODEL: " openai/gpt-test ", OPENAI_API_KEY: "test" },
  { MODEL: " openai/gpt-test ", MODEL_PROVIDER: "openai", OPENAI_API_KEY: "test" },
  { MODEL: "OpenAI/gpt-test", MODEL_PROVIDER: " OpenAI ", OPENAI_API_KEY: "test" },
] as const) {
  test(`normalizes OpenAI configuration: ${JSON.stringify(config)}`, () => {
    withEnv(config, () => {
      assert.equal(resolvedChatModel(), "openai:gpt-test");
    });
  });
}

for (const provider of ["openai", "openrouter"] as const) {
  for (const model of ["   ", "openai:", "openai/", "openai:   "] as const) {
    test(`rejects empty model ID: ${provider} ${JSON.stringify(model)}`, () => {
      withEnv({ MODEL_PROVIDER: provider, MODEL: model, OPENAI_API_KEY: "test", OPENROUTER_API_KEY: "test" }, () => {
        assert.throws(() => resolveModel(), /MODEL must include a non-empty model identifier/);
      });
    });
  }
}
