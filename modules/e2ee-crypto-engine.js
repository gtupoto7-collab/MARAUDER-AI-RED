"use strict";

function getSubtle() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  const { webcrypto } = require("crypto");
  return webcrypto.subtle;
}

function getRandomBytes(len) {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const arr = new Uint8Array(len);
    globalThis.crypto.getRandomValues(arr);
    return arr;
  }
  const { randomBytes } = require("crypto");
  return new Uint8Array(randomBytes(len));
}

function toBase64(u8) {
  if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64");
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

function fromBase64(b64) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function generateEcdhKeyPair() {
  const subtle = getSubtle();
  const keyPair = await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const publicJwk = await subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await subtle.exportKey("jwk", keyPair.privateKey);
  return { keyPair, publicJwk, privateJwk };
}

async function deriveRoomAesKey(privateKey, peerPublicJwk, roomSaltB64, keyEpoch = 1) {
  const subtle = getSubtle();
  const peerPublicKey = await subtle.importKey(
    "jwk",
    peerPublicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    256
  );
  const baseKey = await subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  const saltBytes = fromBase64(roomSaltB64);
  const infoBytes = new TextEncoder().encode(`MARAUDER-RED-SECRET-CHAT-EPOCH-${Number(keyEpoch) || 1}`);

  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBytes, info: infoBytes },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptMessage(aesKey, plaintext, aadText = "") {
  const subtle = getSubtle();
  const iv = getRandomBytes(12);
  const encoded = new TextEncoder().encode(String(plaintext));
  const params = {
    name: "AES-GCM",
    iv,
    ...(aadText ? { additionalData: new TextEncoder().encode(String(aadText)) } : {})
  };
  const cipherBuf = await subtle.encrypt(params, aesKey, encoded);
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(cipherBuf))
  };
}

async function decryptMessage(aesKey, ivB64, ciphertextB64, aadText = "") {
  const subtle = getSubtle();
  const iv = fromBase64(ivB64);
  const data = fromBase64(ciphertextB64);
  const params = {
    name: "AES-GCM",
    iv,
    ...(aadText ? { additionalData: new TextEncoder().encode(String(aadText)) } : {})
  };
  const plainBuf = await subtle.decrypt(params, aesKey, data);
  return new TextDecoder().decode(plainBuf);
}

module.exports = {
  generateEcdhKeyPair,
  deriveRoomAesKey,
  encryptMessage,
  decryptMessage
};
