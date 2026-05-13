"use client";
import { useEffect, useRef, useState } from "react";

export default function RichContentEditable({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Sync external value changes into the DOM without disturbing the cursor during typing.
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  // Update bold/italic toggle state whenever the selection changes while focused.
  useEffect(() => {
    function onSelectionChange() {
      if (document.activeElement !== divRef.current) return;
      setIsBold(document.queryCommandState("bold"));
      setIsItalic(document.queryCommandState("italic"));
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function handleInput() {
    const el = divRef.current;
    if (!el) return;
    onChange(el.innerHTML);
  }

  // Strip all markup on paste — only allow plain text.
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  // onMouseDown + preventDefault keeps focus on the contenteditable before execCommand fires.
  function format(cmd: "bold" | "italic") {
    divRef.current?.focus();
    document.execCommand(cmd, false);
    setIsBold(document.queryCommandState("bold"));
    setIsItalic(document.queryCommandState("italic"));
  }

  function btnStyle(active: boolean) {
    return {
      backgroundColor: active ? "var(--color-brand-dark)" : "white",
      color: active ? "white" : "var(--color-brand-dark)",
      borderColor: "var(--color-brand-dark)",
    };
  }

  return (
    <div>
      <div className="flex gap-1 mb-1">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format("bold"); }}
          className="w-6 h-6 text-xs font-bold rounded border transition-colors flex items-center justify-center"
          style={btnStyle(isBold)}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); format("italic"); }}
          className="w-6 h-6 text-xs italic rounded border transition-colors flex items-center justify-center"
          style={btnStyle(isItalic)}
          title="Italic"
        >
          I
        </button>
      </div>
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={`min-h-[34px] rounded border px-2 py-1 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none ${className ?? ""}`}
      />
    </div>
  );
}
