"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IconAgents, IconCard, IconHome, IconKey, IconOut, IconRuns, Mark } from "@/components/Icons";
import InstallApp from "@/components/InstallApp";
import { api, ApiError, supabase, type Me } from "@/lib/api";

const MeCtx = createContext<{ me: Me; refresh: () => Promise<void> } | null>(null);
export const useMe = () => useContext(MeCtx)!;

const NAV = [
  ["/dashboard", "Overview", "Home", IconHome], ["/agents", "Agents", "Agents", IconAgents], ["/runs", "Test runs", "Runs", IconRuns],
  ["/settings", "API & webhooks", "API", IconKey], ["/billing", "Plan & billing", "Billing", IconCard],
] as const;

function Splash() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}><Mark size={44} /><div className="skel" style={{ width: 120, height: 8, margin: "18px auto 0" }} /></div>
    </div>
  );
}

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
  if (!me) return <Splash />;
  const used = me.conversations_this_month, limit = me.limits.monthly_conversations;
  const on = (href: string) => path === href || path.startsWith(href + "/");
  const signOut = async (e: React.MouseEvent) => { e.preventDefault(); await supabase.auth.signOut(); router.replace("/login"); };

  return (
    <MeCtx.Provider value={{ me, refresh }}>
      <div className="shell">
        <nav className="side" aria-label="Main">
          <Link href="/dashboard" className="brand"><Mark />Corella</Link>
          {NAV.map(([href, label, , Icon]) => (
            <Link key={href} href={href} className={`nav ${on(href) ? "on" : ""}`} aria-current={on(href) ? "page" : undefined}><Icon />{label}</Link>
          ))}
          <div style={{ flex: 1 }} />
          <div className="workspace">
            <b title={me.organization.name}>{me.organization.name}</b>
            <span className="plan">{me.organization.plan === "trial" ? "Free" : me.organization.plan}</span> plan
            <div className="meter"><span style={{ width: `${Math.min(100, (100 * used) / Math.max(limit, 1))}%` }} /></div>
            {used.toLocaleString("en-IN")} of {limit.toLocaleString("en-IN")} conversations this month
          </div>
          <InstallApp className="nav" />
          <a className="nav" href="#" onClick={signOut}><IconOut />Sign out</a>
        </nav>
        <header className="topbar">
          <Link href="/dashboard" className="brand" style={{ fontSize: 18 }}><Mark size={26} />Corella</Link>
          <div className="row" style={{ gap: 6 }}>
            <InstallApp className="btn ghost" />
            <a className="btn ghost" href="#" onClick={signOut} aria-label="Sign out"><IconOut /></a>
          </div>
        </header>
        <main className="main">{children}</main>
        <nav className="tabbar" aria-label="Main">
          {NAV.map(([href, , short, Icon]) => (
            <Link key={href} href={href} className={on(href) ? "on" : ""} aria-current={on(href) ? "page" : undefined}><Icon size={22} />{short}</Link>
          ))}
        </nav>
      </div>
    </MeCtx.Provider>
  );
}
