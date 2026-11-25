"use strict";

const { BaseDefensiveAgent } = require("./agent-registry");
const { CodeDefenseAnalyzer } = require("./code-defense-analyzer");

class CodeDefenseAgent extends BaseDefensiveAgent {
  constructor(options = {}) {
    super({
      id: options.id || "code-defense-agent",
      name: options.name || "Code Defense Auditor Agent",
      version: options.version || "1.0.0",
      domain: options.domain || "APPSEC",
      capabilities: options.capabilities || [
        "code-audit",
        "code-defense",
        "static-analysis",
        "audit"
      ],
      supportedTaskTypes: options.supportedTaskTypes || [
        "code-audit",
        "code-defense",
        "static-analysis",
        "audit"
      ],
      defaultTaskType: options.defaultTaskType || "code-audit",
      requiresApproval: false,
      status: options.status || "healthy"
    });

    this.analyzer =
      options.analyzer ||
      new CodeDefenseAnalyzer({
        aiCore: options.aiCore || null,
        memoryFabric: options.memoryFabric || null,
        model: options.model || undefined,
        timeoutMs: options.timeoutMs || undefined
      });
  }

  async health() {
    const base = await super.health();
    return {
      ...base,
      analyzerReady: Boolean(this.analyzer && typeof this.analyzer.analyzeCode === "function"),
      defaultModel: this.analyzer ? this.analyzer.defaultModel : null
    };
  }

  async _executeDefensive(task = {}, context = {}) {
    const payload = task && typeof task.payload === "object" && task.payload !== null
      ? task.payload
      : {};

    const code = typeof payload.code === "string" && payload.code.trim()
      ? payload.code
      : typeof task.code === "string" && task.code.trim()
        ? task.code
        : `// Defensive audit probe for task: ${task.title || task.id || "snippet"}\nconst safeConfig = { strictMode: true };\n`;

    const language = payload.language || task.language || "";
    const fileName = payload.fileName || task.fileName || "";

    const analysis = await this.analyzer.analyzeCode({
      code,
      language,
      fileName,
      model: payload.model || null,
      timeoutMs: payload.timeoutMs || null
    });

    const findings = analysis.staticFindings.map((item) => ({
      ruleId: item.ruleId,
      severity: item.severity,
      line: item.line,
      note: item.note
    }));

    const recommendations = findings.length > 0
      ? findings.map((item) => `[${item.ruleId} L${item.line}] ${item.note}`)
      : [
          `Review ${analysis.languageLabel} input boundaries, secret storage, and least-privilege defaults.`,
          "Keep humanApproved=false until security review and tests confirm changes."
        ];

    return {
      success: true,
      summary: `${analysis.languageLabel} audit (${analysis.modelTelemetry.executionMode}): ${analysis.staticFindingsCount} static finding(s). ${analysis.analysisSummary}`.slice(0, 500),
      findings,
      recommendations,
      metadata: {
        language: analysis.language,
        languageLabel: analysis.languageLabel,
        fileName: analysis.fileName,
        staticFindingsCount: analysis.staticFindingsCount,
        modelTelemetry: analysis.modelTelemetry,
        contextAttached: Boolean(context && context.mission)
      }
    };
  }
}

module.exports = { CodeDefenseAgent };
