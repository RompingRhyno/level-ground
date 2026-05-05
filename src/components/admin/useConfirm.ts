import { useState, useRef } from "react";

export type ConfirmVariant = "danger" | "primary";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmVariant: ConfirmVariant;
  confirmLabel: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [variant, setVariant] = useState<ConfirmVariant>("primary");
  const [label, setLabel] = useState<string | undefined>(undefined);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  function confirm(
    confirmTitle: string,
    confirmDescription?: string,
    confirmVariant: ConfirmVariant = "primary",
    confirmLabel?: string,
  ): Promise<boolean> {
    setTitle(confirmTitle);
    setDescription(confirmDescription ?? "");
    setVariant(confirmVariant);
    setLabel(confirmLabel);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }

  function resolve(value: boolean) {
    setOpen(false);
    const r = resolveRef.current;
    resolveRef.current = null;
    if (r) r(value);
  }

  const dialogProps: ConfirmDialogProps = {
    open,
    title,
    description,
    confirmVariant: variant,
    confirmLabel: label,
    onConfirm: () => resolve(true),
    onCancel: () => resolve(false),
  };

  return { confirm, dialogProps };
}
