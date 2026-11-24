const crypto = require("crypto");

class RealJobRunner {
  constructor() {
    this.jobs = new Map();
    this.auditLog = [];
  }

  audit(event, jobId, detail) {
    this.auditLog.push({
      ts: new Date().toISOString(),
      event,
      jobId,
      detail
    });
  }

  startJob({
    agentName = "Network-Audit",
    target = "YOUR-LAB",
    authorizedScope = false,
    temporaryPrivilege = false,
    ttlMinutes = 10,
    executor
  }) {
    if (!authorizedScope) {
      return {
        ok: false,
        error: "Отказано: задачата изисква изрично потвърден scope (authorizedScope=true)."
      };
    }
    if (typeof executor !== "function") {
      return {
        ok: false,
        error: "Отказано: липсва реален executor за изпълнение на задачата."
      };
    }

    const num = Math.floor(1000 + Math.random() * 9000);
    const jobId = `JOB-${num}`;
    const now = Date.now();
    const safeMin = Math.min(Math.max(Number(ttlMinutes) || 10, 1), 120);
    const expiresAt = temporaryPrivilege ? new Date(now + safeMin * 60 * 1000).toISOString() : null;
    const controller = new AbortController();

    const job = {
      jobId,
      agent: String(agentName),
      target: String(target),
      status: "RUNNING",
      privilege: temporaryPrivilege ? "TEMPORARY" : "READ-ONLY",
      expiresAt,
      startedAt: new Date(now).toISOString(),
      endedAt: null,
      outputLines: [],
      findings: [],
      privilegeRevoked: !temporaryPrivilege,
      stopReason: null,
      _controller: controller
    };

    this.jobs.set(jobId, job);
    this.audit("JOB_STARTED", jobId, `Agent=${job.agent}, Target=${job.target}, Privilege=${job.privilege}, Expires=${expiresAt || "none"}`);

    const appendOutput = (line) => {
      if (job.status !== "RUNNING") return;
      job.outputLines.push(String(line));
    };

    const addFinding = (finding) => {
      if (job.status !== "RUNNING") return;
      job.findings.push({
        recordedAt: new Date().toISOString(),
        ...finding
      });
    };

    const revokePrivilege = (reason) => {
      if (!job.privilegeRevoked) {
        job.privilegeRevoked = true;
        job.privilege = "REVOKED";
        this.audit("PRIVILEGE_REVOKED", jobId, reason);
      }
    };

    const ttlTimer = temporaryPrivilege
      ? setTimeout(() => {
          this.stopJob(jobId, "Изтекъл времеви лимит (TTL) на временните права");
        }, safeMin * 60 * 1000)
      : null;

    Promise.resolve()
      .then(() => executor({ signal: controller.signal, appendOutput, addFinding, job }))
      .then((res) => {
        if (ttlTimer) clearTimeout(ttlTimer);
        if (job.status === "RUNNING") {
          job.status = "COMPLETED";
          job.endedAt = new Date().toISOString();
          if (res && res.summary) appendOutput(res.summary);
          revokePrivilege("Задачата приключи — временните права са отнети");
          this.audit("JOB_COMPLETED", jobId, `Findings=${job.findings.length}, OutputLines=${job.outputLines.length}`);
        }
      })
      .catch((err) => {
        if (ttlTimer) clearTimeout(ttlTimer);
        if (job.status === "RUNNING") {
          job.status = controller.signal.aborted ? "STOPPED" : "FAILED";
          job.endedAt = new Date().toISOString();
          appendOutput(`ERROR: ${err && err.message ? err.message : String(err)}`);
          revokePrivilege("Задачата спря/прекъсна — временните права са отнети");
          this.audit("JOB_TERMINATED", jobId, `Status=${job.status}, Reason=${job.stopReason || err.message}`);
        }
      });

    return { ok: true, job: this.getJobView(jobId) };
  }

  stopJob(jobId, reason = "Ръчно спряно от оператора [STOP JOB]") {
    const job = this.jobs.get(String(jobId || ""));
    if (!job) {
      return { ok: false, error: `Задача '${jobId}' не е намерена.` };
    }
    job.stopReason = String(reason);
    if (job.status === "RUNNING") {
      job.status = "STOPPED";
      job.endedAt = new Date().toISOString();
      job._controller.abort(new Error(reason));
    }
    if (!job.privilegeRevoked) {
      job.privilegeRevoked = true;
      job.privilege = "REVOKED";
      this.audit("PRIVILEGE_REVOKED", job.jobId, reason);
    }
    this.audit("JOB_STOPPED", job.jobId, reason);
    return { ok: true, job: this.getJobView(job.jobId) };
  }

  getJobView(jobId) {
    const job = this.jobs.get(String(jobId || ""));
    if (!job) return null;
    const { _controller, ...safeView } = job;
    return safeView;
  }

  getAuditLog() {
    return this.auditLog.slice();
  }
}

module.exports = { RealJobRunner };
