import crypto from "crypto";

type EncryptedPayload = {
  version: number;
  salt: string; // base64
  iv: string; // base64
  tag: string; // base64
  ciphertext: string; // base64
};

export function encryptPrivateKey(secretKey: Uint8Array, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(secretKey)), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return JSON.stringify(payload);
}

export function decryptPrivateKey(payloadStr: string, password: string): Uint8Array {
  const payload = JSON.parse(payloadStr) as EncryptedPayload;
  if (!payload || payload.version !== 1) throw new Error("Unsupported encrypted payload version");
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return Uint8Array.from(plaintext);
}
