import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corella | Test your AI agent before your customers do",
  description: "Automated testing for AI chat agents in 13 Indian languages: Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi, Gujarati and more.",
  metadataBase: new URL("https://corella.live"),
  applicationName: "Corella",
  appleWebApp: { capable: true, title: "Corella", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f7f6f2" }, { media: "(prefers-color-scheme: dark)", color: "#121316" }],
  width: "device-width", initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
