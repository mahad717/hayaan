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
import { CheckCircle2, Clock3, XCircle, HelpCircle, ShoppingBag } from "lucide-react";

import { getServerUser } from "@/lib/current-user";
import { getOwnedOrder, verifyAndApplyToOrder } from "@/lib/sifalo-server";
import { SifaloReturnActions } from "./sifalo-return-client";

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

  // ---- Guard states -------------------------------------------------------
  if (!orderId) {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title="Missing payment reference"
            body="We couldn't tell which order this payment belongs to. If you completed a payment, check your Orders page — it will update once the payment is confirmed."
          />
          <BackActions />
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title="Sign in to confirm your payment"
            body={`We couldn't confirm order ${orderId.slice(0, 8).toUpperCase()} because you are signed out. Sign in with the same account you paid with, then open Orders — the payment status will refresh there.`}
          />
          <BackActions />
        </div>
      </Shell>
    );
  }

  // Already confirmed on a previous visit? Show success without re-hitting the
  // gateway (idempotent return page).
  const existing = await getOwnedOrder(user.id, orderId);
  if (!existing) {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title="Order not found"
            body="This order doesn't exist or belongs to a different account."
          />
          <BackActions />
        </div>
      </Shell>
    );
  }

  if (existing.paymentStatus === "paid" || existing.status === "paid") {
    return <SuccessCard orderId={orderId} total={existing.totalAmount} paymentType={null} />;
  }

  // ---- Live verification ----------------------------------------------------
  const applied = await verifyAndApplyToOrder(user.id, orderId, sid);
  if ("error" in applied) {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#e6e2d4" }}>
          <ResultHead
            icon={<HelpCircle className="h-12 w-12 text-[#f28c28]" />}
            title="Couldn't check your payment"
            body={applied.error}
          />
          <SifaloReturnActions orderId={orderId} initialState="unknown" />
          <BackActions />
        </div>
      </Shell>
    );
  }

  const { result, order } = applied;

  if (result.state === "paid") {
    return <SuccessCard orderId={orderId} total={order?.totalAmount ?? existing.totalAmount} paymentType={result.paymentType} />;
  }

  if (result.state === "pending") {
    return (
      <Shell>
        <div className={CARD_BASE} style={{ borderColor: "#f5e3c8", backgroundColor: "#fffaf1" }}>
          <ResultHead
            icon={<Clock3 className="h-12 w-12 text-[#f28c28]" />}
            title="Payment pending approval"
            body={`${result.message} Your order ${orderId.slice(0, 8).toUpperCase()} is saved — we'll confirm it as soon as the network approves the transaction. You can safely check again.`}
          />
          <SifaloReturnActions orderId={orderId} initialState="pending" />
          <BackActions />
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
            title="Payment was not completed"
            body={`${result.message} No money has left your account. Your order ${orderId.slice(0, 8).toUpperCase()} is saved — you can retry checkout from the store.`}
          />
          <BackActions label="Back to store to retry" />
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
          title="We couldn't verify the payment yet"
          body={`${result.message} If you just completed the payment it can take a moment to register — try checking again.`}
        />
        <SifaloReturnActions orderId={orderId} initialState="unknown" />
        <BackActions />
      </div>
    </Shell>
  );
}

// ---- Building blocks --------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#faf8f1] px-4 py-16">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
        <ShoppingBag className="h-5 w-5 text-brand" /> Hayaan Market
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

function BackActions({ label = "Back to store" }: { label?: string }) {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        href="/"
        className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white"
      >
        {label}
      </Link>
    </div>
  );
}

function SuccessCard({
  orderId,
  total,
  paymentType,
}: {
  orderId: string;
  total: number;
  paymentType: string | null;
}) {
  return (
    <Shell>
      <div className={CARD_BASE} style={{ borderColor: "#cfe3cb", backgroundColor: "#fbfdf9" }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-14 w-14 text-brand" />
          <h1 className="text-2xl font-semibold text-brand-dark">Payment received — thank you!</h1>
          <p className="text-sm text-muted-foreground">
            Order reference{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-brand">
              {orderId.slice(0, 8).toUpperCase()}
            </code>
            {paymentType ? <span className="ml-2 text-xs">via {paymentType}</span> : null}
          </p>
        </div>
        <div className="mt-6 rounded-lg border border-[#e6e2d4] bg-white px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount paid</span>
            <span className="font-medium text-brand">{formatPrice(total)}</span>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Continue shopping
          </Link>
          <Link
            href="/?view=orders"
            className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white"
          >
            View my orders
          </Link>
        </div>
      </div>
    </Shell>
  );
}
