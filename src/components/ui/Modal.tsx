"use client";
import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="modal"
            onClick={(e) => e.stopPropagation()}
            initial={{
              y: "100%",
              opacity: 0,
              scale: 0.98,
            }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
              transition: { type: "spring", stiffness: 180, damping: 22 },
            }}
            exit={{
              y: "100%",
              opacity: 0,
              transition: { duration: 0.45, ease: "easeInOut" },
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do amigo secreto"
            className="w-full md:w-auto md:max-w-lg md:rounded-2xl md:border md:border-gray-800 md:bg-gray-900 md:p-6 
                       bg-gray-900 rounded-t-2xl border-t border-gray-800 shadow-2xl md:min-w-[min(600px,90vw)] max-h-[90dvh] overflow-y-auto"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
