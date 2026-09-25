"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "info" | "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string; detail?: string };

const ToastContext = createContext<((toast: Omit<Toast, "id">) => void) | null>(null);

const STYLES: Record<ToastKind, string> = {
  info: "border-(--color-brand-accent) bg-white text-(--color-brand-dark)",
  success: "border-(--btn-positive-bg) bg-white text-(--color-brand-dark)",
  error: "border-(--btn-negative-bg) bg-white text-(--color-brand-dark)",
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), toast.kind === "error" ? 8000 : 4500);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(22rem,90vw)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`rounded-lg border-l-4 shadow-lg px-3 py-2 text-sm ${STYLES[toast.kind]}`}
          >
            <div className="font-medium">{toast.message}</div>
            {toast.detail && <div className="text-xs opacity-80 mt-0.5 break-words">{toast.detail}</div>}
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
              className="absolute right-2 top-1 text-xs opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used inside <ToastProvider>");
  return push;
}
