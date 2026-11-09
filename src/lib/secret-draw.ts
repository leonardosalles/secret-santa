import { collection, doc, getDocsFromServer, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { APP_YEAR, IS_TEST_MODE } from "./app-config";
import { encryptPicked, type DrawIdentity, type EncryptedPicked } from "@/utils/crypto";

import { assignParticipants } from "@/utils/draw";

export async function getOrCreatePrivateDraw(userId: string): Promise<EncryptedPicked> {
  if (IS_TEST_MODE) throw new Error("O modo teste não grava sorteios.");
  const roster = await getDocsFromServer(collection(db, "users"));
  const editionRef = doc(db, "editions", APP_YEAR, "draws", "secret");
  return runTransaction(db, async (transaction) => {
    const edition = await transaction.get(editionRef);
    const snapshots = await Promise.all(roster.docs.map((user) => transaction.get(user.ref)));
    const me = snapshots.find((user) => user.id === userId);
    if (!me?.exists()) throw new Error("Participante não encontrado.");
    if (edition.exists()) {
      const picked = me.data()?.picked as EncryptedPicked | undefined;
      if (!picked || typeof picked !== "object" || picked.year !== APP_YEAR) throw new Error("Você não faz parte do sorteio desta edição. Nenhum resultado foi alterado.");
      return picked;
    }
    const pending = snapshots.filter((user) => !user.data()?.drawIdentity?.publicKey);
    if (pending.length) throw new Error(`Antes do sorteio, ${pending.length} participante(s) precisam entrar novamente para preparar sua chave privada.`);
    const fixed: Record<string, string> = Object.create(null);
    for (const user of snapshots) {
      const picked = user.data()?.picked;
      if (typeof picked === "string" && picked) fixed[user.id] = picked;
      if (picked && typeof picked === "object" && picked.year === APP_YEAR) throw new Error("Há resultados cifrados sem o registro da edição. Nenhum resultado foi alterado.");
    }
    const assignments = assignParticipants(snapshots.map((user) => user.id), fixed);
    const sealed = await Promise.all(snapshots.map(async (user) => ({
      ref: user.ref,
      picked: await encryptPicked((user.data()?.drawIdentity as DrawIdentity).publicKey, assignments[user.id], user.id, APP_YEAR),
    })));
    // All results and the edition marker commit atomically, including legacy migration.
    for (const { ref, picked } of sealed) transaction.update(ref, { picked });
    transaction.set(editionRef, { year: APP_YEAR, participantIds: snapshots.map((user) => user.id), version: 1, createdAt: serverTimestamp() });
    return sealed.find((user) => user.ref.id === userId)!.picked;
  });
}
