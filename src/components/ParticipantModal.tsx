"use client";
import { X } from "lucide-react";
import Modal from "./ui/Modal";
import { getAvatarUrl } from "@/utils/image";

type Props = {
  open: boolean;
  onClose: () => void;
  participant?: {
    id: string;
    name: string;
    preferences?: string[];
    avatarUrl?: string;
  } | null;
};

export default function ParticipantModal({
  open,
  onClose,
  participant,
}: Props) {
  if (!participant) return null;

  const hasPreferences =
    Array.isArray(participant.preferences) &&
    participant.preferences.length > 0;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="relative flex flex-col items-center p-8 md:p-0">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition p-4 md:-top-4 md:-right-4 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Avatar */}
        <img
          src={getAvatarUrl(participant)}
          alt={participant.name}
          className="w-28 h-28 rounded-full object-cover mb-4 border border-gray-800 mt-6"
        />

        {/* Nome */}
        <h3 className="text-xl font-semibold mb-3">{participant.name}</h3>

        {/* Sugestões */}
        <div className="w-full">
          <h4 className="text-md text-gray-300 mb-2 text-left font-semibold">
            🎁 Sugestões de Presente
          </h4>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {!hasPreferences ? (
              <p className="text-sm text-gray-400 text-center p-4 border rounded-lg mt-4 border-gray-800">
                Nenhuma sugestão registrada.
              </p>
            ) : (
              participant.preferences!.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-800 rounded-md p-2"
                >
                  <span className="text-sm text-gray-100">{p}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
