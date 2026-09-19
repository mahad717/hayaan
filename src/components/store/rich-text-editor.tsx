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

// --- Task 70: deterministic list conversion -----------------------------------
// document.execCommand('insert(Unordered|Ordered)List') is UNRELIABLE for the
// "select existing text -> make it a list" flow: Chrome nests the <ul> inside
// the surrounding <p> (invalid HTML), leaves the first selected line as
// paragraph text, and fragments the selection into multiple lists on toggle
// (reproduced + confirmed against the owner's live stored description). These
// helpers convert whole selected lines into ONE clean top-level list instead.

/** Split an element's children into inline runs separated by <br> (dropping the brs and blank runs). */
function splitRunsOnBr(el: Element): Node[][] {
  const runs: Node[][] = [[]];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeName === "BR") {
      runs.push([]);
      continue;
    }
    runs[runs.length - 1].push(n);
  }
  return runs.filter((run) =>
    run.some((n) =>
      n.nodeType === Node.ELEMENT_NODE
        ? (n as Element).tagName !== "BR"
        : (n.textContent ?? "").trim() !== "",
    ),
  );
}

/**
 * The "block unit" a selection endpoint lives in: an <li> when inside a list,
 * otherwise the direct child of the editor root (p / div / h3 / h4 / ul / ol).
 * Returns null when the endpoint sits somewhere we don't do surgery (bare
 * text directly in the root, outside the editor) — callers fall back to
 * execCommand for those.
 */
function unitFor(node: Node, root: HTMLElement): Element | null {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  if (!el || !root.contains(el)) return null;
  const li = el.closest("li");
  if (li && root.contains(li)) return li;
  while (el.parentElement && el.parentElement !== root) el = el.parentElement;
  return el && el !== root ? el : null;
}

/**
 * Ordered block units intersecting the selection, at whole-line granularity:
 * partially selected paragraphs are taken whole (standard WYSIWYG behavior);
 * for top-level lists only the intersecting <li> items are taken.
 */
function selectedUnits(root: HTMLElement, range: Range): Element[] | null {
  const startEl = unitFor(range.startContainer, root);
  const endEl = unitFor(range.endContainer, root);
  if (!startEl || !endEl) return null;
  const units: Element[] = [];
  for (const child of Array.from(root.children)) {
    if (child.tagName === "UL" || child.tagName === "OL") {
      for (const li of Array.from(child.children)) {
        if (li === startEl || li === endEl || range.intersectsNode(li)) units.push(li);
      }
    } else if (child === startEl || child === endEl || range.intersectsNode(child)) {
      units.push(child);
    }
  }
  return units.length ? units : null;
}

/** Remove a node and prune the list ancestor it leaves empty. */
function removeUnit(el: Element) {
  const parent = el.parentElement;
  el.remove();
  if (parent && (parent.tagName === "UL" || parent.tagName === "OL") && parent.childElementCount === 0) {
    parent.remove();
  }
}

function restoreSelectionAround(list: HTMLUListElement | HTMLOListElement, collapsed: boolean) {
  const sel = document.getSelection();
  if (!sel || !list.firstChild) return;
  const range = document.createRange();
  if (collapsed) {
    range.setStart(list.firstChild, 0);
    range.collapse(true);
  } else {
    range.setStartBefore(list.firstChild);
    range.setEndAfter(list.lastChild ?? list.firstChild);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

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

  // Deterministic bullet/numbered toggle (Task 70): converts the selected
  // lines into ONE top-level <ul>/<ol>, switches kinds in place, and unwraps
  // back to paragraphs when toggled off. Falls back to execCommand only for
  // selections we can't map to clean block units (bare text in root etc.).
  const toggleList = useCallback(
    (kind: "ul" | "ol") => {
      const root = ref.current;
      if (!root) return;
      root.focus();
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;

      const units = selectedUnits(root, range);
      if (!units) {
        try {
          document.execCommand(kind === "ul" ? "insertUnorderedList" : "insertOrderedList", false);
        } catch {
          /* older browsers */
        }
        emit();
        return;
      }

      const collapsed = range.collapsed;

      // Toggle OFF: every selected unit is an <li> of this list kind.
      const allLi = units.every((el) => el.tagName === "LI");
      const kinds = new Set(
        units.map((el) => el.parentElement?.tagName?.toLowerCase() ?? ""),
      );
      if (allLi && kinds.size === 1 && kinds.has(kind)) {
        for (const li of units) {
          const list = li.parentElement!;
          for (const run of splitRunsOnBr(li)) {
            const p = document.createElement("p");
            run.forEach((n) => p.appendChild(n));
            list.parentNode?.insertBefore(p, list);
          }
          removeUnit(li);
        }
        emit();
        return;
      }

      // Convert (or switch kind): gather lines from every selected unit.
      const lines: Node[][] = [];
      for (const unit of units) lines.push(...splitRunsOnBr(unit));
      const list = document.createElement(kind);
      for (const run of lines) {
        const li = document.createElement("li");
        run.forEach((n) => li.appendChild(n));
        list.appendChild(li);
      }
      if (list.childElementCount === 0) list.appendChild(document.createElement("li"));

      // Insert before the first unit's top-level owner, then remove originals.
      const first = units[0];
      let owner: Element = first;
      while (owner.parentElement && owner.parentElement !== root) owner = owner.parentElement;
      owner.parentElement?.insertBefore(list, owner) ?? root.appendChild(list);
      for (const unit of units) removeUnit(unit);

      restoreSelectionAround(list, collapsed);
      emit();
    },
    [emit],
  );

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
        {btn("ul", "Bullet list", List, () => toggleList("ul"))}
        {btn("ol", "Numbered list", ListOrdered, () => toggleList("ol"))}
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
