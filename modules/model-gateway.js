"use strict";

const DEFAULT_OLLAMA_URL = process.env.MARAUDER_OLLAMA_URL || "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = process.env.MARAUDER_OLLAMA_MODEL || "llama3.2";
const DEFAULT_HTTP_URL = process.env.MARAUDER_MODEL_HTTP_URL || "";
const DEFAULT_HTTP_MODEL = process.env.MARAUDER_MODEL_HTTP_MODEL || "default";
const DEFAULT_HTTP_API_KEY = process.env.MARAUDER_MODEL_API_KEY || "";
const DEFAULT_TIMEOUT_MS = Number(process.env.MARAUDER_MODEL_TIMEOUT_MS || 15000);

function getFetchFn() {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  return null;
}

class MarauderModelGateway {
  constructor(options = {}) {
    this.ollamaUrl = String(options.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
    this.ollamaModel = String(options.ollamaModel || DEFAULT_OLLAMA_MODEL);
    this.httpUrl = String(options.httpUrl || DEFAULT_HTTP_URL).trim();
    this.httpModel = String(options.httpModel || DEFAULT_HTTP_MODEL);
    this.httpApiKey = String(options.httpApiKey || DEFAULT_HTTP_API_KEY).trim();
    this.timeoutMs = Math.max(500, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));
    this.fetchFn = typeof options.fetchFn === "function" ? options.fetchFn : getFetchFn();
  }

  async _fetchWithTimeout(url, init = {}, timeoutMs = this.timeoutMs) {
    if (!this.fetchFn) {
      throw new Error("FETCH_UNAVAILABLE");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        ...init,
        signal: controller.signal
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async callOllama({ prompt, system = "", model = this.ollamaModel, temperature = 0.2, timeoutMs = this.timeoutMs }) {
    const started = Date.now();
    const messages = [];
    if (system) messages.push({ role: "system", content: String(system) });
    messages.push({ role: "user", content: String(prompt || "") });

    const res = await this._fetchWithTimeout(
      `${this.ollamaUrl}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature }
        })
      },
      timeoutMs
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OLLAMA_HTTP_${res.status}:${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text =
      (data && data.message && typeof data.message.content === "string" && data.message.content.trim()) ||
      (data && typeof data.response === "string" && data.response.trim()) ||
      "";

    if (!text) {
      throw new Error("OLLAMA_EMPTY_RESPONSE");
    }

    return {
      ok: true,
      usedModel: true,
      provider: "ollama",
      model: data.model || model,
      latencyMs: Date.now() - started,
      text
    };
  }

  async callHttpEndpoint({
    prompt,
    system = "",
    url = this.httpUrl,
    model = this.httpModel,
    apiKey = this.httpApiKey,
    temperature = 0.2,
    timeoutMs = this.timeoutMs
  }) {
    if (!url) {
      throw new Error("HTTP_ENDPOINT_NOT_CONFIGURED");
    }
    const started = Date.now();
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const messages = [];
    if (system) messages.push({ role: "system", content: String(system) });
    messages.push({ role: "user", content: String(prompt || "") });

    const res = await this._fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          prompt: String(prompt || ""),
          temperature
        })
      },
      timeoutMs
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP_ENDPOINT_${res.status}:${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const choiceContent =
      data &&
      Array.isArray(data.choices) &&
      data.choices[0] &&
      data.choices[0].message &&
      typeof data.choices[0].message.content === "string"
        ? data.choices[0].message.content.trim()
        : "";

    const text =
      choiceContent ||
      (data && typeof data.text === "string" && data.text.trim()) ||
      (data && typeof data.response === "string" && data.response.trim()) ||
      "";

    if (!text) {
      throw new Error("HTTP_ENDPOINT_EMPTY_RESPONSE");
    }

    return {
      ok: true,
      usedModel: true,
      provider: "http",
      model: (data && data.model) || model,
      latencyMs: Date.now() - started,
      text
    };
  }

  buildFallback({ prompt, task = "general", reason = "MODEL_UNAVAILABLE" }) {
    const cleanPrompt = String(prompt || "").trim();
    const summary = cleanPrompt.length > 240 ? `${cleanPrompt.slice(0, 240)}...` : cleanPrompt;
    return {
      ok: true,
      usedModel: false,
      provider: "fallback",
      model: "deterministic-fallback-v1",
      latencyMs: 0,
      fallbackReason: reason,
      task,
      text: `[FALLBACK / NO LIVE MODEL | reason=${reason}] Task=${task}. Input digest: "${summary}". No live LLM inference was executed.`
    };
  }

  
  resolveModelForTask(task = "general", requestedModel = "") {
    if (requestedModel && String(requestedModel).trim()) {
      return String(requestedModel).trim();
    }
    const t = String(task || "general").toLowerCase();
    if (t.includes("code") || t.includes("audit") || t.includes("debug") || t.includes("plan")) {
      return process.env.MARAUDER_CODE_MODEL || "marauder-coder:latest";
    }
    if (t.includes("warfare") || t.includes("triage") || t.includes("security") || t.includes("analysis") || t.includes("reason")) {
      return process.env.MARAUDER_ANALYSIS_MODEL || "dark-mega:latest";
    }
    if (t.includes("fast") || t.includes("classify") || t.includes("tag") || t.includes("ping")) {
      return process.env.MARAUDER_FAST_MODEL || "phi3:mini";
    }
    return this.ollamaModel || process.env.MARAUDER_OLLAMA_MODEL || "llama3.2:latest";
  }

  async generate(request = {}) {
    const prompt = String(request.prompt || "");
    const system = String(request.system || "");
    const task = String(request.task || "general");
    const temperature = typeof request.temperature === "number" ? request.temperature : 0.2;
    const timeoutMs = Math.max(500, Number(request.timeoutMs || this.timeoutMs));
    const preferredProvider = request.provider || "auto";
    const errors = [];

    const tryOllama = preferredProvider === "auto" || preferredProvider === "ollama";
    const tryHttp = (preferredProvider === "auto" || preferredProvider === "http") && Boolean(this.httpUrl);

    if (tryOllama) {
      try {
        return await this.callOllama({
          prompt,
          system,
          model: this.resolveModelForTask(task, request.model),
          temperature,
          timeoutMs
        });
      } catch (err) {
        errors.push(err && err.message ? err.message : String(err));
      }
    }

    if (tryHttp) {
      try {
        return await this.callHttpEndpoint({
          prompt,
          system,
          url: request.url || this.httpUrl,
          model: request.model || this.httpModel,
          apiKey: request.apiKey || this.httpApiKey,
          temperature,
          timeoutMs
        });
      } catch (err) {
        errors.push(err && err.message ? err.message : String(err));
      }
    }

    const reason = errors.length ? errors.join(" | ") : "NO_LIVE_PROVIDER_REACHABLE";
    return this.buildFallback({ prompt, task, reason });
  }
}

module.exports = { MarauderModelGateway };
