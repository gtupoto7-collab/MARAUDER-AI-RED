const fs = require("fs");
const path = require("path");

const soc1To50 = [
  "SOC Commander", "Alert Triage Agent", "Incident Investigator", "Incident Coordinator", "Case Manager",
  "Evidence Collector", "Timeline Builder", "Event Correlator", "Log Analyst", "SIEM Analyst",
  "XDR Analyst", "EDR Analyst", "Network Detection Agent", "Endpoint Detection Agent", "Identity Detection Agent",
  "Insider-Risk Analyst", "Threat Scoring Agent", "Alert Deduplication Agent", "False-Positive Analyst", "Incident Summarizer",
  "IOC Enrichment Agent", "Evidence Validator", "Incident Reporter", "Escalation Agent", "Containment Planner",
  "Recovery Planner", "Crisis Coordinator", "Root-Cause Analyst", "Persistence Investigator", "Lateral-Movement Analyst",
  "Authentication Analyst", "Privilege Analyst", "Session Analyst", "Host Investigator", "Network Investigator",
  "Cloud Incident Analyst", "Email Incident Analyst", "Web Incident Analyst", "Mobile Incident Analyst", "Database Incident Analyst",
  "SaaS Incident Analyst", "Container Incident Analyst", "Kubernetes Incident Analyst", "API Incident Analyst", "Identity Incident Analyst",
  "Insider Threat Analyst", "Threat Severity Judge", "Incident QA Agent", "IR Documentation Agent", "SOC Supervisor"
];

const cti51To100 = [
  "CTI Director", "IOC Researcher", "Threat Actor Profiler", "Campaign Correlator", "TTP Mapper",
  "ATT&CK Mapper", "Threat Report Analyst", "Intelligence Validator", "Source Reputation Agent", "Dark-Web Monitor",
  "Credential-Leak Monitor", "Domain Intelligence Agent", "DNS Intelligence Agent", "IP Reputation Agent", "Hash Intelligence Agent",
  "Malware Intelligence Agent", "Phishing Intelligence Agent", "Vulnerability Intelligence Agent", "Exploit-Campaign Monitor", "APT Research Agent",
  "Ransomware Intelligence Agent", "Botnet Intelligence Agent", "Mobile Threat Intelligence Agent", "Cloud Threat Intelligence Agent", "Supply-Chain Intelligence Agent",
  "Threat Forecast Agent", "Intelligence Fusion Agent", "Geopolitical Risk Agent", "Brand Abuse Monitor", "Typosquat Monitor",
  "Certificate Intelligence Agent", "Infrastructure Mapper", "Threat Infrastructure Analyst", "Campaign Timeline Agent", "Actor Attribution Assistant",
  "Confidence Scoring Agent", "Intelligence Deduplicator", "Feed Normalizer", "Feed Quality Agent", "Intelligence Search Agent",
  "Threat Briefing Agent", "Executive Intel Agent", "Tactical Intel Agent", "Strategic Intel Agent", "Intel QA Agent",
  "Source Cross-Checker", "Emerging-Threat Agent", "Threat Trend Agent", "Intelligence Archivist", "CTI Commander"
];

const malware101To150 = [
  "Malware Triage Agent", "Static Analyzer", "Dynamic Analyzer", "PE Analyst", "ELF Analyst",
  "APK Analyst", "Script Malware Analyst", "Macro Analyst", "Memory Analyst", "Behavioral Analyst",
  "Sandbox Controller", "Sandbox Reviewer", "YARA Analyst", "Sigma Analyst", "IOC Extractor",
  "String Analyst", "Similarity Analyst", "Family Classifier", "Malware Clustering Agent", "Packing Detector",
  "Obfuscation Analyst", "Persistence Analyst", "Configuration Extractor", "Network Behavior Analyst", "C2 Behavior Analyst",
  "Malware Timeline Agent", "Reverse-Engineering Assistant", "Ghidra Assistant", "JADX Assistant", "capa Assistant",
  "Volatility Assistant", "Sandbox Evidence Agent", "Sample Reputation Agent", "Malware Report Writer", "Malware QA Agent",
  "Threat-Family Mapper", "Variant Detector", "Polymorphism Analyst", "Evasion Analyst", "Anti-Analysis Researcher",
  "Malware Diff Agent", "Firmware Malware Analyst", "IoT Malware Analyst", "Linux Malware Analyst", "Windows Malware Analyst",
  "Android Malware Analyst", "macOS Malware Analyst", "Document Malware Analyst", "Malware Research Director", "Malware Lab Supervisor"
];

const net151To200 = [
  "Network Security Agent", "Network Mapper", "Asset Discovery Agent", "Service Inventory Agent", "DNS Security Agent",
  "DHCP Analyst", "Firewall Analyst", "Proxy Analyst", "VPN Security Agent", "TLS Analyst",
  "Certificate Monitor", "Traffic Analyst", "Packet Analysis Agent", "Zeek Analyst", "Suricata Analyst",
  "IDS Analyst", "Network Anomaly Agent", "Lateral-Movement Detector", "Beaconing Detector", "C2 Detection Agent",
  "Network Baseline Agent", "Segmentation Analyst", "Zero-Trust Analyst", "Remote-Access Monitor", "Wireless Security Agent",
  "IoT Security Agent", "OT Security Agent", "DNS Anomaly Agent", "Traffic Classification Agent", "Protocol Analyst",
  "Network Forensics Agent", "Network Timeline Agent", "Firewall Rule Auditor", "Router Configuration Auditor", "Switch Configuration Auditor",
  "VPN Configuration Auditor", "Load-Balancer Auditor", "Proxy Configuration Auditor", "Network Exposure Agent", "Internet-Facing Asset Agent",
  "Shadow-IT Network Agent", "Network Compliance Agent", "Network Risk Agent", "Network Remediation Agent", "Network QA Agent",
  "Infrastructure Reporter", "Network Health Agent", "Network Recovery Agent", "Network Security Architect", "Network Commander"
];

const cloud201To250 = [
  "Cloud Security Director", "AWS Security Agent", "Azure Security Agent", "GCP Security Agent", "IAM Cloud Agent",
  "Cloud Asset Agent", "Cloud Configuration Agent", "Cloud Exposure Agent", "Cloud Logging Agent", "Cloud Incident Agent",
  "Kubernetes Security Agent", "Container Security Agent", "Docker Security Agent", "Image Scanner", "Registry Security Agent",
  "CI/CD Security Agent", "Git Security Agent", "Secret Scanner", "Dependency Agent", "SBOM Agent",
  "Supply-Chain Security Agent", "IaC Security Agent", "Terraform Security Agent", "Helm Security Agent", "Serverless Security Agent",
  "API Gateway Security Agent", "Cloud Network Agent", "Cloud Storage Auditor", "Database Cloud Auditor", "Cloud Identity Agent",
  "Cloud Privilege Agent", "Cloud Compliance Agent", "Cloud Cost-Anomaly Agent", "Cloud Drift Agent", "Cloud Baseline Agent",
  "Cloud Remediation Agent", "DevSecOps Reviewer", "Secure-Code Agent", "SAST Agent", "DAST Agent",
  "SCA Agent", "IaC Reviewer", "PR Security Reviewer", "Build Security Agent", "Release Security Agent",
  "Pipeline QA Agent", "Cloud Forensics Agent", "Cloud Recovery Agent", "Cloud Security Architect", "Cloud Commander"
];

const identity251To300 = [
  "Identity Security Director", "IAM Analyst", "RBAC Analyst", "ABAC Analyst", "Privilege Analyst",
  "JIT Access Agent", "Access Review Agent", "Account Risk Agent", "Credential Exposure Agent", "MFA Security Agent",
  "SSO Security Agent", "OAuth Security Agent", "Token Security Agent", "Session Security Agent", "Service Account Agent",
  "Non-Human Identity Agent", "API Identity Agent", "Agent Identity Agent", "Secrets Governance Agent", "Key Management Agent",
  "Certificate Identity Agent", "Identity Graph Agent", "Privilege Escalation Detector", "Impossible-Travel Detector", "Authentication Anomaly Agent",
  "Account-Takeover Detector", "Dormant Account Agent", "Orphan Account Agent", "Access-Creep Agent", "Privilege Review Agent",
  "Identity Threat Hunter", "Identity Incident Responder", "Identity Recovery Agent", "Identity Compliance Agent", "Directory Security Agent",
  "Entra Security Agent", "LDAP Security Agent", "Active Directory Analyst", "Kerberos Security Agent", "PAM Agent",
  "Secrets Rotation Agent", "Credential Rotation Agent", "Device Trust Agent", "Endpoint Identity Agent", "Workforce Identity Agent",
  "Customer Identity Agent", "Agent-Access Auditor", "Identity QA Agent", "Identity Architect", "Identity Commander"
];

const aiSec301To350 = [
  "AI Security Director", "Prompt-Injection Detector", "Jailbreak Detector", "Tool-Call Monitor", "MCP Security Agent",
  "Agent Discovery Agent", "Agent Inventory Agent", "Agent Permission Auditor", "Agent Behavior Monitor", "Agent Runtime Guard",
  "Agent Identity Agent", "Agent Credential Monitor", "Agent Memory Auditor", "Memory-Poisoning Detector", "Context Integrity Agent",
  "Data-Leakage Agent", "Model Security Agent", "Model-Risk Agent", "Model Evaluation Agent", "AI Red-Team Coordinator",
  "AI Blue-Team Agent", "AI Forensics Agent", "AI Incident Responder", "AI Supply-Chain Agent", "Model Provenance Agent",
  "Model Integrity Agent", "Output Validator", "Hallucination Checker", "Agent QA Agent", "Agent Sandbox Controller",
  "Tool Allowlist Agent", "Tool Risk Scorer", "Agent Policy Agent", "Agent Governance Agent", "Agent Audit Agent",
  "Agent Activity Recorder", "AI Threat Intelligence Agent", "AI Malware Research Agent", "AI Phishing Analyst", "AI Privacy Agent",
  "AI Compliance Agent", "AI Data Classification Agent", "AI DLP Agent", "AI Runtime Anomaly Agent", "AI Behavior Baseline Agent",
  "Agent Recovery Agent", "Agent Kill-Switch Controller", "AI Security Architect", "AI Safety Reviewer", "AI Commander"
];

const appSec351To400 = [
  "AppSec Director", "Web Security Analyst", "API Security Analyst", "Mobile AppSec Agent", "Code Review Agent",
  "Vulnerability Triage Agent", "CVE Correlation Agent", "CWE Classifier", "Dependency Risk Agent", "Configuration Auditor",
  "Security Headers Agent", "TLS Configuration Agent", "Authentication Tester", "Authorization Tester", "Session Security Tester",
  "Input Validation Tester", "Business Logic Reviewer", "API Schema Reviewer", "GraphQL Security Agent", "Webhook Security Agent",
  "Upload Security Agent", "Browser Security Agent", "Client-Side Security Agent", "Source-Code Security Agent", "Secrets-in-Code Agent",
  "Supply-Chain Reviewer", "Fuzzing Coordinator", "Safe Validation Agent", "Security Regression Agent", "Remediation Advisor",
  "Patch Verification Agent", "Fix Verification Agent", "Security Test Planner", "Test Scope Validator", "Authorization Guard",
  "Evidence Collector", "Pentest Report Agent", "Finding Deduplicator", "Severity Reviewer", "False-Positive Reviewer",
  "Security QA Agent", "AppSec Knowledge Agent", "Secure Architecture Agent", "Threat Modeling Agent", "Abuse-Case Agent",
  "Security Test Scheduler", "AppSec Metrics Agent", "AppSec Research Agent", "AppSec Architect", "AppSec Commander"
];

const forensics401To450 = [
  "DFIR Director", "Disk Forensics Agent", "Memory Forensics Agent", "Browser Forensics Agent", "Email Forensics Agent",
  "Cloud Forensics Agent", "Mobile Forensics Agent", "Network Forensics Agent", "Timeline Forensics Agent", "Artifact Collector",
  "Evidence Integrity Agent", "Chain-of-Custody Agent", "Deleted-File Analyst", "Registry Analyst", "Event-Log Analyst",
  "Prefetch Analyst", "Persistence Investigator", "Process Investigator", "User Activity Analyst", "File-System Analyst",
  "Credential Artifact Analyst", "Malware Evidence Agent", "Attack Timeline Agent", "Root-Cause Agent", "Recovery Planner",
  "Backup Integrity Agent", "Disaster Recovery Agent", "System Restoration Agent", "Snapshot Manager", "Evidence Deduplicator",
  "Evidence Correlator", "Forensics QA Agent", "Forensics Report Agent", "Legal-Hold Assistant", "Evidence Search Agent",
  "Incident Reconstruction Agent", "Compromise Assessment Agent", "Persistence Verification Agent", "Recovery Verification Agent", "Post-Incident Analyst",
  "Lessons-Learned Agent", "Security Postmortem Agent", "Resilience Agent", "Business Continuity Agent", "Crisis Recovery Agent",
  "Forensics Research Agent", "Forensics Architect", "DFIR QA Agent", "DFIR Supervisor", "DFIR Commander"
];

const gov451To500 = [
  "MARAUDER Director", "Mission Planner", "Agent Orchestrator", "Agent Scheduler", "Agent Registry",
  "Agent Health Monitor", "Agent Capability Resolver", "Agent Load Balancer", "Job Queue Manager", "Event-Bus Manager",
  "Policy Engine", "Risk Engine", "Approval Engine", "JIT Privilege Controller", "Scope Controller",
  "Target Registry", "Asset Registry", "Audit Controller", "Evidence Controller", "Secrets Manager",
  "Key Rotation Agent", "Backup Controller", "Disaster Recovery Controller", "Configuration Manager", "Update Manager",
  "Plugin Manager", "Integration Manager", "API Gateway Agent", "Webhook Controller", "Notification Agent",
  "Dashboard Agent", "Metrics Agent", "Cost Controller", "Resource Scheduler", "Performance Agent",
  "Reliability Agent", "Failure Recovery Agent", "Safety Policy Agent", "Emergency Stop Agent", "Change-Control Agent",
  "Compliance Agent", "Privacy Agent", "Risk Auditor", "AI Output Auditor", "Human-Approval Coordinator",
  "Executive Security Advisor", "Security Architect", "Chief Security Agent", "MARAUDER Chief-of-Staff", "MARAUDER SUPREME ORCHESTRATOR"
];

const extraArmy501To530 = [
  "Red-Team Simulation Planner", "Adversary Emulation Analyst", "Attack-Path Verifier", "Exposure Validation Agent", "Deception & Honeypot Analyst",
  "Threat-Hunting Coordinator", "Hypothesis Hunt Agent", "Living-off-the-Land Detector", "Credential-Dump Hunt Agent", "Persistence Hunt Agent",
  "RF & Wireless Lab Analyst", "BLE & NFC Lab Auditor", "Firmware Extraction Analyst", "Embedded Device Auditor", "ICS / OT Protocol Analyst",
  "PLC Safety Auditor", "SCADA Telemetry Guard", "Mobile Runtime Auditor", "Android Intent & Permission Auditor", "iOS Entitlement Auditor",
  "Browser Extension Auditor", "Supply-Chain Provenance Verifier", "SBOM Diff Analyst", "Vulnerability Exploitability Analyst", "Patch Prioritization Agent",
  "Purple-Team Gap Analyst", "Detection-Coverage Verifier", "Runbook Validation Agent", "Tabletop Exercise Coordinator", "Red/Blue Commander"
];

const roles = [];
const pushBatch = (list, domain, sourceType) => {
  for (const roleName of list) {
    roles.push({
      id: `ROLE-${String(roles.length + 1).padStart(3, "0")}`,
      roleName,
      domain,
      sourceType,
      defaultPermission: "read-only",
      requiresApprovalForChange: true
    });
  }
};

pushBatch(soc1To50, "SOC / Incident Response", "user-defined");
pushBatch(cti51To100, "Threat Intelligence", "user-defined");
pushBatch(malware101To150, "Malware / Research", "user-defined");
pushBatch(net151To200, "Network / Infrastructure", "user-defined");
pushBatch(cloud201To250, "Cloud / DevSecOps", "user-defined");
pushBatch(identity251To300, "Identity / Access", "user-defined");
pushBatch(aiSec301To350, "AI / Agent Security", "user-defined");
pushBatch(appSec351To400, "AppSec / Authorized Security Testing", "user-defined");
pushBatch(forensics401To450, "Forensics / Recovery", "user-defined");
pushBatch(gov451To500, "Governance / Command", "user-defined");
pushBatch(extraArmy501To530, "Red Team / Threat Hunting & Specialized Lab", "user-added-army");

const outPath = path.join(__dirname, "..", "data", "roles-500-catalog.json");
fs.writeFileSync(outPath, JSON.stringify({ totalRoles: roles.length, roles }, null, 2), "utf8");
console.log("Total roles written:", roles.length);
