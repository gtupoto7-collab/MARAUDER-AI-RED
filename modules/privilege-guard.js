function validatePermissionGrant({ grantorAgent, targetAgent, requestedScope = "read-only", humanDirectorApproved = false }) {
  const scopeNorm = String(requestedScope || "").toLowerCase();
  const isUnlimited =
    scopeNorm.includes("unlimited") ||
    scopeNorm.includes("unrestricted") ||
    scopeNorm.includes("full-root") ||
    scopeNorm === "root";

  if (isUnlimited) {
    return {
      granted: false,
      reason: `ОТКАЗАНО: Агент '${grantorAgent || "unknown"}' не може да даде неограничени права на '${targetAgent || "unknown"}'.`
    };
  }

  if (scopeNorm !== "read-only" && !humanDirectorApproved) {
    return {
      granted: false,
      reason: `ИЗИСКВА ОДОБРЕНИЕ: Повишаването на права ('${requestedScope}') за '${targetAgent}' изисква изрично одобрение от ръководството.`
    };
  }

  return {
    granted: true,
    scope: requestedScope,
    reason: `Разрешен обхват '${requestedScope}' за '${targetAgent}' с активен одит.`
  };
}

module.exports = { validatePermissionGrant };
