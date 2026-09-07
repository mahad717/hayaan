import type { ReactNode } from "react";

/**
 * Markdown-lite renderer — zero dependencies, renders to React elements
 * (never raw HTML), so admin-authored content can't inject markup.
 *
 * Supported block syntax:
 *   ## Heading 2        ### Heading 3
 *   - unordered list    1. ordered list
 *   > blockquote        paragraphs separated by blank lines
 * Inline: **bold**, *italic*, [text](https://url)
 */

// Inline tokenizer: bold → italic → links, longest-delimiter first.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-i${i++}`;
    if (match[1] !== undefined) {
      nodes.push(<strong key={key} className="font-bold">{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key}>{match[2]}</em>);
    } else if (match[3] !== undefined && match[4] !== undefined) {
      nodes.push(
        <a key={key} href={match[4]} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline decoration-[#f28c28]/60 underline-offset-2 hover:decoration-[#f28c28]">
          {match[3]}
        </a>,
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownContent({ source, className = "" }: { source: string; className?: string }) {
  const lines = (source ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      const text = para.join(" ").trim();
      if (text) {
        blocks.push(
          <p key={`p${key++}`} className="leading-relaxed text-foreground/90">
            {renderInline(text, `p${key}`)}
          </p>,
        );
      }
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item, idx) => (
        <li key={`li${idx}`} className="leading-relaxed">{renderInline(item, `li${key}-${idx}`)}</li>
      ));
      blocks.push(
        list.ordered ? (
          <ol key={`ol${key++}`} className="list-decimal space-y-1.5 pl-5 text-foreground/90">{items}</ol>
        ) : (
          <ul key={`ul${key++}`} className="list-disc space-y-1.5 pl-5 text-foreground/90">{items}</ul>
        ),
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(
        <blockquote key={`q${key++}`} className="border-l-4 border-[#f28c28] bg-[#fef1de]/50 px-4 py-2 italic text-foreground/85">
          {renderInline(quote.join(" "), `q${key}`)}
        </blockquote>,
      );
      quote = [];
    }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flushAll(); continue; }

    const heading = trimmed.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushAll();
      const text = heading[2];
      if (heading[1].length === 2) {
        blocks.push(
          <h2 key={`h2${key++}`} className="mt-2 text-xl font-bold text-brand-dark sm:text-2xl">
            {renderInline(text, `h2${key}`)}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={`h3${key++}`} className="mt-1 text-lg font-bold text-brand-dark">
            {renderInline(text, `h3${key}`)}
          </h3>,
        );
      }
      continue;
    }

    const ulItem = trimmed.match(/^[-*]\s+(.*)$/);
    const olItem = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ulItem || olItem) {
      flushPara(); flushQuote();
      const ordered = Boolean(olItem);
      const itemText = (ulItem ? ulItem[1] : olItem![1]) ?? "";
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(itemText);
      continue;
    }

    const quoteLine = trimmed.match(/^>\s?(.*)$/);
    if (quoteLine) {
      flushPara(); flushList();
      quote.push(quoteLine[1]);
      continue;
    }

    flushList(); flushQuote();
    para.push(trimmed);
  }
  flushAll();

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {blocks.length > 0 ? blocks : <p className="text-sm italic text-muted-foreground">This article has no content yet.</p>}
    </div>
  );
}
