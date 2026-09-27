"use client";
import React, { useEffect } from "react";

type Variant = 'danger' | 'primary' | 'positive';

const VARIANT_CLASS: Record<Variant, string> = {
  danger: 'btn-negative',
  primary: 'admin-btn',
  positive: 'btn-positive',
};

export default function AlertDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
  cancelVariant = 'neutral',
  onDismiss,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Right-hand button; `positive` is the green the page editor's Save uses. */
  confirmVariant?: Variant;
  /** Left-hand button; `danger` paints it red (e.g. "Discard changes"). */
  cancelVariant?: Variant | 'neutral';
  /** Clicking the backdrop or pressing Escape. Defaults to `onCancel`, i.e. same as the left button. */
  onDismiss?: () => void;
}) {
  const dismiss = onDismiss ?? onCancel;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;
  const confirmClass = `px-3 py-1 rounded text-sm ${VARIANT_CLASS[confirmVariant]}`;
  const cancelClass = `px-3 py-1 rounded text-sm ${
    cancelVariant === 'neutral' ? 'admin-btn' : VARIANT_CLASS[cancelVariant]
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full mx-4 p-4">
        <div className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</div>
        {description ? <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">{description}</div> : null}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={cancelClass}>{cancelLabel}</button>
          <button onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
