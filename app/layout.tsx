import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Besoin de stock",
  description: "Stock CEGID + navettes (PDF) → références en besoin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
