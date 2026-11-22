"use strict";

const crypto = require("crypto");
const { scrubUntrustedPayload, buildHardPrivacySnapshot } = require("../modules/hard-privacy-mode");
const { createRateLimiter, applySecurityHeaders, validateJsonPayloadSize } = require("../modules/hardening-guard");

function createRedSecretChatRouter() {
  const rooms = new Map();
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 90 });

  function sweepExpired(now = Date.now()) {
    for (const [roomId, room] of rooms.entries()) {
      if (room.destroyed) {
        rooms.delete(roomId);
        continue;
      }
      if (room.deleteAfterMs >= 0 && now - room.createdAt >= room.deleteAfterMs) {
        rooms.delete(roomId);
        continue;
      }
      if (room.messageLifetimeMs > 0) {
        room.messages = room.messages.filter((m) => now - m.createdAt < room.messageLifetimeMs);
      }
    }
  }

  function issueInvite(room, ttlMs = 5 * 60 * 1000) {
    const codeRaw = crypto.randomBytes(4).toString("hex").toUpperCase();
    const code = `${codeRaw.slice(0, 4)}-${codeRaw.slice(4, 8)}`;
    const token = crypto.randomBytes(18).toString("base64url");
    const expiresAt = Date.now() + ttlMs;
    const invite = { code, token, expiresAt, used: false, revoked: false };
    room.invites.set(code, invite);
    return invite;
  }

  function handleRequest(req, res, pathname, bodyJson) {
    if (!pathname.startsWith("/api/secret-chat/")) return false;
    const sizeCheck = validateJsonPayloadSize(bodyJson, 64 * 1024);
    if (!sizeCheck.ok) {
      return send(413, { ok: false, error: sizeCheck.error, maxBytes: sizeCheck.maxBytes });
    }
    const rl = limiter.check("secret-chat");
    if (!rl.allowed) {
      if (typeof res.setHeader === "function") res.setHeader("Retry-After", String(rl.retryAfterSec));
      return send(429, { ok: false, error: "RATE_LIMIT_EXCEEDED", retryAfterSec: rl.retryAfterSec });
    }
    const { clean: safeBody, strippedKeys } = scrubUntrustedPayload(bodyJson || {});
    bodyJson = safeBody;
    sweepExpired();

    const send = (status, payload) => {
      applySecurityHeaders(res, { noStore: true });
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
      return true;
    };

    if (req.method === "POST" && pathname === "/api/secret-chat/create") {
      const b = bodyJson || {};
      const maxMembers = Math.min(1000, Math.max(2, Number(b.maxMembers || 10)));
      const messageLifetimeMs = Math.max(0, Number(b.messageLifetimeMs ?? 60_000));
      const deleteAfterMs = Number(b.deleteAfterMs ?? 86_400_000);
      const adminId = String(b.adminId || `admin_${crypto.randomBytes(4).toString("hex")}`);
      const adminPublicJwk = b.adminPublicJwk || null;

      const roomId = crypto.randomBytes(8).toString("hex");
      const roomSaltB64 = crypto.randomBytes(16).toString("base64");
      const now = Date.now();
      const room = {
        roomId,
        roomSaltB64,
        adminId,
        maxMembers,
        messageLifetimeMs,
        deleteAfterMs,
        createdAt: now,
        keyEpoch: 1,
        destroyed: false,
        members: new Map([[adminId, { memberId: adminId, publicJwk: adminPublicJwk }]]),
        invites: new Map(),
        messages: []
      };
      const invite = issueInvite(room, 5 * 60 * 1000);
      rooms.set(roomId, room);

      return send(201, {
        ok: true,
        roomId,
        roomSaltB64,
        adminId,
        maxMembers,
        keyEpoch: room.keyEpoch,
        invite: {
          code: invite.code,
          token: invite.token,
          expiresAt: invite.expiresAt,
          joinUrl: `/?rscRoom=${encodeURIComponent(roomId)}&rscCode=${encodeURIComponent(invite.code)}&rscToken=${encodeURIComponent(invite.token)}`,
          qrPayload: JSON.stringify({
            v: 2,
            roomId,
            roomSaltB64,
            code: invite.code,
            token: invite.token,
            exp: invite.expiresAt
          })
        },
        hardPrivacy: buildHardPrivacySnapshot({ strippedFromRequest: strippedKeys }),
        privacyNotice:
          "Client-side ECDH + AES-GCM ciphertext relay; server never receives plaintext, but network/server metadata or IP may still be visible without VPN/Tor, and screenshots cannot be blocked."
      });
    }

    if (req.method === "POST" && pathname === "/api/secret-chat/join") {
      const b = bodyJson || {};
      const code = String(b.code || "").trim().toUpperCase();
      const memberId = String(b.memberId || `user_${crypto.randomBytes(4).toString("hex")}`);
      const memberPublicJwk = b.memberPublicJwk || null;
      const now = Date.now();

      for (const room of rooms.values()) {
        const inv = room.invites.get(code);
        if (!inv) continue;
        if (b.token && String(b.token) !== inv.token) {
          return send(403, { ok: false, error: "INVITE_TOKEN_MISMATCH" });
        }
        if (inv.revoked || inv.used || now > inv.expiresAt) {
          return send(410, { ok: false, error: "INVITE_INVALID_OR_EXPIRED" });
        }
        if (room.members.size >= room.maxMembers) {
          return send(409, { ok: false, error: "ROOM_FULL" });
        }
        inv.used = true;
        room.members.set(memberId, { memberId, publicJwk: memberPublicJwk });
        const adminEntry = room.members.get(room.adminId);
        return send(200, {
          ok: true,
          roomId: room.roomId,
          roomSaltB64: room.roomSaltB64,
          adminPublicJwk: adminEntry ? adminEntry.publicJwk : null,
          memberId,
          membersCount: room.members.size,
          maxMembers: room.maxMembers,
          keyEpoch: room.keyEpoch,
          messageLifetimeMs: room.messageLifetimeMs
        });
      }
      return send(404, { ok: false, error: "INVITE_NOT_FOUND" });
    }

    if (req.method === "POST" && pathname === "/api/secret-chat/admin") {
      const b = bodyJson || {};
      const room = rooms.get(String(b.roomId || ""));
      if (!room) return send(404, { ok: false, error: "ROOM_NOT_FOUND" });
      if (b.adminId !== room.adminId) return send(403, { ok: false, error: "ADMIN_ONLY" });

      const action = String(b.action || "");
      if (action === "reset_invite") {
        for (const inv of room.invites.values()) inv.revoked = true;
        const fresh = issueInvite(room, Number(b.ttlMs || 5 * 60 * 1000));
        return send(200, { ok: true, action, invite: fresh });
      }
      if (action === "remove_member" && b.targetMemberId && b.targetMemberId !== room.adminId) {
        room.members.delete(String(b.targetMemberId));
        return send(200, { ok: true, action, membersCount: room.members.size });
      }
      if (action === "rotate_keys") {
        room.keyEpoch += 1;
        // Purge pre-rotation ciphertext blobs so rotated epoch cannot reuse old messages
        room.messages = [];
        return send(200, { ok: true, action, keyEpoch: room.keyEpoch, purgedPriorCiphertext: true });
      }
      if (action === "set_expiration") {
        room.messageLifetimeMs = Math.max(0, Number(b.messageLifetimeMs ?? 60_000));
        return send(200, { ok: true, action, messageLifetimeMs: room.messageLifetimeMs });
      }
      if (action === "destroy_room") {
        room.destroyed = true;
        room.messages = [];
        room.invites.clear();
        rooms.delete(room.roomId);
        return send(200, { ok: true, action, destroyed: true });
      }
      return send(400, { ok: false, error: "UNSUPPORTED_ADMIN_ACTION" });
    }

    if (req.method === "POST" && pathname === "/api/secret-chat/message") {
      const b = bodyJson || {};
      const room = rooms.get(String(b.roomId || ""));
      if (!room) return send(404, { ok: false, error: "ROOM_NOT_FOUND" });
      if (b.plaintext !== undefined) {
        return send(400, { ok: false, error: "PLAINTEXT_FORBIDDEN_USE_E2EE_CIPHERTEXT" });
      }
      if (!b.ciphertext || typeof b.ciphertext !== "string" || !b.iv || typeof b.iv !== "string") {
        return send(400, { ok: false, error: "E2EE_CIPHERTEXT_AND_IV_REQUIRED" });
      }
      const msg = {
        id: crypto.randomBytes(6).toString("hex"),
        senderId: String(b.senderId || "anon"),
        iv: b.iv,
        ciphertext: b.ciphertext,
        keyEpoch: Number(b.keyEpoch || room.keyEpoch),
        createdAt: Date.now()
      };
      room.messages.push(msg);
      return send(201, { ok: true, id: msg.id, createdAt: msg.createdAt, ttlMs: room.messageLifetimeMs });
    }

    if (req.method === "GET" && pathname === "/api/secret-chat/state") {
      const urlObj = new URL(req.url, "http://127.0.0.1");
      const roomId = String(urlObj.searchParams.get("roomId") || "");
      const room = rooms.get(roomId);
      if (!room) return send(404, { ok: false, error: "ROOM_NOT_FOUND" });
      return send(200, {
        ok: true,
        roomId: room.roomId,
        roomSaltB64: room.roomSaltB64,
        membersCount: room.members.size,
        maxMembers: room.maxMembers,
        keyEpoch: room.keyEpoch,
        messageLifetimeMs: room.messageLifetimeMs,
        messages: room.messages
      });
    }

    return send(404, { ok: false, error: "NOT_FOUND" });
  }

  return { handleRequest, rooms };
}

module.exports = { createRedSecretChatRouter };
