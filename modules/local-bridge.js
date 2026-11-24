const ALLOWED_ENVIRONMENTS = ["kali", "ubuntu-wsl", "windows-powershell", "termux"];

function buildBridgeTask(environment, agentSlug, commandSummary) {
  const env = String(environment || "").toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.includes(env)) {
    return { ok: false, error: `Неподдържана среда '${environment}'. Позволени: ${ALLOWED_ENVIRONMENTS.join(", ")}.` };
  }
  return {
    ok: true,
    environment: env,
    agent: agentSlug || "commander",
    mode: "read-only-queued",
    summary: commandSummary || "Проверка на налични инструменти и статус в изолирана среда."
  };
}

module.exports = { ALLOWED_ENVIRONMENTS, buildBridgeTask };
