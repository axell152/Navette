import fs from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPages } from "../lib/pdfText";
import { parseNavettePages } from "../lib/navette";

async function main() {
  for (const f of process.argv.slice(2)) {
    const data = new Uint8Array(fs.readFileSync(f));
    const doc = await getDocument({ data, isEvalSupported: false }).promise;
    const lignes = parseNavettePages(await extractPages(doc));
    console.log(f, "->", lignes.length, "lignes, total", lignes.reduce((s, l) => s + l.qte, 0));
    if (process.env.SHOW) console.log(lignes.map((l) => `${l.page}:${l.ref}=${l.qte}`).join(" "));
  }
}
main();
