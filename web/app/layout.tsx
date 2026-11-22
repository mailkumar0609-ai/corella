import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: "Corella | Test your AI agent before your customers do",
  description: "Automated testing for AI chat agents in 13 Indian languages: Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi, Gujarati and more.",
  metadataBase: new URL("https://corella.live"),
  applicationName: "Corella",
  appleWebApp: { capable: true, title: "Corella", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f4f8" }, { media: "(prefers-color-scheme: dark)", color: "#0d1124" }],
  width: "device-width", initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${display.variable} ${text.variable}`}><body>{children}</body></html>;
}
