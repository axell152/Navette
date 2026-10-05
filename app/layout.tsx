import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const corps = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-corps", display: "swap" });
const titre = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-titre", display: "swap" });

export const metadata: Metadata = {
  title: "Besoin de stock",
  description: "Stock CEGID + navettes (PDF) → références en besoin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${corps.variable} ${titre.variable}`}>
      <body>{children}</body>
    </html>
  );
}
