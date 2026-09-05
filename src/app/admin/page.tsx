import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/current-user";
import { AdminTopbar } from "@/components/store/admin-topbar";
import { AdminPanel } from "@/components/store/admin-panel";


// Server-side route guard: the session is checked on the server BEFORE any
// admin UI is rendered. Non-admins (and signed-out visitors) are redirected
// to the storefront — the admin bundle is never even sent to them.
export default async function AdminPage() {
  const user = await getServerUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <>
      <AdminTopbar user={user} />
      <main className="flex-1">
        <AdminPanel user={user} />
      </main>
      <footer className="border-t border-[#e6e2d4] py-4">
        <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground sm:px-6">
          Hayaan Market admin · signed in as {user.email}
        </p>
      </footer>
    </>
  );
}
