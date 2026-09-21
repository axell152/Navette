// Lecture d'un "Bon de préparation" ABCD (navette) à partir des positions du texte du PDF.
// Ce n'est pas un vrai tableau : on repère la colonne "Code" (à gauche) et la colonne
// "Qté à livr." grâce à leurs en-têtes, puis on associe chaque code à la quantité de sa ligne.
// Les lignes sans code (BA/CSA, retour laquage...) sont ignorées. Rien n'est fusionné ici.

export type TextItem = { str: string; x: number; y: number; w: number };
export type PageText = { width: number; items: TextItem[] };
export type LigneNavette = { ref: string; qte: number; page: number };

const CODE_RE = /^[A-Z][A-Z0-9+\-./]{3,}$/;
const clean = (s: string) => s.replace(/[\s\u00a0]/g, "");

export function parseNavettePages(pages: PageText[]): LigneNavette[] {
  const out: LigneNavette[] = [];
  pages.forEach((page, idx) => {
    const items = page.items.filter((i) => i.str.trim() !== "");

    // En-têtes : "Code" (colonne de gauche) et "Qté à livr."
    const head = items.find((i) => i.str.trim() === "Code" && i.x < page.width * 0.15);
    if (!head) return; // page sans tableau
    const rowItems = items.filter((i) => Math.abs(i.y - head.y) < 3);
    const qteLeft = rowItems.find((i) => /^Qt[ée]/.test(i.str.trim()));
    const qteRight = rowItems.find((i) => /livr/.test(i.str));
    if (!qteLeft || !qteRight) return;
    const xMin = qteLeft.x - 4;
    const xMax = qteRight.x + qteRight.w + 6;
    const codeMax = page.width * 0.121;

    // Bas du tableau : "PLAN CLIENT :" (sinon bas de page)
    const foot = items.filter((i) => /PLAN\s+CLIENT/.test(i.str) && i.x > page.width * 0.5);
    const yBottom = foot.length ? Math.max(...foot.map((i) => i.y)) : 0;
    const inTable = (i: TextItem) => i.y < head.y - 4 && i.y > yBottom;

    const codes = items.filter((i) => inTable(i) && i.x < codeMax && CODE_RE.test(i.str.trim()));
    const qtes = items.filter(
      (i) => inTable(i) && i.x >= xMin && i.x + i.w <= xMax + 2 && /^\d+$/.test(clean(i.str))
    );

    for (const c of codes) {
      const mine = qtes.filter((q) => Math.abs(q.y - c.y) <= 6).sort((a, b) => a.x - b.x);
      if (!mine.length) continue;
      out.push({ ref: c.str.trim().toUpperCase(), qte: Number(mine.map((q) => clean(q.str)).join("")), page: idx + 1 });
    }
  });
  return out;
}
