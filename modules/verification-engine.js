class VerificationEngine {
  verifyFinding({ claim, evidence, blackBoxExport }) {
    if (!claim || !String(claim).trim()) {
      return { verified: false, reason: "MISSING_CLAIM" };
    }
    if (!evidence || !evidence.verified) {
      return { verified: false, reason: "FINDING_REQUIRES_VERIFIED_EVIDENCE" };
    }
    if (blackBoxExport && blackBoxExport.integrity && blackBoxExport.integrity.valid === false) {
      return { verified: false, reason: "BLACKBOX_HASH_CHAIN_BROKEN" };
    }
    return { verified: true, reason: "VERIFIED_WITH_EVIDENCE", evidenceId: evidence.id || null };
  }
}

module.exports = { VerificationEngine };
