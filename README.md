# Besoin de stock

Dépose le stock CEGID (.xlsx ou .csv) et les navettes (bons de préparation PDF) : le tableau ne montre que les
références encore en besoin après réception des navettes.

- Périmètre : `Stock d'alerte > 0` et `Q. disponible < Stock d'alerte` (comme la feuille BESOIN).
- `Quantité nécessaire = Seuil mini − Dispo − Attendu navettes`. Les références couvertes par les navettes se
  réaffichent avec la case à cocher.
- Le détail de chaque ligne de navette est affiché (fichier, page, quantité) ; rien n'est masqué. Une référence
  présente sur plusieurs lignes est signalée « plusieurs lignes » et ses quantités sont additionnées pour le calcul.
- Tout tourne dans le navigateur : aucun fichier n'est envoyé nulle part.

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:3000
```

## Déployer (GitHub + Vercel)

1. Pousse le dossier sur un dépôt GitHub.
2. Sur vercel.com : *Add New… → Project*, choisis le dépôt. Next.js est détecté tout seul, aucune variable d'environnement.
3. *Deploy*. Chaque `git push` redéploie.

## Fichiers utiles

- `lib/navette.ts` : lecture d'un bon de préparation ABCD par positions (colonne « Code » à gauche, colonne « Qté à livr. »).
  Si un autre modèle de bon apparaît, c'est ici qu'on ajuste.
- `lib/stock.ts` : lecture du stock. Détecte les colonnes par leur nom (Article, Libellé, Q. disponible,
  Q. réservée, Stock d'alerte, Neg) ; xlsx : onglet `STOCK` en priorité, sinon le premier onglet avec une colonne « Article ».
  CSV : séparateur `;`, encodage UTF-8 ou CP850 (`lib/cp850.ts`).
- `lib/besoin.ts` : calcul du besoin.
- `public/pdf.worker.min.mjs` : worker pdfjs, recopié à chaque `npm install` (`scripts/copy-worker.mjs`).
- `npm run test:pdf -- fichier.pdf` : affiche les lignes lues dans une navette.

Limites : PDF texte uniquement (pas de scan) ; le calcul suppose que le stock déposé est celui du dépôt qui reçoit les navettes.
