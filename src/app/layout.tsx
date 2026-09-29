import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "ECDAT Atlas · Find the cryptography quantum computers will break",
    template: "%s · ECDAT Atlas",
  },
  description:
    "ECDAT Atlas finds every algorithm, key and certificate in your code and cloud, shows which ones quantum computers will break, and tells you what to move to first.",
  keywords: ["cryptography", "PQC", "CBOM", "quantum readiness", "NTRO", "security"],
};

export const viewport: Viewport = {
  themeColor: "#1f2126",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
