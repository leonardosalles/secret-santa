"use client";
import { ReactNode, useEffect } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm "
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:w-auto md:max-w-lg animate-slide-up md:animate-fade-in md:rounded-2xl md:border md:border-gray-800 md:bg-gray-900 md:p-6 bg-gray-900 rounded-t-2xl border-t border-gray-800 shadow-2xl md:min-w-[600px]"
      >
        {children}
      </div>
    </div>
  );
}
