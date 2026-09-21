import type { PageText } from "./navette";

// Extrait les mots + positions d'un document pdfjs (déjà chargé) — utilisé dans le navigateur et dans les tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractPages(doc: any): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((it: any) => typeof it.str === "string")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number, w: (it.width as number) || 0 }));
    pages.push({ width: view.width, items });
  }
  return pages;
}
