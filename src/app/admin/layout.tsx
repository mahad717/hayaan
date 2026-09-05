import type { Metadata } from "next";
import { AdminTopbar } from "@/components/store/admin-topbar";

// Keep the whole /admin area out of search engines.
export const metadata: Metadata = {
  title: "Admin Dashboard — Hayaan Market",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Page-level guard renders AdminTopbar only for verified admins. */}
      {children}
    </div>
  );
}
