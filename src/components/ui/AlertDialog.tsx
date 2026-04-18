"use client";
import React from "react";

export default function AlertDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'danger' | 'primary';
}) {
  if (!open) return null;
  const confirmClass = confirmVariant === 'danger'
    ? 'px-3 py-1 rounded text-sm btn-negative'
    : 'px-3 py-1 rounded text-sm admin-btn';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full mx-4 p-4">
        <div className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</div>
        {description ? <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">{description}</div> : null}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 rounded text-sm admin-btn">{cancelLabel}</button>
          <button onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
