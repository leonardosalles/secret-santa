export async function sha256(str: string) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(buf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type PrivateKeyVault = {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
};
export type EncryptedPicked = {
  version: 1;
  algorithm: "RSA-OAEP-256";
  year: string;
  ciphertext: string;
};
export type DrawIdentity = { publicKey: string; privateKey: PrivateKeyVault };

function encode(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
const rsaAlgorithm = { name: "RSA-OAEP", hash: "SHA-256" };

async function passwordKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function createDrawIdentity(password: string, userId: string): Promise<{ identity: DrawIdentity; sessionKey: string }> {
  const pair = await crypto.subtle.generateKey({ ...rsaAlgorithm, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ["encrypt", "decrypt"]);
  const privateBytes = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) }, key, privateBytes);
  return {
    identity: { publicKey: encode(await crypto.subtle.exportKey("spki", pair.publicKey)), privateKey: { version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) } },
    sessionKey: encode(privateBytes),
  };
}

export async function unlockDrawIdentity(password: string, userId: string, vault: PrivateKeyVault) {
  if (vault.version !== 1) throw new Error("Formato de chave não suportado.");
  const key = await passwordKey(password, decode(vault.salt));
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(vault.iv), additionalData: new TextEncoder().encode(userId) }, key, decode(vault.ciphertext));
  return encode(bytes);
}

export async function encryptPicked(publicKey: string, pickedId: string, userId: string, year: string): Promise<EncryptedPicked> {
  const key = await crypto.subtle.importKey("spki", decode(publicKey), rsaAlgorithm, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "RSA-OAEP", label: new TextEncoder().encode(`${year}:${userId}`) }, key, new TextEncoder().encode(pickedId));
  return { version: 1, algorithm: "RSA-OAEP-256", year, ciphertext: encode(ciphertext) };
}

export async function decryptPicked(sessionKey: string, picked: EncryptedPicked, userId: string, year: string) {
  if (picked.version !== 1 || picked.algorithm !== "RSA-OAEP-256" || picked.year !== year) throw new Error("Resultado de outra edição ou formato inválido.");
  const key = await crypto.subtle.importKey("pkcs8", decode(sessionKey), rsaAlgorithm, false, ["decrypt"]);
  const bytes = await crypto.subtle.decrypt({ name: "RSA-OAEP", label: new TextEncoder().encode(`${year}:${userId}`) }, key, decode(picked.ciphertext));
  return new TextDecoder().decode(bytes);
}

export function drawSessionKey(userId: string) { return `secret-draw-key:${userId}`; }

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, material, 256);
  return `pbkdf2-sha256:600000:${encode(salt)}:${encode(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  if (/^[a-f0-9]{64}$/.test(stored)) return (await sha256(password)) === stored;
  const [algorithm, iterations, salt, expected] = stored.split(":");
  if (algorithm !== "pbkdf2-sha256" || iterations !== "600000" || !salt || !expected) return false;
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: decode(salt), iterations: 600_000, hash: "SHA-256" }, material, 256);
  return encode(hash) === expected;
}
