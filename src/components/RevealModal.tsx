"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import giftAnimation from "@/assets/sorting.json";

type RevealModalProps = {
  open: boolean;
  onFinish: () => void;
};

export default function RevealModal({ open, onFinish }: RevealModalProps) {
  const [showFinalMessage, setShowFinalMessage] = useState(false);

  useEffect(() => {
    if (!open) return;

    setShowFinalMessage(false);

    // Após 5s, mostra a mensagem final
    const step1 = setTimeout(() => {
      setShowFinalMessage(true);
    }, 5000);

    // Após 7s no total, dispara onFinish()
    const step2 = setTimeout(() => {
      onFinish();
    }, 7000);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
    };
  }, [open, onFinish]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-[90%] max-w-sm text-center flex flex-col items-center"
          >
            <Lottie
              animationData={giftAnimation}
              loop={false}
              className="w-48 h-48 mb-4"
            />

            {!showFinalMessage ? (
              <>
                <p className="text-xl font-semibold text-blue-400 mb-2">
                  Sorteando seu amigo secreto...
                </p>
                <p className="text-lg text-gray-400">
                  Aguarde alguns segundos 🎁
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-green-400 mb-2">
                  Pronto! Sorteado, revelando...
                </p>
                <p className="text-lg text-gray-400">
                  Preparando seu resultado 👀
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
