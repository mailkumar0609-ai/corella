import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corella | Test your AI agent before your customers do",
  description: "Automated testing for Hindi, Hinglish and Indian-language voice and chat AI agents.",
  metadataBase: new URL("https://corella.live"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
