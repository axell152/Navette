"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parseStock, type StockRow } from "@/lib/stock";
import { parseNavettePages } from "@/lib/navette";
import { extractPages } from "@/lib/pdfText";
import { computeBesoin, type BesoinRow, type Navette, type Statut } from "@/lib/besoin";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const court = (f: string) => f.replace(/\.pdf$/i, "");

async function lirePdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return parseNavettePages(await extractPages(doc));
}

function Zone(props: { titre: string; aide: string; accept: string; multiple?: boolean; onFiles: (f: File[]) => void; children?: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <div
        className={`zone${over ? " over" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); props.onFiles(Array.from(e.dataTransfer.files)); }}
      >
        <strong>{props.titre}</strong>
        <span>{props.aide}</span>
        <input ref={input} type="file" hidden accept={props.accept} multiple={props.multiple}
          onChange={(e) => { props.onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
      {props.children}
    </div>
  );
}

type SortKey = "ordre" | "ref" | "libelle" | "dispo" | "seuil" | "reserve" | "neg" | "attendu" | "besoin";

export default function Page() {
  const [stock, setStock] = useState<{ rows: StockRow[]; source: string } | null>(null);
  const [navettes, setNavettes] = useState<Navette[]>([]);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [negSel, setNegSel] = useState<string[]>([]);
  const [statutSel, setStatutSel] = useState<Statut[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "ordre", dir: 1 });

  async function onStock(files: File[]) {
    const f = files[0];
    if (!f) return;
    try {
      setStock(parseStock(await f.arrayBuffer(), f.name));
      setErreurs((e) => e.filter((x) => !x.startsWith("Stock")));
    } catch (e) {
      setErreurs((x) => [...x, `Stock « ${f.name} » : ${(e as Error).message}`]);
    }
  }

  async function onPdfs(files: File[]) {
    for (const f of files.filter((x) => /\.pdf$/i.test(x.name))) {
      try {
        const lignes = await lirePdf(f);
        setNavettes((n) => [...n.filter((x) => x.fichier !== f.name), { fichier: f.name, lignes }]);
      } catch (e) {
        setErreurs((x) => [...x, `PDF « ${f.name} » illisible : ${(e as Error).message}`]);
      }
    }
  }

  const { rows, inconnues } = useMemo(() => (stock ? computeBesoin(stock.rows, navettes) : { rows: [] as BesoinRow[], inconnues: [] }), [stock, navettes]);
  const negs = useMemo(() => [...new Set(rows.map((r) => r.neg).filter(Boolean))].sort(), [rows]);

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(
      (r) => (!statutSel.length || statutSel.includes(r.statut)) && (!negSel.length || negSel.includes(r.neg)) && (!needle || r.ref.toLowerCase().includes(needle) || r.libelle.toLowerCase().includes(needle))
    );
    return list.sort((a, b) => {
      if (sort.key === "ordre") {
        // ordre des PDF ; les références absentes des navettes viennent après, par plus gros besoin
        const c = ((a.ordre ?? 1e9) - (b.ordre ?? 1e9)) * sort.dir;
        return c || b.besoin - a.besoin || a.ref.localeCompare(b.ref);
      }
      const x = a[sort.key], y = b[sort.key];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr");
      return c * sort.dir || a.ref.localeCompare(b.ref);
    });
  }, [rows, q, negSel, statutSel, sort]);

  const nb = (s: Statut) => rows.filter((r) => r.statut === s).length;
  const libStatut = (r: BesoinRow) => (r.statut === "besoin" ? fmt(r.besoin) : r.statut === "couvert" ? "couvert" : "pas de besoin");
  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cls} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "besoin" || key === "attendu" ? -1 : 1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  const detail = (r: BesoinRow) => r.details.map((d) => `${court(d.fichier)} p.${d.page} : ${d.qte}`);

  function exporter() {
    const aoa = [
      ["Article", "Libellé", "Dispo", "Seuil mini", "Reservé", "NEG", "Attendu navettes", "Quantité nécessaire", "Statut", "Détail navettes"],
      ...visibles.map((r) => [r.ref, r.libelle, r.dispo, r.seuil, r.reserve, r.neg, r.attendu, r.statut === "besoin" ? r.besoin : 0, r.statut === "besoin" ? "En besoin" : r.statut === "couvert" ? "Couvert par les navettes" : "Pas de besoin", detail(r).join(" | ")]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 16 }, { wch: 70 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BESOIN");
    XLSX.writeFile(wb, "besoin_stock.xlsx");
  }

  const sansLigne = navettes.filter((n) => n.lignes.length === 0);

  return (
    <main>
      <h1>Prévisualisation du Stock d'Avant Navette</h1>
      <p className="sub">
  Dépose le stock extrait de CEGID et les navettes PDF envoyées par les services.
  <br />
  <br />
  <strong>En bleu :</strong> les produits prévus qui ne sont pas sous leur seuil minimum.
  <br />
  <strong>En vert :</strong> les produits qui sont sous leur seuil minimum, mais qui sont couverts par le réapprovisionnement prévu dans la navette.
  <br />
  <strong>En rouge :</strong> les produits qui sont sous leur seuil minimum et qui ne sont pas, ou pas suffisamment, réapprovisionnés.
</p>

      <div className="zones">
        <Zone titre="1. Stock CEGID" aide="Glisse le fichier .xlsx (ou .csv) ou clique ici" accept=".xlsx,.xls,.csv,.txt" onFiles={onStock}>
          {stock && (
            <div className="files"><div><span className="ok">✓ {stock.source} — {stock.rows.length} articles</span></div></div>
          )}
        </Zone>
        <Zone titre="2. Navettes (PDF)" aide="Glisse un ou plusieurs bons de préparation .pdf" accept=".pdf" multiple onFiles={onPdfs}>
          {navettes.length > 0 && (
            <div className="files">
              {navettes.map((n) => (
                <div key={n.fichier}>
                  <span className={n.lignes.length ? "ok" : ""}>{n.lignes.length ? "✓" : "⚠"} {court(n.fichier)} — {n.lignes.length} lignes, {fmt(n.lignes.reduce((t, l) => t + l.qte, 0))} pièces</span>
                  <button onClick={() => setNavettes((x) => x.filter((y) => y.fichier !== n.fichier))}>retirer</button>
                </div>
              ))}
            </div>
          )}
        </Zone>
      </div>

      {erreurs.map((e, i) => <div key={i} className="warn err">{e}</div>)}
      {sansLigne.length > 0 && (
        <div className="warn">Aucune ligne lue dans : {sansLigne.map((n) => court(n.fichier)).join(", ")}. Ce n&apos;est peut-être pas un bon de préparation ABCD, ou le PDF est un scan.</div>
      )}
      {inconnues.length > 0 && (
        <div className="warn">
          {inconnues.length} référence(s) de navette absente(s) du stock : {inconnues.slice(0, 12).map((i) => i.ref).join(", ")}{inconnues.length > 12 ? "…" : ""}
        </div>
      )}

      {stock && (
        <>
          <div className="bar">
            <input type="search" placeholder="Rechercher article ou libellé" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="chips">
              <b>NEG</b>
              {negs.map((n) => (
                <button key={n} className={`chip${negSel.includes(n) ? " on" : ""}`} onClick={() => setNegSel((s) => toggle(s, n))}>
                  {n} ({rows.filter((r) => r.neg === n).length})
                </button>
              ))}
            </div>
            {(negSel.length > 0 || statutSel.length > 0) && (
              <button className="lien" onClick={() => { setNegSel([]); setStatutSel([]); }}>Tout afficher</button>
            )}
            <span className="count">{visibles.length} référence(s)</span>
            <button className="btn" disabled={!visibles.length} onClick={exporter}>Exporter en Excel</button>
          </div>

          <div className="legende">
            <button className={`chip rouge${statutSel.includes("besoin") ? " on" : ""}`} onClick={() => setStatutSel((s) => toggle(s, "besoin"))}>
              Sous le seuil après réappro ({nb("besoin")})
            </button>
            <button className={`chip vert${statutSel.includes("couvert") ? " on" : ""}`} onClick={() => setStatutSel((s) => toggle(s, "couvert"))}>
              Au-dessus du seuil après réappro ({nb("couvert")})
            </button>
            <button className={`chip bleu${statutSel.includes("hors") ? " on" : ""}`} onClick={() => setStatutSel((s) => toggle(s, "hors"))}>
              Réappro sans besoin ({nb("hors")})
            </button>
          </div>

          <div className="tablewrap">
            {visibles.length === 0 ? (
              <div className="vide">{rows.length ? "Aucune référence avec ces filtres." : "Aucune référence sous le seuil ni dans une navette."}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {th("ordre", "#")}{th("ref", "Article")}{th("libelle", "Libellé")}{th("dispo", "Dispo")}{th("seuil", "Seuil mini")}
                    {th("reserve", "Reservé")}{th("neg", "NEG")}{th("attendu", "Attendu navettes")}{th("besoin", "Quantité nécessaire", "q")}
                    <th style={{ cursor: "default" }}>Détail navettes</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.ref} className={`s-${r.statut}`}>
                      <td className="c det">{r.ordre ?? ""}</td>
                      <td>{r.ref}</td>
                      <td>{r.libelle}</td>
                      <td className="n">{fmt(r.dispo)}</td>
                      <td className="n">{fmt(r.seuil)}</td>
                      <td className="n">{fmt(r.reserve)}</td>
                      <td className="c">{r.neg}</td>
                      <td className="n">{r.attendu ? fmt(r.attendu) : ""}</td>
                      <td className="q">{libStatut(r)}</td>
                      <td className="det">
                        {detail(r).map((d, i) => <div key={i}>{d}</div>)}
                        {r.doublon && <span className="tag">plusieurs lignes</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
