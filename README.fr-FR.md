# pi-reopen — restaurer les sessions Pi dans WezTerm

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Paquet Pi](https://pi.dev/packages/@ellieyujin/pi-reopen) · [Versions](https://github.com/AuthurX/pi-reopen/releases)

**Rouvrir WezTerm. Restaurez vos sessions Pi, vos répertoires de travail et vos conversations en une seule commande.**

![Pi session recovery preview](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/preview.png)

Une extension et un CLI [Pi](https://github.com/earendil-works/pi) pour la **restauration de sessions après la fermeture du terminal**. Il enregistre les sessions Pi ouvertes et les rouvre en onglets [WezTerm](https://wezterm.org/), en sautant les sessions déjà en cours d'exécution.

## Reprendre une session ou restaurer un espace de travail ?

| Objectif | À utiliser |
| --- | --- |
| Continuer la session la plus récente du répertoire courant | `pi -c` intégré |
| Choisir une conversation passée | `pi -r` ou `/resume` intégré |
| Rouvrir les sessions Pi enregistrées, projet par projet, après la fermeture de WezTerm | `pi-reopen` |
| Prévisualiser le plan de restauration sans ouvrir d'onglets | `pi-reopen restore --dry-run` |

C'est une **restauration de sessions d'espace de travail**, pas un remplacement du sélecteur de sessions de Pi. Il démarre de nouveaux processus Pi avec les fichiers de session d'origine ; il ne restaure pas les outils en cours d'exécution, les états non enregistrés, la géométrie des panneaux divisés ni les programmes shell arbitraires. Quitter Pi délibérément supprime son enregistrement. Le démarrage de WezTerm ne déclenche pas automatiquement la restauration ; exécutez `pi-reopen` après l'avoir rouvert.

## Comment l'utiliser : pensez onglets de navigateur

| Navigateur | pi-reopen |
| --- | --- |
| Onglets encore ouverts à la fermeture | Sessions Pi encore ouvertes quand WezTerm se ferme |
| Les onglets ouverts reviennent au prochain lancement | `pi-reopen` restaure les entrées conservées en nouveaux onglets |
| Les onglets fermés par vous restent hors de la liste de restauration | Un onglet fermé avec `ctrl+w` est oublié par défaut (ou toujours, avec `/quit` dans Pi) |
| « Récemment fermés » via Ctrl+Shift+T | `/reopen recent` — les dernières 24 h, même sans enregistrement |
| Plantage → « Restaurer les pages ? » | Plantage / fermeture de WezTerm entier / arrêt WSL → tous les enregistrements conservés, `pi-reopen` les ramène |

La règle à retenir : **ouvert = conservé, fermé = libéré**. Aucun marqueur ni commande supplémentaire — un onglet laissé ouvert est votre signal « je veux le récupérer », et le fermer signifie « j'en ai terminé ». (Par défaut : fermer un onglet le retire de la liste de restauration, comme un navigateur ; définissez `PI_REOPEN_FORGET_ON_TAB_CLOSE=0` pour toujours conserver les enregistrements.)

## Cas d'usage et prise en charge des plateformes

**Conçu pour travailler sur plusieurs projets dans WezTerm : vous avez plusieurs sessions Pi ouvertes, vous fermez le terminal et vous voulez récupérer les sessions enregistrées avec leurs répertoires de travail et leurs conversations.** Rouvrez WezTerm, puis exécutez `pi-reopen` pour restaurer les sessions en attente dans de nouveaux onglets.

| Environnement d'exécution | Statut de prise en charge | Où les sessions rouvrent |
| --- | --- | --- |
| Linux natif | Implémenté | Nouveaux onglets dans l'instance WezTerm Linux locale |
| macOS natif | Implémenté | Nouveaux onglets dans l'instance WezTerm Mac locale |
| Windows natif | Implémenté | Nouveaux onglets dans l'instance WezTerm Windows locale, exécutant le Pi natif Windows |
| WSL | Implémenté | Nouveaux onglets dans WezTerm Windows, lançant Pi dans la distribution WSL correspondante |
| FreeBSD et autres systèmes | Non pris en charge | Le pré-vol de restauration rejette les plateformes non prises en charge |

**La seule cible de restauration est le WezTerm local.** La restauration dans Windows Terminal, iTerm2, le terminal intégré VS Code ou tmux n'est pas prise en charge. PowerShell, Bash et zsh sont des shells, pas des applications terminal cibles ; exécuter la commande depuis PowerShell nécessite quand même WezTerm ouvert. Windows natif et WSL sont des environnements séparés : une installation d'un côté ne peut pas restaurer les sessions de l'autre. La migration entre machines n'est pas prise en charge.

« Implémenté » signifie qu'un chemin de restauration propre à la plateforme existe, pas que tous les scénarios sur machine réelle ont été vérifiés. Voir [notes de plateforme](docs/PLATFORMS.md) pour la couverture de validation et les limitations.

## Démarrage rapide

`@ellieyujin/pi-reopen` est le seul paquet npm maintenu. La commande CLI reste `pi-reopen`.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

`setup` regroupe les vérifications de la source de l'extension, de la survie de son processus enregistré, du CLI global et du PATH, de l'alignement des versions et des entrées legacy en double. Il affiche les prochaines commandes spécifiques à la plateforme mais n'exécute jamais `sudo`, `setx` ni aucune modification de configuration système.

Exécutez `/reload` dans chaque Pi existant pour qu'il commence à enregistrer. Après avoir fermé et rouvert WezTerm :

```bash
pi-reopen restore --dry-run
pi-reopen
```

Voir [installation et migration](#installation) avant de changer de nom de paquet.

## Prérequis

- **Linux / macOS / Windows natif + WezTerm local**, ou **WSL + WezTerm Windows**
- Node ≥ 22.19, avec [Pi](https://github.com/earendil-works/pi) installé dans le même environnement OS
- Ouvrir WezTerm avant de restaurer ; cet outil ajoute des onglets à une instance en cours d'exécution, pas à un domaine SSH distant
- Linux/macOS/WSL nécessitent Bash. Windows natif nécessite Windows PowerShell 5.1 (y compris CIM) ; installez Git for Windows pour l'outil Bash de Pi, et préférez un nightly WezTerm récent
- La restauration WSL utilise l'utilisateur par défaut de la distribution ; exécutez cet outil en tant que cet utilisateur. Ne partagez pas un registre unique entre Windows natif et WSL

La version 1.0.0 est la première version stable. CI exécute les tests de plateforme sur Linux, macOS et Windows, avec la suite de régression complète, les vérifications du tarball empaqueté et le cycle de vie PTY Pi réel sur Linux ; l'acceptation fermeture/réouverture du GUI macOS/Windows nécessite encore une validation sur machine réelle. Voir [notes de plateforme](docs/PLATFORMS.md).

## Utilisation

```bash
pi-reopen
```

```text
  ✔ pi-workspace: démarré et confirmé (/home/ellie/work/MY/code/pi-workspace)
  ⚠ other-proj: onglet créé, démarrage de pi non confirmé à temps (/home/ellie/work/other-proj)
2 traités
```

La sortie suit la locale : chinois pour `zh_*`, anglais sinon. Forcez avec `PI_REOPEN_LANG=zh|en`.

| Sortie | Signification |
| --- | --- |
| `✔ démarré et confirmé` | démarré et confirmé |
| `⚠ onglet créé, démarrage de pi non confirmé à temps` | onglet créé, mais la confirmation du démarrage de pi a expiré |
| `N traités` | N traités |

Points d'entrée équivalents dans Pi :

- `/reopen` — restaurer les Pis enregistrés
- `/reopen recent` — récupérer depuis l'historique de conversations des dernières 24 h (pour les fenêtres non enregistrées)
- `/reopen clear` — vider le registre (ne supprime pas les fichiers de conversation)
- `Ctrl+Maj+O` — restauration en un clic

`/all` fonctionne toujours comme alias obsolète de `/reopen` (affiche un avis de renommage).

## Commandes

| Commande | Description |
| --- | --- |
| `pi-reopen` (soit `pi-reopen restore`) | Rouvrir les Pis encore ouverts à la dernière fermeture ; les en cours d'exécution sont sautés |
| `pi-reopen restore --dry-run` | Afficher le plan seulement, sans ouvrir d'onglets |
| `pi-reopen restore --no-wait` | Passer l'attente de la confirmation de démarrage de chaque pi |
| `pi-reopen restore --only <motif>` | Ne restaurer que les sessions correspondantes (sous-chaîne, glob `*` ou index de la liste courante ; nom, chemin ou id) |
| `pi-reopen restore --interactive` | Afficher la liste courante et saisir des index pour sélectionner des sessions |
| `pi-reopen restore --limit <N>` | Ouvrir au plus N onglets cette exécution ; le reste est différé à la fois suivante |
| `pi-reopen restore --json` | Sortie lisible par machine |
| `pi-reopen list [--wide\|--json]` | Lister les membres enregistrés et leur statut ; le contenu long est tronqué à la largeur du terminal par défaut |
| `pi-reopen show <index\|id\|préfixe> ...` | Afficher l'état, les chemins, le fichier de session et les détails d'enregistrement |
| `pi-reopen forget <index\|id\|préfixe> ...` | Supprimer des entrées spécifiques (fichiers de conversation intouchés) |
| `pi-reopen prune [--dry-run]` | Supprimer les entrées expirées/irrécoverables (conserve les 14 derniers jours) |
| `pi-reopen setup` | Vérifications guidées de première exécution ; affiche les commandes sans modifier le système |
| `pi-reopen doctor` | Vérification de l'environnement et du registre (identité du processus d'extension, correspondance de versions et détection de fermeture d'onglet unique WSL) |
| `pi-reopen clear` | Vider le registre et les réclamations de démarrage (ne supprime pas les fichiers de conversation ni les entrées au format legacy) |
| `pi-reopen --help` / `--version` | Utilisation / version |

La colonne `#` est un **index dans l'instantané de la liste courante, pas un ID stable**. Chaque commande le résout contre la liste la plus récente dans le même ordre ; après des ajouts, suppressions ou réordonnancement des horodatages, relancez `pi-reopen list`. Une entrée purement numérique est d'abord interprétée comme un index ; les ID de session et les préfixes uniques restent pris en charge.

```bash
pi-reopen list
pi-reopen restore --only 1,3 --dry-run
pi-reopen show 2
pi-reopen forget 2
pi-reopen restore --interactive
```

Statuts de `list` : running (en cours d'exécution) / start claimed (démarrage réclamé) / pending restore (restauration en attente) / expired (expiré) / open in another window (ouvert dans une autre fenêtre) / working directory missing (répertoire de travail manquant) / session file missing (fichier de session manquant) / non correspondante à `--only` / différée par `--limit` / autre plateforme ou distribution / entrée en double.

Codes de sortie : 0 succès ; 1 échec de la demande de restauration ou commande inconnue ; 2 échec du pré-vol de l'environnement ; 3 demandes envoyées mais non confirmées ; 4 seulement des sauts (réclamé/différé).

## Installation

### Depuis npm

Utilisez `@ellieyujin/pi-reopen` avec le dist-tag stable `latest`. Le paquet `pi-reopen` non scopé a été déspublié. Le `pi-workspace` non scopé sur npm est un projet d'un autre auteur.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

- `pi install` enregistre et charge l'extension, mais ne garantit pas que le CLI est dans le PATH d'un shell ordinaire ; `npm install -g` installe le CLI externe (le répertoire bin global npm doit aussi être dans le PATH)
- Le CLI ne dépend pas des paquets peer de Pi, d'où `--omit=peer` pour éviter d'installer aussi l'hôte ; les deux installations doivent être mises à jour séparément et rester à la même version (`pi-reopen setup` / `doctor` signale les dérives)
- `pi install` ne déclare qu'une version peer minimale (`>=1.5.0`), sans borne supérieure : tout Pi plus récent peut être installé directement

**L'enregistrement nécessite l'extension** : installer seulement le CLI ne peut pas enregistrer les sessions. Après l'installation, exécutez `/reload` ou redémarrez dans chaque Pi déjà ouvert ; une installation neuve ne peut pas récupérer précisément les fenêtres précédemment non enregistrées. Ne chargez pas une entrée d'extension locale obsolète (par exemple un vieux symlink `open-all.ts` ou une copie séparée de `pi-reopen`) en même temps que le paquet. `pi-reopen setup` vérifie les sources du paquet et les entrées en double probables dans le répertoire d'extensions personnel ; vérifiez-les avec `pi list`, désactivez seulement les anciennes entrées, et ne supprimez pas les fichiers de session ou d'authentification. `doctor`/`setup` vérifie l'enregistrement de soi par PID, heure de démarrage du processus et boot ID ; une vieille `extension.json` seule ne signifie plus que l'extension tourne actuellement.

### Migration depuis le paquet déspublié

Les utilisateurs de `@ellieyujin/pi-reopen` n'ont pas besoin de changer de nom de paquet. Si vous aviez installé le `pi-reopen` désormais déspublié, retirez-le avant d'installer le paquet maintenu pour éviter le double chargement et les conflits de CLI. Vérifiez `pi list` et retirez l'ancienne source exacte affichée. Pour une installation avec `@latest` :

```bash
pi remove npm:pi-reopen@latest
npm uninstall -g pi-reopen
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
```

Redémarrez Pi, puis exécutez `pi-reopen doctor`. Les fichiers de session et les enregistrements de `~/.pi/agent/pi-reopen/` sont inchangés ; ne les supprimez pas. Les versions du CLI et de l'extension doivent correspondre. Ne combinez pas un lien d'extension locale (par exemple un vieux `open-all.ts` ou un symlink `pi-reopen`) avec le paquet npm.

### Depuis les sources

Les commandes suivantes s'exécutent sur Linux/macOS/WSL et installent les sources actuellement checkoutées :

```bash
git clone https://github.com/AuthurX/pi-reopen.git
cd pi-reopen
pi install .
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/pi-reopen.js" "$HOME/.local/bin/pi-reopen"
export PATH="$HOME/.local/bin:$PATH"
pi-reopen setup
```

Enregistrez la configuration du PATH dans votre fichier de démarrage de shell. Si le symlink du CLI existe déjà, vérifiez d'abord sa cible ; ne l'écrasez pas aveuglément.

Sur Windows natif, depuis le repository checkouté dans PowerShell :

```powershell
pi install .
node .\bin\pi-reopen.js doctor
node .\bin\pi-reopen.js
```

Utilisez `pi.cmd` au lieu de `pi` si la politique d'exécution PowerShell bloque le shim `.ps1` de npm ; aucun changement de politique n'est nécessaire.

Si vous n'avez besoin que de l'extension, vous pouvez aussi installer directement la version Git poussée :

```bash
pi install git:github.com/AuthurX/pi-reopen
```

## Configuration optionnelle

| Variable d'environnement | Rôle |
| --- | --- |
| `PI_REOPEN_WEZTERM` | Chemin absolu du WezTerm local (`wezterm` / `wezterm.exe`) ; sous WSL utilisez son chemin Windows, par ex. `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_REOPEN_PI_BIN` | Chemin absolu de l'exécutable Pi, sans arguments ; Windows accepte le `pi.cmd` npm, l'entrée JS du paquet ou `.exe` ; les alias/fonctions ne sont pas pris en charge |
| `PI_CODING_AGENT_DIR` | Utiliser un autre répertoire de configuration/registre Pi ; le CLI et l'extension doivent rester cohérents |
| `PI_REOPEN_SRC` | Développement uniquement : remplace le répertoire `src/` partagé ; inutile pour les installations de paquet normales |
| `PI_REOPEN_LANG` | Forcer la langue de sortie : `zh` ou `en` (défaut depuis `LC_ALL`/`LANG`) |
| `PI_REOPEN_TERMINAL` | id d'adaptateur terminal ; seul `wezterm` est implémenté (voir [docs/TERMINALS.md](docs/TERMINALS.md)) |
| `PI_REOPEN_MAX_AGE_DAYS` | Jours après lesquels les entrées mortes ne sont plus restaurées (défaut 14, `0` désactive) |
| `PI_REOPEN_FORGET_ON_TAB_CLOSE` | Fermer un onglet unique (WezTerm a encore d'autres onglets) est traité comme « tâche terminée » et son enregistrement est supprimé (défaut actif) ; fermer tout le terminal ou un contrôle indécis conserve l'enregistrement. Définissez `0`/`false` pour toujours conserver les enregistrements |

Les noms legacy (`PI_WORKSPACE_*`) sont encore honorés ; le nom canonique `PI_REOPEN_*` l'emporte si les deux sont définis.

Par exemple, si Pi est installé via nvm, pnpm ou un préfixe npm personnalisé, définissez-le explicitement :

```bash
export PI_REOPEN_PI_BIN="$(type -P pi)"
export PI_REOPEN_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

Sous Linux/macOS/WSL, Pi est localisé depuis le PATH et l'environnement de connexion Bash. Windows natif résout `pi.exe` ou le `pi.cmd` npm depuis le PATH ; les shims npm sont résolus vers Node + l'entrée du paquet installé, évitant les problèmes de guillemets `cmd.exe` et de politique de script PowerShell. Les shims Windows non standard nécessitent une entrée JS explicite ou un `.exe`. Les onglets restaurés reçoivent le PATH et le répertoire d'agent de l'appelant, pas l'environnement complet ni les données d'authentification. La découverte de WezTerm vérifie les PATH spécifiques à la plateforme et les emplacements d'installation courants ; seul WSL utilise `where.exe` + `wslpath`. Pour des mises en place personnalisées, définissez un chemin explicite. Redémarrez Pi après avoir modifié des variables d'environnement ; `/reload` ne lit pas le nouvel environnement du shell parent.

## Fonctionnement

![How it works](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/how-it-works.png)

- **Enregistrement** : à chaque démarrage de Pi, `{chemin absolu du fichier de session, cwd, pid, processStart, bootId, paneId, weztermPid (WSL), platform, distro, user, schemaVersion}` est écrit en temps réel dans `~/.pi/agent/pi-reopen/members/` (un fichier par session, remplacement atomique). Les enregistrements écrits sous `pi-workspace/` par 0.3.0 et les versions antérieures sont toujours lus et nettoyés.
- **Détection de fermeture** : les sorties par signal de Pi émettent aussi un événement de nettoyage `quit`, donc le nom de l'événement seul n'est pas fiable. L'extension enregistre SIGHUP/SIGTERM dans le cycle de vie TUI ; un `/quit` délibéré sans signal ou un changement de session supprime l'enregistrement ; le rechargement conserve l'enregistrement et nettoie les écouteurs. Sans signal suivi, elle demande aussi à WezTerm si le panneau courant existe encore (`WEZTERM_PANE`) : un panneau disparu signifie que la fenêtre a été fermée, l'enregistrement est conservé. Par défaut (opt-out avec `PI_REOPEN_FORGET_ON_TAB_CLOSE=0`), un panneau disparu est supprimé au contraire si WezTerm a encore d'autres panneaux (fermer un onglet = tâche terminée, façon navigateur « les onglets fermés n'entrent pas dans le jeu de restauration ») ; sans autres panneaux ou contrôle indécis, l'enregistrement est conservé. Sous WSL, `list`/`restore` réconcilie à nouveau depuis un processus CLI sain : la suppression exige un marqueur de fermeture par signal correspondant, le même PID GUI enregistré, un Pi mort, le panneau d'origine manquant et au moins un panneau restant. Un plantage sans marqueur de fermeture, un WezTerm redémarré ou une requête échouée conserve l'enregistrement pour la restauration. Quand un kill franc empêche le nettoyage, le résidu est enregistré. En cas de coupure de courant, au plus les enregistrements persistés sont restaurés ; les derniers changements non flushés ne sont pas garantis.
- **Démarrage sûr** : les onglets s'ouvrent en parallèle (5 à la fois par défaut) ; chaque requête `wezterm cli spawn` est interrompue avec une erreur après 15 s sans réponse, et 3 échecs de requête consécutifs stoppent tôt, évitant les longues attentes quand WezTerm est bloqué. `--limit` borne la rafale.
- **Déduplication** : avant la restauration, la vivacité des processus est vérifiée (pid + heure de démarrage + bootId ; les PIDs périmés après un redémarrage ne sont pas mal interprétés), les processus en cours d'exécution sont scannés pour `--session <fichier>` afin qu'une fenêtre non enregistrée ne s'ouvre pas deux fois, et les réclamations de démarrage (TTL 60 s + vérification de vivacité du détenteur) réduisent les requêtes en double. Le verrou de restauration global (`restore.lock`, TTL 30 minutes + vivacité du pid + vérification du bootId) est créé avec `O_EXCL`, donc des restaurations concurrentes ne peuvent pas toutes démarrer un lot ; il peut être repris après la mort du détenteur ou un redémarrage de l'OS.
- **Vérification** : « demande acceptée » et « pi enregistré » sont rapportés séparément ; la fenêtre de confirmation évolue avec la taille du lot (15 s + 2 s par session, plafonnée à 90 s).
- **Titres et hygiène** : les onglets sont titrés avec le nom de la session, sinon le nom du dossier cwd. Les enregistrements plus anciens que 14 jours sont `expired` et ne sont plus restaurés automatiquement ; `forget`/`prune` nettoient sans toucher aux fichiers de conversation.
- **Sécurité** : si le pré-vol (identité du processus / WezTerm en cours d'exécution / Pi / adaptateur terminal / santé du registre, plus l'interop WSL le cas échéant) échoue, rien n'est lancé en vrac ; jamais de sudo automatique ; ENOEXEC s'accompagne d'un indice de correction.

## Développement et tests

```bash
# depuis la racine du repository
npm test                    # suite de régression complète Linux/WSL (test d'intégration sauté)
npm run test:platform       # suite native Linux/macOS/Windows
npm run verify-pack         # construire le tarball, vérifier le contenu, exécuter le CLI dépaqueté
npm run test:integration    # vrai test spawn/titre WezTerm (nécessite un WezTerm en cours d'exécution)
python3 test/pty-shutdown.py # vrai PTY Pi : le signal conserve l'enregistrement, /quit le supprime
```

```text
extensions/index.ts      extension Pi (fine couche d'adaptation) : enregistre les Pis vivants, fournit /reopen
src/                     noyau partagé (JS ESM pur, utilisé par l'extension et le CLI)
  terminals/             adaptateurs terminal (wezterm ; voir docs/TERMINALS.md)
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/
  launch/spawn/verify/restore/cli/prune/health/inuse/pane/sessions/i18n/version
bin/pi-reopen.js         point d'entrée du CLI (exécuté directement avec node, sans étape de build)
test/                    tests intégrés Node (répertoires isolés + mocks injectés, pas d'appel terminal réel)
docs/                    exigences, statut, plateformes, terminaux, publication
```

Les tests couvrent la restauration de base, l'ordre de traitement des signaux, le nettoyage au rechargement, la détection de fermeture par panneau, la sélection `/reopen recent`, les chemins d'installation Pi non standard, l'échappement shell, la fusion des enregistrements du répertoire legacy, le gating de schéma, l'i18n et le chargement après déplacement du paquet ; les tests sont isolés par répertoires temporaires et un lanceur mock. Le hook de test `PI_REOPEN_HOOKS` ne devrait pas être défini en usage normal.

CI exécute la suite de plateforme sur Linux/macOS/Windows, la suite complète sur Linux, la vérification du tarball empaqueté et le cycle de vie PTY Pi réel (il installe l'hôte Pi). CI ne peut pas ouvrir un GUI WezTerm, donc le vrai test spawn/titre reste opt-in via `PI_REOPEN_INTEGRATION=1`.

Étapes de publication du mainteneur : voir le [guide de publication](docs/PUBLISHING.md) et le [CHANGELOG](CHANGELOG.md).

## Feedback et partage

Si cela résout votre flux de redémarrage de terminal, partagez le [repository](https://github.com/AuthurX/pi-reopen) avec d'autres utilisateurs Pi / WezTerm. [Signalez les problèmes de restauration](https://github.com/AuthurX/pi-reopen/issues) avec votre OS, les versions de Pi/WezTerm et la sortie **anonymisée** de `pi-reopen doctor`. Ne téléversez jamais de credentials ni de fichiers de conversation privés. Voir les [projets de communication et plan de mesure](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md).

## Contributeurs

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## Licence

[MIT](LICENSE), Copyright (c) 2026 ellieyujin
