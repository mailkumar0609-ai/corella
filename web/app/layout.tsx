import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-text", display: "swap" });

const TITLE = "Corella — Testing platform for AI voice & chat agents";
const DESCRIPTION = "Test your AI agents before your customers do. Corella simulates real conversations, finds failures, and fixes them automatically with a self-improving loop.";
const OG_IMAGE = { url: "https://corella.live/og-image.png", secureUrl: "https://corella.live/og-image.png", type: "image/png", width: 1200, height: 630,
  alt: "Corella: Test your AI agents before your customers do. corella.live" };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://corella.live"),
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://corella.live", type: "website",
    siteName: "Corella", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
  applicationName: "Corella",
  appleWebApp: { capable: true, title: "Corella", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#141a36",
  width: "device-width", initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${display.variable} ${text.variable}`}><body>{children}</body></html>;
}
