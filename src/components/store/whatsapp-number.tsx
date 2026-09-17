"use client";

import { createContext, useContext } from "react";

/**
 * Carries the WhatsApp business number from the server layout (request-time
 * resolution) down to the floating WhatsApp button.
 *
 * Why a provider: the button is a client component, and NEXT_PUBLIC_ vars are
 * only inlined into the client bundle when they exist at BUILD time. If the
 * owner sets the variable as a Worker runtime variable instead (no rebuild
 * needed), only server code can see it — so the root layout resolves it on
 * every request and feeds it here.
 */
const WhatsAppNumberContext = createContext<string>("");

export function WhatsAppNumberProvider({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <WhatsAppNumberContext.Provider value={number}>
      {children}
    </WhatsAppNumberContext.Provider>
  );
}

export function useWhatsAppNumber(): string {
  return useContext(WhatsAppNumberContext);
}
