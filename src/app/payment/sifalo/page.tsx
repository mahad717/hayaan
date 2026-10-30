// /payment/sifalo — Sifalo Pay hosted-checkout RETURN landing page.
//
// Sifalo redirects the customer here after payment with query params:
//   order_id  (we attached it to return_url when initiating)
//   sid       (Sifalo transaction ID, appended by Sifalo)
//
// The page verifies the transaction server-side (never trusting the browser),
// updates the order, and shows the outcome. Also handles "check again" for
// pending transactions.

import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2, Clock3, XCircle, HelpCircle } from "lucide-react";

import { getServerUser } from "@/lib/current-user";
import { getOwnedOrder, verifyAndApplyToOrder } from "@/lib/sifalo-server";
import { isLang, LANG_COOKIE, translate, type DictKey } from "@/lib/i18n/dictionary";
import { localizeApiError } from "@/lib/i18n/api-errors";
import { SifaloReturnActions } from "./sifalo-return-client";
import { ClearGuestCart } from "./clear-guest-cart";

export const dynamic = "force-dynamic";

function formatPrice(price: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

const CARD_BASE = "mx-auto w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm";

export default async function SifaloReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; sid?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order_id ?? "";
  const sid = params.sid ?? null;

  const user = await getServerUser();
  // Somali (so) when the visitor's language cookie says so; English otherwise.
  const cookieStore = await cookies();
  const lang = isLang(cookieStore.get(LANG_COOKIE)?.value)
    ? (cookieStore.get(LANG_COOKIE)!.value as "en" | "so")
    : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  // ---- Guard states -------------------------------------------------------
  if (!orderId) {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title={t("sf.missingRefTitle")}
            body={t("sf.missingRefBody")}
          />
          <BackActions lang={lang} />
        </div>
      </Shell>
    );
  }

  // Already confirmed on a previous visit? Show success without re-hitting the
  // gateway (idempotent return page).
  // Task 136 (guest checkout): with no session the caller can still reach
  // THEIR order — getOwnedOrder(null, …) matches ONLY guest orders
  // (user_id IS NULL), so a guest URL can never open a customer's order.
  // A signed-out visitor whose reference doesn't match any guest order gets
  // the sign-in prompt below (their order needs a session after all).
  const existing = await getOwnedOrder(user ? user.id : null, orderId);
  if (!existing) {
    if (!user) {
      return (
        <Shell>
          <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
            <ResultHead
              icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
              title={t("sf.signinTitle")}
              body={t("sf.signinBody", { ref: orderId.slice(0, 8).toUpperCase() })}
            />
            <BackActions lang={lang} />
          </div>
        </Shell>
      );
    }
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title={t("sf.notFoundTitle")}
            body={t("sf.notFoundBody")}
          />
          <BackActions lang={lang} />
        </div>
      </Shell>
    );
  }

  if (existing.paymentStatus === "paid" || existing.status === "paid") {
    return <SuccessCard lang={lang} orderId={orderId} total={existing.totalAmount} paymentType={null} guest={!user} />;
  }

  // ---- Live verification ----------------------------------------------------
  const applied = await verifyAndApplyToOrder(user ? user.id : null, orderId, sid);
  if ("error" in applied) {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title={t("sf.cantCheckTitle")}
            // Task 115 (Norman): never print the raw server error at the money
            // moment — map the known messages into the visitor's language and
            // fall back to the same human "can't check" copy otherwise.
            body={localizeApiError(applied.error, (key) => translate(lang, key)) || t("sf.cantCheckBody")}
          />
          <SifaloReturnActions orderId={orderId} initialState="unknown" />
          <BackActions lang={lang} />
        </div>
      </Shell>
    );
  }

  const { result, order } = applied;

  if (result.state === "paid") {
    return (
      <SuccessCard
        lang={lang}
        orderId={orderId}
        total={order?.totalAmount ?? existing.totalAmount}
        paymentType={result.paymentType ?? null}
        guest={!user}
      />
    );
  }

  if (result.state === "pending") {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#f5e3c8", backgroundColor: "#fffaf1" }}>
          <ResultHead
            icon={<Clock3 className="h-12 w-12 text-[#f28c28]" />}
            title={t("sf.pendingTitle")}
            body={t("sf.pendingBody", { msg: result.message, ref: orderId.slice(0, 8).toUpperCase() })}
          />
          <SifaloReturnActions orderId={orderId} initialState="pending" />
          <BackActions lang={lang} />
        </div>
      </Shell>
    );
  }

  if (result.state === "failed") {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#f3d4cf", backgroundColor: "#fff7f5" }}>
          <ResultHead
            icon={<XCircle className="h-12 w-12 text-red-500" />}
            title={t("sf.failedTitle")}
            body={t("sf.failedBody", { msg: result.message, ref: orderId.slice(0, 8).toUpperCase() })}
          />
          <BackActions lang={lang} label={t("sf.backRetry")} />
        </div>
      </Shell>
    );
  }

  // unknown — gateway didn't give a clear answer (network hiccup, bad ref…)
  return (
    <Shell>
      <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
        <ResultHead
          icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
          title={t("sf.unknownTitle")}
          body={t("sf.unknownBody", { msg: result.message })}
        />
        <SifaloReturnActions orderId={orderId} initialState="unknown" />
        <BackActions lang={lang} />
      </div>
    </Shell>
  );
}

// ---- Building blocks --------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#faf8f1] px-4 py-16">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
        {/* Official Hayaan cart mark — dark green variant */}
        <img src="/hayaan-logo-green.svg" alt="" aria-hidden="true" className="h-6 w-6" /> Hayaan Market
      </Link>
      {children}
    </div>
  );
}

function ResultHead({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {icon}
      <h1 className="text-xl font-semibold text-brand-dark">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function BackActions({ label, lang }: { label?: string; lang: "en" | "so" }) {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href="/"
        className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white"
      >
        {label ?? translate(lang, "pdp.back")}
      </Link>
    </div>
  );
}

function SuccessCard({
  orderId,
  total,
  paymentType,
  lang,
  guest,
}: {
  orderId: string;
  total: number;
  paymentType: string | null;
  lang: "en" | "so";
  guest?: boolean;
}) {
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  return (
    <Shell>
      {/* Task 136: a paid guest order means the local cart is spent — drop it. */}
      {guest && <ClearGuestCart />}
      <div className={CARD_BASE} style={{ borderColor: "#cfe3cb", backgroundColor: "#fbfdf9" }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-14 w-14 text-brand" />
          <h1 className="text-2xl font-semibold text-brand-dark">{t("sf.received")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("co.orderRef")}{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-brand">
              {orderId.slice(0, 8).toUpperCase()}
            </code>
            {paymentType ? <span className="ml-2 text-xs">{t("sf.via", { type: paymentType })}</span> : null}
          </p>
        </div>
        <div className="mt-6 rounded-lg border border-[#e6e2d4] bg-white px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("co.totalPaid")}</span>
            <span className="font-medium text-brand">{formatPrice(total)}</span>
          </div>
        </div>
        {guest && (
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            {t("co.guestDoneNote")}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {t("co.continueShopping")}
          </Link>
          {!guest && (
            <Link
              href="/?view=orders"
              className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white"
            >
              {t("co.viewOrders")}
            </Link>
          )}
        </div>
      </div>
    </Shell>
  );
}
