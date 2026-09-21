import type { LigneNavette } from "./navette";
import type { StockRow } from "./stock";

export type Navette = { fichier: string; lignes: LigneNavette[] };
export type DetailNavette = { fichier: string; page: number; qte: number };
export type BesoinRow = StockRow & {
  attendu: number; // total des navettes pour cette référence
  details: DetailNavette[]; // chaque ligne de navette, jamais fusionnée
  doublon: boolean; // la référence apparaît sur plusieurs lignes de navette
  besoin: number; // seuil - dispo - attendu  (> 0 : encore en besoin après navettes)
};

// Périmètre identique à la feuille BESOIN : seuil > 0 et dispo < seuil.
// besoin > 0  => toujours en besoin après réception des navettes ; sinon => couvert par les navettes.
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

  const rows: BesoinRow[] = stock
    .filter((s) => s.seuil > 0 && s.dispo < s.seuil)
    .map((s) => {
      const details = parRef.get(s.ref) ?? [];
      const attendu = details.reduce((t, d) => t + d.qte, 0);
      return { ...s, attendu, details, doublon: details.length > 1, besoin: s.seuil - s.dispo - attendu };
    })
    .sort((a, b) => b.besoin - a.besoin || a.ref.localeCompare(b.ref));

  return { rows, inconnues };
}
