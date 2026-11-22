"use client";
import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install app" button: native prompt on Chrome/Edge/Android, Add-to-Home-Screen hint on iPhone. */
export default function InstallApp({ className = "btn" }: { className?: string }) {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hint, setHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (standalone) { setInstalled(true); return; }
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const on = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); };
    const done = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed || (!evt && !ios)) return null;
  return (
    <span style={{ position: "relative" }}>
      <button type="button" className={className} onClick={async () => {
        if (evt) { await evt.prompt(); await evt.userChoice; setEvt(null); } else setHint(!hint);
      }}>Install app</button>
      {hint && (
        <span className="card" style={{ position: "absolute", right: 0, top: "110%", width: 240, zIndex: 20, fontSize: 13 }}>
          On iPhone: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
        </span>)}
    </span>
  );
}
