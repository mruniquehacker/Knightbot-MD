# AvisFlash : site statique

Micro-SaaS pour aider les commerces locaux à obtenir plus d'avis Google.

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil (offre, démo, tarifs, FAQ) |
| `creer.html` | Le commerçant crée son lien et son QR code |
| `affiche.html` | Affiche A5 à imprimer (QR code, couleur, logo), exportable en PDF |
| `avis.html` | La page que voit le client (note, puis Google ou retour privé sur WhatsApp) |

Aucun serveur ni base de données : toute la configuration du commerce est dans l'URL
(`avis.html?n=Nom&g=<lien Google>&w=<numéro WhatsApp>`).

## Tester en local

```bash
cd site-avis && python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mise en ligne

**GitHub Pages** (le workflow `.github/workflows/deploy-site-avis.yml` est déjà prêt) :
1. Fusionner cette branche dans `main`.
2. Sur GitHub, aller dans Settings → Pages → Source : **GitHub Actions**.
3. Le site est publié à l'adresse `https://<utilisateur>.github.io/<dépôt>/`.

**Netlify ou Vercel** (au choix) : importer le dépôt et indiquer `site-avis` comme dossier
à publier (aucune commande de build).

## Conformité

Le bouton Google est proposé à **tous** les clients, même ceux qui donnent une mauvaise note.
Les règles de Google, comme la loi dans certains pays, interdisent de filtrer les avis négatifs
(« review gating »).
