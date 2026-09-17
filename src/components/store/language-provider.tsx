"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { LANG_COOKIE, translate, type DictKey, type Lang } from "@/lib/i18n/dictionary";

type Vars = Record<string, string | number>;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Vars) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

/**
 * Client language context. SSR renders with the cookie-derived `initialLang`
 * (root layout reads `hayaan_lang`), so the first paint already matches the
 * chosen language — no flash, no reload. Toggling writes the cookie (so the
 * NEXT server render matches too) and updates <html lang> for accessibility.
 */
export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: Vars) => translate(lang, key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  // Storefront components always mount under LangProvider; the fallback keeps
  // any straggler rendering English instead of crashing.
  return ctx ?? { lang: "en", setLang: () => {}, t: (key, vars) => translate("en", key, vars) };
}

/**
 * Compact EN | SO switch — lives in the header's right cluster on every
 * viewport, so the language is never more than one tap away.
 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div
      className={cn(
        "flex items-center rounded-full border border-[#e6e2d4] bg-white/80 p-0.5",
        className,
      )}
      role="group"
      aria-label={t("lang.toggleAria")}
    >
      {(["en", "so"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          aria-label={l === "en" ? "English" : "Soomaali"}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
            lang === l ? "bg-brand text-white" : "text-muted-foreground hover:text-brand",
          )}
        >
          {l === "en" ? "EN" : "SO"}
        </button>
      ))}
    </div>
  );
}
