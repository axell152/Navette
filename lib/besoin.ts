import type { LigneNavette } from "./navette";
import type { StockRow } from "./stock";

export type Navette = { fichier: string; lignes: LigneNavette[] };
export type DetailNavette = { fichier: string; page: number; qte: number };
export type Statut = "besoin" | "couvert" | "hors";
export type BesoinRow = StockRow & {
  attendu: number; // total des navettes pour cette référence
  details: DetailNavette[]; // chaque ligne de navette, jamais fusionnée
  doublon: boolean; // la référence apparaît sur plusieurs lignes de navette
  besoin: number; // seuil - dispo - attendu  (> 0 : encore en besoin après navettes)
  statut: Statut; // besoin = sous le seuil et pas couvert ; couvert = sous le seuil mais couvert par les navettes ;
  //                 hors = pas sous le seuil, présent dans une navette
};

// Lignes affichées : les références sous le seuil (critère de la feuille BESOIN : seuil > 0 et dispo < seuil)
// ET toutes celles qui figurent dans une navette, même sans besoin.
export function computeBesoin(stock: StockRow[], navettes: Navette[]) {
  const parRef = new Map<string, DetailNavette[]>();
  for (const n of navettes)
    for (const l of n.lignes) {
      const arr = parRef.get(l.ref) ?? [];
      arr.push({ fichier: n.fichier, page: l.page, qte: l.qte });
      parRef.set(l.ref, arr);
    }

  const connus = new Set(stock.map((s) => s.ref));
  const inconnues = [...parRef.entries()].filter(([ref]) => !connus.has(ref)).map(([ref, d]) => ({ ref, details: d }));

  const rows: BesoinRow[] = [];
  for (const s of stock) {
    const sousSeuil = s.seuil > 0 && s.dispo < s.seuil;
    const details = parRef.get(s.ref) ?? [];
    if (!sousSeuil && details.length === 0) continue;
    const attendu = details.reduce((t, d) => t + d.qte, 0);
    const besoin = s.seuil - s.dispo - attendu;
    const statut: Statut = !sousSeuil ? "hors" : besoin > 0 ? "besoin" : "couvert";
    rows.push({ ...s, attendu, details, doublon: details.length > 1, besoin, statut });
  }
  rows.sort((a, b) => b.besoin - a.besoin || a.ref.localeCompare(b.ref));

  return { rows, inconnues };
}
