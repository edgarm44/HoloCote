# HoloCote

Site de fan non officiel : cote et rareté des cartes à collectionner Pokémon, scanner gratuit, collection privée.

- Site 100 % statique ([Astro](https://astro.build)), hébergé sur GitHub Pages.
- Données et images : API publique [TCGdex](https://tcgdex.dev), appelée depuis le navigateur. Aucune image n'est copiée dans ce dépôt.
- Scanner : OCR dans le navigateur avec Tesseract.js ; la photo ne quitte jamais l'appareil.
- Collection : stockée dans le navigateur (localStorage), export / import en fichier JSON.

## Développement

```bash
npm install
npm run dev      # http://localhost:4321/HoloCote/
npm run build    # génère dist/
```

## Déploiement

1. Sur GitHub : Settings > Pages > Build and deployment > Source : **GitHub Actions**.
2. Chaque push sur `main` déclenche `.github/workflows/deploy.yml`.
3. Le site est publié sur https://edgarm44.github.io/HoloCote/

## À compléter avant publication

- Activer les Issues du dépôt (Settings > General > Features > Issues) : elles servent de contact.

## Structure

```
src/
  layouts/Base.astro      en-tête, pied de page (disclaimer)
  pages/                  accueil (recherche), carte, scanner, collection, pages légales
  lib/tcgdex.ts           accès API TCGdex, choix de la cote
  lib/rarity.ts           paliers de rareté, badge de cote
  lib/condition.ts        états de carte et coefficients
  lib/collection.ts       stockage local, export / import
  lib/scan.ts             OCR et recherche des candidats
```

## Cadre légal

Site non commercial : pas de publicité, d'affiliation, de vente ni d'échange entre utilisateurs. Toute demande de retrait d'un titulaire de droits est traitée sans délai via les Issues du dépôt.
