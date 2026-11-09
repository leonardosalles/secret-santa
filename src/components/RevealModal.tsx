"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles, Star, X } from "lucide-react";
import Modal from "./ui/Modal";

type RevealModalProps = {
  open: boolean;
  onFinish: () => void;
  onClose: () => void;
  variant?: "secret" | "starter";
  result?: { name: string; avatarUrl: string } | null;
};

export default function RevealModal({
  open,
  onFinish,
  onClose,
  variant = "secret",
  result,
}: RevealModalProps) {
  const [ready, setReady] = useState(false);
  const finishRef = useRef(onFinish);

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    if (!open) return;
    const reset = setTimeout(() => setReady(false), 0);
    const reveal = setTimeout(() => setReady(true), 3000);
    const finish = setTimeout(() => finishRef.current(), 4200);
    return () => {
      clearTimeout(reset);
      clearTimeout(reveal);
      clearTimeout(finish);
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="draw-modal relative flex flex-col items-center px-6 py-10 text-center">
        <button onClick={onClose} aria-label="Fechar sorteio" className="absolute right-0 top-0 p-3 text-gray-400 hover:text-gray-100"><X size={20} /></button>
        <span className="eyebrow"><Sparkles size={14} /> UM POUQUINHO DE MAGIA</span>
        {result ? (
          <div className="draw-result mt-9 mb-6"><Image unoptimized width={112} height={112} src={result.avatarUrl} alt={result.name} className="h-28 w-28 rounded-full border-4 border-blue-400 object-cover" /><Star className="draw-result-star text-blue-400" size={28} fill="currentColor" /></div>
        ) : (
          <div className={`gift-stage ${ready ? "gift-stage-ready" : ""}`} aria-hidden="true">
            <div className="gift-halo" />
            {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`gift-spark gift-spark-${i}`}><Star size={i % 2 ? 12 : 18} fill="currentColor" /></span>)}
            <div className="gift-package"><div className="gift-glow" /><div className="gift-lid"><span className="gift-bow gift-bow-left" /><span className="gift-bow gift-bow-right" /></div><div className="gift-box"><span className="gift-ribbon" /><span className="gift-tag"><Gift size={16} /></span></div></div>
            <div className="gift-shadow" />
          </div>
        )}
        <div role="status" aria-live="polite" aria-atomic="true">
          <h3 className="text-2xl font-semibold tracking-tight text-blue-400">
            {result ? result.name : ready ? "A surpresa está chegando!" : variant === "starter" ? "Quem abre essa festa?" : "Um presente de destino…"}
          </h3>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-400">
            {result ? "Você começa a rodada de presentes. Que venham as surpresas!" : ready ? "Só mais um instante para revelar…" : variant === "starter" ? "Misturando os nomes e preparando a primeira surpresa da noite." : "Entre laços e boas conexões, seu amigo secreto está quase aqui."}
          </p>
        </div>
        {result ? <button onClick={onClose} className="mt-7 rounded-xl bg-blue-600 px-8 py-3 text-sm font-medium hover:bg-blue-700">Vamos começar!</button> : <div className="draw-progress mt-8" aria-hidden="true"><span /></div>}
      </div>
    </Modal>
  );
}
