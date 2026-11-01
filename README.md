# Carnet SGM — Registre de présence

PWA de pointage (présence / absence), statistiques, rapports PDF et module Bureau.
Vanilla JS, sans build : on déploie tel quel sur **GitHub Pages**.
Données : IndexedDB en local + synchronisation Supabase (auth, temps réel).

## Structure

```
index.html            Coquille HTML : charge les CSS puis les scripts (dans l'ordre)
manifest.json         Identité PWA
sw.js                 Service Worker (cache hors-ligne)
icon-*.png …          Icônes (à la racine, ne pas déplacer : manifest + iOS)

css/                  Chargés dans l'ordre = ordre de la cascade
  base → splash → layout → components → member-info → pointage
  → floating → onboarding → import-tables → responsive → supervision → comptes

js/
  config.js           URL + clé Supabase  ← seul fichier à modifier pour changer de projet
  core/               Briques sans logique métier : icons, utils, ui (toast…), pdf-logo
  data/               db (IndexedDB) · sync (Supabase) · state · stats · bureau-stats · reconcile
  services/           Exports : export-members (Excel/PDF), report-pdf, bureau-pdf
  components/         Modales : confirm, fiche membre, compléter infos, renommer, fiche Bureau
  views/              Un fichier par écran : shell (routeur) · onboarding · dashboard · pointage
                      · membres · import · rapports · supervision · comptes · bureau · auth
  pwa/                install (invite d'installation) · service-worker (enregistrement)
  main.js             Démarrage (startApp + init) — toujours chargé en dernier
```

## Règles du jeu

- **Scripts classiques, pas de modules ES** : tous les fichiers partagent la portée globale
  (`state`, `render()`, `saveData()`…). Résultat : aucun `import/export` à gérer, et le code
  existant fonctionne tel quel. **L'ordre des `<script>` dans `index.html` compte.**
- Convention d'un écran : `renderXxx()` (retourne le HTML) + `attachXxxEvents()` (branche les
  événements), dans le même fichier de `views/`.
- Dans **Membres**, l'export de la base permet de combiner recherche et filtres, de trier les
  résultats et de produire un classeur Excel avec la liste détaillée et une synthèse par catégorie
  et statut d'activité. Les présidents peuvent aussi rechercher et filtrer les membres de leur
  portée autorisée, sans accès aux programmes hors de cette portée.
- Pas de `confirm()` / `prompt()` natifs (ignorés sur PWA iOS installée) : utiliser
  `openConfirm()` de `components/confirm-modal.js`.

## Ajouter un fichier

1. Créer le fichier dans le bon dossier.
2. L'ajouter dans `index.html` (au bon endroit de l'ordre de chargement).
3. L'ajouter dans `CORE_ASSETS` de `sw.js`.

## Déployer

À **chaque déploiement**, incrémenter `CACHE_NAME` dans `sw.js` (`carnet-sgm-v19` → `carnet-sgm-v20`…).
Le code de l'app (page, `css/`, `js/`) est servi en *network-first* : une mise à jour est donc
prise dès qu'on est en ligne, avec repli sur le cache hors-ligne.

Après une modification du schéma Supabase, réexécuter `supabase-setup.sql` dans le SQL Editor
du projet avant de déployer l'application. Le script est rejouable et ajoute notamment la
protection contre l'enregistrement de deux pointages identiques pour une même séance.

## Continuité hors-ligne et expiration de session

`getSupabaseUser()` (dans `js/data/sync.js`) borne la vérification de session
à 4 secondes. Si une session est expirée ou indisponible, l'app utilise les
données locales et le rôle du dernier compte vérifié au lieu de renvoyer
l'utilisateur à l'écran de connexion. Les changements restent locaux et
seront synchronisés quand une session valide sera de nouveau disponible.

Les présidents sans portée globale restent soumis à la règle existante :
leurs données de portée ne sont pas affichées hors ligne et doivent être
rechargées après reconnexion. Lorsqu'aucune donnée locale ni aucun compte
vérifié hors ligne n'existe, l'écran de connexion reste requis.

## Sécurité

La clé `sb_publishable_…` de `js/config.js` est faite pour être publique ; ce qui protège les
données, ce sont les **politiques RLS** Supabase (à garder activées sur toutes les tables).

### Rôles CA et président

Avant de déployer les écrans de rôles, appliquer dans le SQL Editor Supabase la migration de
rôles fournie séparément à l’administrateur du projet. Elle ajoute les rôles, les portées de
programme, le profil des nouveaux comptes et les politiques RLS qui interdisent les écritures
présidentielles côté serveur. Elle remplace les politiques existantes sur les tables utilisées
par l’application : vérifier les politiques personnalisées du projet avant de l’exécuter. Si
les tables de l’application ne sont pas encore installées, exécuter d’abord `supabase-setup.sql`
et `bureau-setup.sql`.

Les nouveaux comptes créés par inscription restent en attente jusqu’à ce qu’un administrateur
CA leur attribue un rôle. Le compte désigné dans la migration reçoit automatiquement le rôle de
premier gestionnaire CA dès que son adresse est confirmée ; il n’y a pas de requête de bootstrap
à lancer séparément. Les administrateurs CA peuvent ensuite gérer les rôles, les gestionnaires
et les portées dans l’onglet **Comptes**.

Le CA dispose de tous les droits. Le président ne voit que les onglets de consultation autorisés
(tableau de bord, membres, rapports, supervision et Bureau) ; les écrans de pointage et de gestion
des comptes, ainsi que les commandes de modification, ne sont pas affichés. Les programmes
présentés dans les fiches et rapports restent limités à sa portée. Il peut générer un rapport PDF
signé « Collège des présidents ».
Cette page présente les tendances, les taux par catégorie, les fréquences par lieu et des
comparaisons descriptives programme/lieu ; ces comparaisons ne démontrent pas de causalité.

Le masquage de l’interface améliore la séparation des usages mais ne constitue pas une barrière
de sécurité : les politiques RLS de la migration restent la source d’autorisation côté serveur.
Après une consultation en ligne, la copie locale est remplacée par les données renvoyées dans la
portée autorisée. Hors ligne, un président sans portée globale ne voit aucune donnée et le cache
local de données est vidé ; la révocation d’un rôle ou d’une portée nécessite toutefois une
reconnexion pour être connue de l’appareil.
