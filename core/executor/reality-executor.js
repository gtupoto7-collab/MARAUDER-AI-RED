const { execFile } = require("child_process");
const EvidenceStore = require("../evidence-engine/evidence-store");

const ALLOWED_CAPABILITIES = new Set([
  "filesystem.read",
  "process.inspect",
  "network.observe",
  "logs.read",
  "security.scan",
  "sandbox.execute"
]);

class RealityExecutor {
  constructor() {
    this.evidence = new EvidenceStore();
  }

  runSafeCheck({ agent = "RealityExecutor", capability, target = "local", bin, args = [], timeoutMs = 8000 }) {
    return new Promise((resolve) => {
      if (!ALLOWED_CAPABILITIES.has(capability)) {
        const denied = this.evidence.recordExecution({
          command: `${bin} ${(args || []).join(" ")}`.trim(),
          target,
          agent,
          permission: capability || "NONE",
          realOutput: "",
          evidence: "Capability not in allowlist",
          result: "DENIED"
        });
        return resolve(denied);
      }

      const started = Date.now();
      execFile(bin, args, { timeout: timeoutMs, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
        const durationMs = Date.now() - started;
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        const verified = !err && combined.length > 0;
        const record = this.evidence.recordExecution({
          command: `${bin} ${args.join(" ")}`.trim(),
          target,
          agent,
          permission: capability,
          durationMs,
          exitCode: err ? err.code ?? 1 : 0,
          realOutput: combined.slice(0, 4000),
          evidence: `exitCode=${err ? err.code ?? 1 : 0}; bytes=${combined.length}; elapsed=${durationMs}ms`,
          result: verified ? "VERIFIED" : "FAILED_OR_EMPTY"
        });
        resolve(record);
      });
    });
  }
}

module.exports = RealityExecutor;
