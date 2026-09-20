// Visible FAQ block for AEO (Task 77). Server-renderable (no client hooks):
// answer engines and crawlers see the full question/answer text in the HTML,
// which is what FAQPage structured data requires (markup must match visible
// content). Used by the homepage (site-wide Q&A), category pages and blog
// guides.

import type { FaqEntry } from "@/lib/faq";

export function FaqSection({
  faqs,
  title = "Frequently asked questions",
  className = "",
}: {
  faqs: FaqEntry[];
  title?: string;
  className?: string;
}) {
  if (!faqs.length) return null;
  return (
    <section className={className} aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-lg font-semibold text-brand-dark">
        {title}
      </h2>
      {/* items-start: without it, grid rows stretch to the tallest card, so
          opening one question visually "expanded" its parallel card too. */}
      <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-xl border border-[#e6e2d4] bg-white p-4 open:bg-[#faf8f1]"
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-brand-dark marker:hidden">
              <span className="mr-1 text-brand group-open:hidden" aria-hidden>
                +
              </span>
              <span className="mr-1 hidden text-brand group-open:inline" aria-hidden>
                −
              </span>
              {f.q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
