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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = document.cookie.split('; ').find(function(r){ return r.startsWith('theme='); });
                var theme = t ? t.split('=')[1] : 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
