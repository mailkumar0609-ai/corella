"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import InstallApp from "@/components/InstallApp";
import { api, ApiError, supabase, type Me } from "@/lib/api";

const MeCtx = createContext<{ me: Me; refresh: () => Promise<void> } | null>(null);
export const useMe = () => useContext(MeCtx)!;

const NAV = [
  ["/dashboard", "Overview"], ["/agents", "Agents"], ["/runs", "Test runs"], ["/settings", "API & webhooks"], ["/billing", "Billing"],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.replace("/login");
    try {
      setMe(await api<Me>("/v1/me"));
    } catch (e) {
      if (e instanceof ApiError && e.message === "onboarding_required") return router.replace("/onboarding");
      if (e instanceof ApiError && e.status === 401) return router.replace("/login");
      setError(e instanceof Error ? e.message : "Could not load your workspace");
    }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  if (error) return <div className="main"><div className="alert">{error}</div></div>;
  if (!me) return <div className="main muted">Loading…</div>;

  return (
    <MeCtx.Provider value={{ me, refresh }}>
      <div className="shell">
        <nav className="side">
          <Link href="/dashboard" className="brand"><span className="dot" />Corella</Link>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={`nav ${path.startsWith(href) ? "on" : ""}`}>{label}</Link>
          ))}
          <div className="grow" style={{ flex: 1 }} />
          <div className="grow muted" style={{ fontSize: 13, padding: "0 10px" }}>
            {me.organization.name}<br /><span className="badge">{me.organization.plan}</span>
          </div>
          <InstallApp className="nav" />
          <a className="nav" href="#" onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); router.replace("/login"); }}>Sign out</a>
        </nav>
        <main className="main">{children}</main>
      </div>
    </MeCtx.Provider>
  );
}
