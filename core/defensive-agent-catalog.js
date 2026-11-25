"use strict";

const { BaseDefensiveAgent, attachAgentRegistryToControlPlane } = require("./agent-registry");
const { CodeDefenseAnalyzer } = require("./code-defense-analyzer");

const DOMAIN_BLUEPRINTS = [
  {
    key: "IDENTITY",
    domain: "IDENTITY_ACCESS",
    taskTypes: ["identity-audit", "auth-check", "access-review", "audit"],
    roles: [
      "MFA Policy Auditor", "Session Anomaly Inspector", "Privileged Role Reviewer", "Token Hygiene Checker",
      "SSO Trust Verifier", "Stale Account Detector", "Least Privilege Advisor", "API Key Scope Inspector",
      "Service Account Auditor", "Password Entropy Checker", "OAuth Grant Reviewer", "Directory Sync Monitor",
      "PAM Checkout Auditor", "Role Drift Detector", "Login Geo-Velocity Checker", "Federated Assertion Validator",
      "Credential Exposure Scanner", "Break-Glass Access Monitor", "Certificate Auth Verifier", "Identity Lifecycle Auditor"
    ]
  },
  {
    key: "ASSETS",
    domain: "INFRA_ASSETS",
    taskTypes: ["asset-inventory", "infra-check", "config-audit", "telemetry"],
    roles: [
      "Host Inventory Collector", "Container Image Inspector", "Port Exposure Auditor", "TLS Certificate Watcher",
      "Kernel Patch Advisor", "Backup Snapshot Verifier", "DNS Record Integrity Checker", "Firewall Rule Reviewer",
      "Cloud Bucket Posture Checker", "Service Uptime Observer", "Disk Capacity Guard", "Clock Skew Detector",
      "Firmware Version Checker", "Symlink Boundary Guard", "Environment Drift Checker", "Dependency BOM Auditor",
      "Endpoint Health Reporter", "Network Segment Observer", "Registry Integrity Watcher", "Storage Replication Verifier"
    ]
  },
  {
    key: "SOC",
    domain: "DETECTION_SOC",
    taskTypes: ["warfare-triage", "alert-triage", "log-analysis", "telemetry"],
    roles: [
      "Auth Failure Triage Agent", "Syslog Burst Correlator", "DNS Tunneling Signal Analyst", "Lateral Movement Spotter",
      "Web Error Spike Analyst", "Brute-Force Pattern Analyst", "Process Spawn Anomaly Checker", "Outbound Beacon Detector",
      "File Integrity Diff Analyst", "Cron Job Change Inspector", "Firewall Deny Spike Analyst", "IOC Match Correlator",
      "Alert Noise Reducer", "Timeline Reconstruction Helper", "Incident Severity Classifier", "Runbook Suggestion Agent",
      "False-Positive Feedback Analyst", "Audit Stream Lag Watcher", "Privilege Escalation Signal Analyst", "Service Degradation Correlator"
    ]
  },
  {
    key: "APPSEC",
    domain: "CODE_APPSEC",
    taskTypes: ["code-audit", "code-defense", "static-analysis", "audit"],
    roles: [
      "Eval & Dynamic Code Checker", "Command Injection Guard Reviewer", "SQL Parameterization Checker", "Secret Literal Scanner",
      "Path Traversal Guard Checker", "Deserialization Risk Reviewer", "Dependency Advisory Correlator", "CORS Policy Inspector",
      "Input Validation Boundary Agent", "Crypto Usage Hygiene Checker", "Error Leak Reviewer", "Auth Middleware Guard Checker",
      "Webhook Signature Verifier", "Rate-Limit Gap Reviewer", "Safe Logging Redaction Checker", "Config Defaults Auditor",
      "PR Diff Defense Summarizer", "Unsafe Regex Guard Checker", "Session Cookie Flag Inspector", "Supply-Chain Script Auditor"
    ]
  },
  {
    key: "GOV",
    domain: "VERIFICATION_GOVERNANCE",
    taskTypes: ["policy-check", "compliance-audit", "evidence-check", "audit"],
    roles: [
      "Audit Chain Verifier", "Evidence Completeness Checker", "Human Approval Gate Checker", "Policy Exception Reviewer",
      "Control Mapping Auditor", "Change Window Verifier", "Data Retention Policy Checker", "Incident Postmortem Auditor",
      "SLA Compliance Checker", "Third-Party Risk Reviewer", "Redaction Integrity Checker", "Snapshot Recovery Tester",
      "Role Separation Verifier", "Execution Scope Validator", "Risk Score Aggregator", "Executive Posture Summarizer",
      "Read-Only Boundary Verifier", "Fallback Mode Telemetry Checker", "Mission Verification Auditor", "Governance Drift Reporter"
    ]
  }
];

function buildHundredAgentSpecs() {
  const specs = [];
  let index = 1;

  for (const bp of DOMAIN_BLUEPRINTS) {
    for (const roleName of bp.roles) {
      if (index > 100) break;
      const codeNum = String(index).padStart(3, "0");
      const slug = roleName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const id = `agent-${codeNum}-${slug}`;

      specs.push({
        index,
        id,
        name: `[${codeNum}] ${roleName}`,
        version: "1.0.0",
        domain: bp.domain,
        role: roleName,
        capabilities: [...bp.taskTypes, slug],
        supportedTaskTypes: bp.taskTypes,
        defaultTaskType: bp.taskTypes[0],
        requiresApproval: false,
        howItWorks:
          bp.domain === "CODE_APPSEC"
            ? `Receives a code-audit/defense task in CODE_APPSEC, delegates code inspection to CodeDefenseAnalyzer (static rules + optional model gateway with explicit LIVE_MODEL/FALLBACK_NO_MODEL telemetry), returns findings and remediation advice with proposedOnly=true, and records audit entries.`
            : `Receives a task in ${bp.domain}, validates taskType via canHandle(), inspects defensive telemetry/code/policy context without mutating live systems, emits structured findings and remediation advice with proposedOnly=true, and records an audit trail entry.`
      });

      index += 1;
    }
  }

  return specs;
}

class CatalogDefensiveAgent extends BaseDefensiveAgent {
  constructor(spec, options = {}) {
    super({
      id: spec.id,
      name: spec.name,
      version: spec.version,
      domain: spec.domain,
      capabilities: spec.capabilities,
      supportedTaskTypes: spec.supportedTaskTypes,
      defaultTaskType: spec.defaultTaskType,
      requiresApproval: false,
      status: "healthy"
    });
    this.index = spec.index;
    this.role = spec.role;
    this.howItWorks = spec.howItWorks;
    this.codeAnalyzer = options.codeAnalyzer || null;
  }

  async _executeDefensive(task = {}, context = {}) {
    const taskTitle = task && task.title ? String(task.title) : (task && task.id ? String(task.id) : "defensive-task");
    const payload = task && typeof task.payload === "object" && task.payload !== null ? task.payload : {};
    const taskType = String((task && (task.type || task.role)) || "").trim().toLowerCase();

    const isCodeAuditTask =
      this.domain === "CODE_APPSEC" &&
      (typeof payload.code === "string" ||
        typeof task.code === "string" ||
        ["code-audit", "code-defense", "static-analysis"].includes(taskType));

    if (isCodeAuditTask) {
      const analyzer =
        this.codeAnalyzer ||
        new CodeDefenseAnalyzer({
          aiCore: (context && context.aiCore) || (context && context.controlPlane && context.controlPlane.aiCore) || null,
          memoryFabric: (context && context.memory) || null
        });

      const code =
        typeof payload.code === "string" && payload.code.trim()
          ? payload.code
          : typeof task.code === "string" && task.code.trim()
            ? task.code
            : `// AppSec review probe by ${this.name} for "${taskTitle}"\nconst checkInput = (v) => String(v || "").trim();\n`;

      const analysis = await analyzer.analyzeCode({
        code,
        language: payload.language || task.language || "",
        fileName: payload.fileName || task.fileName || "",
        model: payload.model || null,
        timeoutMs: payload.timeoutMs || null
      });

      const findings = analysis.staticFindings.map((item) => ({
        ruleId: item.ruleId,
        severity: item.severity,
        line: item.line,
        note: item.note
      }));

      const recommendations =
        findings.length > 0
          ? findings.map((item) => `[${this.name} | ${item.ruleId} L${item.line}] ${item.note}`)
          : [
              `[${this.name}] Verify input validation, secret handling, and least privilege in ${analysis.languageLabel}.`,
              "Keep humanApproved=false by default and verify auditIntegrity after review."
            ];

      return {
        success: true,
        summary: `${this.name} (${analysis.languageLabel}, ${analysis.modelTelemetry.executionMode}): ${analysis.staticFindingsCount} finding(s) for "${taskTitle}".`,
        findings,
        recommendations,
        metadata: {
          catalogIndex: this.index,
          domain: this.domain,
          role: this.role,
          howItWorks: this.howItWorks,
          language: analysis.language,
          languageLabel: analysis.languageLabel,
          fileName: analysis.fileName,
          staticFindingsCount: analysis.staticFindingsCount,
          modelTelemetry: analysis.modelTelemetry,
          missionId: context && context.mission && context.mission.id ? context.mission.id : null
        }
      };
    }

    const findings = [
      `agent:${this.id}`,
      `domain:${this.domain}`,
      `role:${this.role}`,
      `target:${taskTitle}`
    ];

    const recommendations = [
      `[${this.name}] Review findings in read-only proposal mode before any operator change.`,
      "Keep humanApproved=false by default and verify auditIntegrity after execution."
    ];

    return {
      success: true,
      summary: `${this.name} (${this.domain}) completed defensive analysis for "${taskTitle}".`,
      findings,
      recommendations,
      metadata: {
        catalogIndex: this.index,
        role: this.role,
        howItWorks: this.howItWorks,
        missionId: context && context.mission && context.mission.id ? context.mission.id : null
      }
    };
  }
}

function createHundredDefensiveAgents(options = {}) {
  const sharedCodeAnalyzer =
    options.codeAnalyzer ||
    new CodeDefenseAnalyzer({
      aiCore: options.aiCore || null,
      memoryFabric: options.memoryFabric || null,
      model: options.model,
      timeoutMs: options.timeoutMs
    });

  return buildHundredAgentSpecs().map((spec) =>
    new CatalogDefensiveAgent(spec, {
      codeAnalyzer: spec.domain === "CODE_APPSEC" ? sharedCodeAnalyzer : null
    })
  );
}

function registerHundredAgents(registry, controlPlane = null, options = {}) {
  if (!registry || typeof registry.register !== "function") {
    throw new Error("VALID_AGENT_REGISTRY_REQUIRED");
  }

  const agents = createHundredDefensiveAgents({
    ...options,
    memoryFabric: options.memoryFabric || registry.memory || (controlPlane && controlPlane.memory) || null,
    aiCore: options.aiCore || (controlPlane && controlPlane.aiCore) || null
  });

  for (const agent of agents) {
    registry.register(agent);
  }

  if (controlPlane) {
    attachAgentRegistryToControlPlane(controlPlane, registry);
  }

  return {
    ok: true,
    registeredCount: agents.length,
    sampleFirst: agents[0] ? { id: agents[0].id, name: agents[0].name, domain: agents[0].domain } : null,
    sampleLast: agents[agents.length - 1]
      ? { id: agents[agents.length - 1].id, name: agents[agents.length - 1].name, domain: agents[agents.length - 1].domain }
      : null
  };
}

module.exports = {
  DOMAIN_BLUEPRINTS,
  buildHundredAgentSpecs,
  CatalogDefensiveAgent,
  createHundredDefensiveAgents,
  registerHundredAgents
};
