import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corella | Test your AI agent before your customers do",
  description: "Automated testing for AI chat agents in 13 Indian languages: Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi, Gujarati and more.",
  metadataBase: new URL("https://corella.live"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
