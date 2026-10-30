"use client";

import { useState } from "react";
import { Copy, Facebook, Share2, Twitter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";

/**
 * Share button (Task 135). Rendered on the PDP (beside the wishlist heart —
 * the share+heart pair the Task 88 comment anticipated) and on blog posts.
 *
 * Behavior:
 *  • Native sheet first: navigator.share covers WhatsApp/ Messages/ Mail and
 *    whatever the device is good at. User-cancel (AbortError) is silent.
 *  • No Web Share (desktop browsers, headless) or a failed share → a small
 *    menu: WhatsApp, Facebook, X, Copy link. WhatsApp first — it is the
 *    dominant referral channel in the Somali market.
 *  • Copy uses the async Clipboard API with a textarea/execCommand fallback
 *    (HTTP and older WebView hosts), then toasts like the wishlist does.
 *
 * stopPropagation everywhere: the PDP image area sits under the badge stack
 * and product cards navigate on click.
 */
export function ShareButton({
  url,
  title,
  text,
  ariaLabel,
  className,
  iconClassName,
}: {
  url: string;
  title: string;
  text?: string;
  ariaLabel: string;
  className?: string;
  iconClassName?: string;
}) {
  const { toast } = useStore();
  const { t } = useLang();
  // The menu is only rendered after a native-share attempt has failed (or was
  // never possible) — so a fresh native sheet is tried on every first click.
  const [menuOpen, setMenuOpen] = useState(false);
  const [allowMenu, setAllowMenu] = useState(false);

  const shareMessage = [title, text].filter(Boolean).join(" — ");

  const openNative = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text: shareMessage, url });
        return; // shared natively — done
      }
    } catch (err) {
      // User closed the share sheet — not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Anything else (permission denied, unsupported payload) falls through
      // to the menu so the visitor still has a path to share.
    }
    setAllowMenu(true);
    setMenuOpen(true);
  };

  const openIntent = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast(t("share.copied"), "success");
    } catch {
      toast(t("share.copyFailed"), "error");
    }
  };

  // Encoded share intents (built at click time so the URL is never stale).
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${url}`.trim())}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) setAllowMenu(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            // First click tries the native sheet; with no Web Share the
            // handler flips allowMenu and the menu opens. When the menu is
            // already unlocked, let Radix toggle it (the default path).
            if (!allowMenu) void openNative(e);
          }}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          className={cn(
            "group/share flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            "bg-white/95 shadow-sm ring-1 ring-black/5 backdrop-blur-sm",
            "transition-all duration-150 hover:scale-105 hover:bg-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28]",
            className,
          )}
        >
          <Share2
            aria-hidden
            className={cn(
              "h-4 w-4 text-foreground/60 transition-colors group-hover/share:text-[#3f7d4a]",
              iconClassName,
            )}
          />
        </button>
      </DropdownMenuTrigger>
      {allowMenu && (
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          onClick={(e) => e.stopPropagation()}
          className="w-48"
        >
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("share.menu")}
          </p>
          <DropdownMenuItem
            className="gap-2.5"
            onClick={() => {
              setMenuOpen(false);
              openIntent(waHref);
            }}
          >
            <ShareWhatsAppIcon /> {t("share.whatsapp")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2.5"
            onClick={() => {
              setMenuOpen(false);
              openIntent(fbHref);
            }}
          >
            <Facebook aria-hidden className="h-4 w-4 text-[#1877f2]" /> {t("share.facebook")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2.5"
            onClick={() => {
              setMenuOpen(false);
              openIntent(xHref);
            }}
          >
            <Twitter aria-hidden className="h-4 w-4" /> {t("share.x")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2.5"
            onClick={() => {
              setMenuOpen(false);
              void copyLink();
            }}
          >
            <Copy aria-hidden className="h-4 w-4 text-muted-foreground" /> {t("share.copy")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

// WhatsApp has no Lucide glyph — draw the official bubble inline so the menu
// reads instantly in a market where WhatsApp IS the internet.
function ShareWhatsAppIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-[#25d366]">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}
