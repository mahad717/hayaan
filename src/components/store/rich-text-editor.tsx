"use client";

// WYSIWYG description editor for the admin product form (Task 69).
//
// A contentEditable surface + a small formatting toolbar (bold, italic,
// underline, bullet list, numbered list, small heading, clear formatting).
// Stored value is allowlist-sanitized HTML (see src/lib/rich-text.ts).
//
// Implementation notes:
//  - UNCONTROLLED: React never re-renders the caret position. Initial HTML
//    is set once on mount (the admin dialog remounts us per open via key),
//    and every edit flows OUT through onChange(html).
//  - Toolbar buttons use onMouseDown preventDefault so the editor keeps its
//    selection when clicked.
//  - Pasting is forced to plain text so Word/website markup can't smuggle
//    junk into the stored HTML.
//  - Blank content (only <br>/empty tags) normalizes to "" so the required
//    check and the placeholder both behave like the old textarea.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading3,
  RemoveFormatting,
} from "lucide-react";

import { looksLikeHtml, plainTextToEditorHtml, sanitizeRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

type Props = {
  /** Current stored value — formatted HTML or legacy plain text. */
  value: string;
  onChange: (html: string) => void;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
};

const blankHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "") === "";

export function RichTextEditor({ value, onChange, id, placeholder, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false, h3: false });

  // Initial content — mount only. The admin dialog remounts this component
  // (key={editing?.id ?? "new"}) when the dialog opens or switches product.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!value || !value.trim()) el.innerHTML = "";
    else if (looksLikeHtml(value)) el.innerHTML = sanitizeRichText(value);
    else el.innerHTML = plainTextToEditorHtml(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (blankHtml(el.innerHTML)) {
      // Clear stray <br>/empty tags so the placeholder shows and "" saves.
      if (el.innerHTML !== "") el.innerHTML = "";
      onChange("");
      return;
    }
    onChange(el.innerHTML);
  }, [onChange]);

  // Toolbar active states while the caret moves / selection changes.
  useEffect(() => {
    const onSel = () => {
      const el = ref.current;
      if (!el || !document.getSelection()?.anchorNode) return;
      if (!el.contains(document.getSelection()!.anchorNode)) return;
      try {
        setActive({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          ul: document.queryCommandState("insertUnorderedList"),
          ol: document.queryCommandState("insertOrderedList"),
          h3: String(document.queryCommandValue("formatBlock")).toLowerCase() === "h3",
        });
      } catch {
        /* queryCommandState can throw on odd selections — ignore */
      }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const cmd = useCallback(
    (name: string, val?: string) => {
      ref.current?.focus();
      try {
        document.execCommand(name, false, val);
      } catch {
        /* older browsers */
      }
      emit();
    },
    [emit],
  );

  const toggleHeading = useCallback(() => {
    const isH3 = String(document.queryCommandValue("formatBlock")).toLowerCase() === "h3";
    cmd("formatBlock", isH3 ? "<p>" : "<h3>");
  }, [cmd]);

  const clearFormatting = useCallback(() => {
    cmd("removeFormat");
    cmd("formatBlock", "<p>");
  }, [cmd]);

  const btn = (name: keyof typeof active, title: string, Icon: typeof Bold, onClick: () => void) => (
    <button
      key={name}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active[name]}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand",
        active[name] && "bg-brand/15 text-brand",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-md border border-brand/50 bg-white shadow-sm transition-colors hover:border-brand/70 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#efece2] bg-[#faf8f2] px-1 py-1" role="toolbar" aria-label="Text formatting">
        {btn("bold", "Bold (Ctrl+B)", Bold, () => cmd("bold"))}
        {btn("italic", "Italic (Ctrl+I)", Italic, () => cmd("italic"))}
        {btn("underline", "Underline (Ctrl+U)", Underline, () => cmd("underline"))}
        <span className="mx-1 h-5 w-px bg-[#e6e2d4]" aria-hidden />
        {btn("ul", "Bullet list", List, () => cmd("insertUnorderedList"))}
        {btn("ol", "Numbered list", ListOrdered, () => cmd("insertOrderedList"))}
        <span className="mx-1 h-5 w-px bg-[#e6e2d4]" aria-hidden />
        {btn("h3", "Section heading", Heading3, toggleHeading)}
        <span className="mx-1 h-5 w-px bg-[#e6e2d4]" aria-hidden />
        <button
          type="button"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormatting}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <RemoveFormatting className="h-4 w-4" />
        </button>
        <span className="ml-auto pr-1 text-[11px] text-muted-foreground/70">Bold, lists &amp; headings show on the product page</span>
      </div>
      <div
        ref={ref}
        id={id}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? placeholder}
        data-placeholder={placeholder}
        className="rich-editor max-h-[46vh] min-h-24 w-full overflow-y-auto px-3 py-2 text-sm leading-relaxed outline-none"
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emit();
        }}
      />
    </div>
  );
}
