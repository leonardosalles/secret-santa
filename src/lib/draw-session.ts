"use client";

import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { IS_TEST_MODE } from "./app-config";
import { createDrawIdentity, drawSessionKey, hashPassword, unlockDrawIdentity, verifyPassword, type DrawIdentity } from "@/utils/crypto";

export async function prepareDrawSession(userId: string, password: string) {
  const ref = doc(db, "users", userId);
  const snapshot = await getDoc(ref);
  const existing = snapshot.data()?.drawIdentity as DrawIdentity | undefined;
  const storedPicked = snapshot.data()?.picked;
  if (!existing && storedPicked && typeof storedPicked === "object") throw new Error("Sua chave privada não está disponível. Ela não será substituída.");
  const created = existing ? null : await createDrawIdentity(password, userId);
  let identity = existing || created!.identity;
  // Unlock before any write. Never replace an existing key when decryption fails.
  let sessionKey = created?.sessionKey || await unlockDrawIdentity(password, userId, identity.privateKey);
  if (!IS_TEST_MODE) {
    const passwordHash = await hashPassword(password);
    identity = await runTransaction(db, async (transaction) => {
      const current = await transaction.get(ref);
      const data = current.data();
      if (!data?.passwordHash || !await verifyPassword(password, data.passwordHash)) throw new Error("A senha foi alterada. Entre novamente.");
      const activeIdentity = (data.drawIdentity as DrawIdentity | undefined) || identity;
      transaction.update(ref, { drawIdentity: activeIdentity, passwordHash });
      return activeIdentity;
    });
    if (identity.publicKey !== (existing || created!.identity).publicKey) {
      sessionKey = await unlockDrawIdentity(password, userId, identity.privateKey);
    }
  }
  sessionStorage.setItem(drawSessionKey(userId), sessionKey);
}
