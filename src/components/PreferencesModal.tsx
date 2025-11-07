"use client";
import { X, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onSaved?: (prefs: string[]) => void;
};

export default function PreferencesModal({
  open,
  onClose,
  userId,
  onSaved,
}: Props) {
  const [prefs, setPrefs] = useState<string[]>([]);
  const [original, setOriginal] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      const ref = doc(db, "users", userId);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const p: string[] = (data?.preferences as string[]) || [];
      setPrefs(p);
      setOriginal(p);
    })();
  }, [open, userId]);

  const add = () => setPrefs((s) => [...s, ""]);
  const change = (i: number, v: string) =>
    setPrefs((s) => {
      const copy = [...s];
      copy[i] = v;
      return copy;
    });

  const remove = (i: number) =>
    setPrefs((s) => s.filter((_, idx) => idx !== i));

  const discard = () => {
    setPrefs(original);
    onClose();
  };

  const save = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 🧹 Limpeza antes de salvar
      const cleaned = prefs
        .map((p) => p.trim()) // remove espaços extras
        .filter((p) => p.length > 0); // remove vazios

      const ref = doc(db, "users", userId);
      await updateDoc(ref, { preferences: cleaned });
      setOriginal(cleaned);
      setPrefs(cleaned);
      onSaved?.(cleaned);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={discard}>
      <div className="relative flex flex-col items-center p-8 md:p-0">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition p-4 md:-top-4 md:-right-4 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título */}
        <h3 className="text-xl font-semibold mb-8 mt-4 text-center">
          🎁 Sugestões de Presente
        </h3>

        {/* Lista de sugestões */}
        <div className="w-full space-y-3 max-h-[55vh] overflow-y-auto">
          {prefs.length === 0 && (
            <p className="text-sm text-gray-400 text-center p-4 border rounded-lg mt-4 border-gray-800">
              Nenhuma sugestão ainda. Adicione usando o botão abaixo.
            </p>
          )}

          {prefs.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-gray-800 rounded-lg p-2"
            >
              <input
                className="flex-1 bg-transparent outline-none text-gray-100 px-2"
                value={p}
                onChange={(e) => change(i, e.target.value)}
                placeholder={`Sugestão ${i + 1}`}
              />
              <button
                onClick={() => remove(i)}
                className="text-red-400 hover:text-red-300 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
          <button
            onClick={add}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-3"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-3 disabled:opacity-70"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
