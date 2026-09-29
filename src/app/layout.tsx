import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECDAT Atlas — Enterprise Cryptographic Discovery & Analysis Tool",
  description:
    "Continuous cryptographic discovery, PQC readiness scoring, and CycloneDX CBOM generation for your GitHub repositories.",
  keywords: ["cryptography", "PQC", "CBOM", "quantum readiness", "NTRO", "security"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
