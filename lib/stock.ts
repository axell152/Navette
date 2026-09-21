import * as XLSX from "xlsx";
import { decodeText } from "./cp850";

export type StockRow = { ref: string; libelle: string; dispo: number; seuil: number; reserve: number; neg: string };

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const ALIASES: Record<string, string[]> = {
  ref: ["article", "reference", "ref", "code"],
  libelle: ["libelle", "designation"],
  dispo: ["qdisponible", "disponible", "dispo"],
  seuil: ["stockdalerte", "seuilmini", "seuil"],
  reserve: ["qreservee", "reservee", "reserve"],
  neg: ["neg"],
};

export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[\s\u00a0]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// CSV avec séparateur ";" (ou ","), guillemets gérés
function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

function rowsFromXlsx(buf: ArrayBuffer): { rows: unknown[][]; sheet: string } {
  const wb = XLSX.read(buf, { type: "array" });
  // On préfère l'onglet STOCK, sinon le premier onglet qui contient une colonne "Article"
  const names = [...wb.SheetNames].sort((a, b) => (norm(b) === "stock" ? 1 : 0) - (norm(a) === "stock" ? 1 : 0));
  for (const name of names) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" });
    if (rows.slice(0, 10).some((r) => r.some((c) => norm(c) === "article"))) return { rows, sheet: name };
  }
  throw new Error('Aucun onglet avec une colonne "Article" trouvé dans ce classeur.');
}

export function parseStock(buf: ArrayBuffer, fileName: string): { rows: StockRow[]; source: string } {
  const isCsv = /\.(csv|txt)$/i.test(fileName);
  let table: unknown[][];
  let source = fileName;
  if (isCsv) table = parseCsv(decodeText(new Uint8Array(buf)));
  else {
    const r = rowsFromXlsx(buf);
    table = r.rows;
    source = `${fileName} (onglet ${r.sheet})`;
  }

  const hIdx = table.findIndex((r) => r.some((c) => norm(c) === "article"));
  if (hIdx < 0) throw new Error('Colonne "Article" introuvable.');
  const headers = table[hIdx].map(norm);
  const col: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) col[key] = headers.findIndex((h) => names.includes(h));
  const missing = ["ref", "dispo", "seuil"].filter((k) => col[k] < 0);
  if (missing.length)
    throw new Error(`Colonnes introuvables : ${missing.map((k) => ({ ref: "Article", dispo: "Q. disponible", seuil: "Stock d'alerte" } as Record<string, string>)[k]).join(", ")}.`);

  const rows: StockRow[] = [];
  for (const r of table.slice(hIdx + 1)) {
    const ref = String(r[col.ref] ?? "").trim().toUpperCase();
    if (!ref) continue;
    rows.push({
      ref,
      libelle: col.libelle >= 0 ? String(r[col.libelle] ?? "").trim() : "",
      dispo: toNumber(r[col.dispo]),
      seuil: toNumber(r[col.seuil]),
      reserve: col.reserve >= 0 ? toNumber(r[col.reserve]) : 0,
      neg: col.neg >= 0 ? String(r[col.neg] ?? "").trim().toUpperCase() : "",
    });
  }
  return { rows, source };
}
