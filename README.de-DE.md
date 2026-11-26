# pi-reopen — Pi-Sitzungen in WezTerm wiederherstellen

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Pi-Paket](https://pi.dev/packages/@ellieyujin/pi-reopen) · [Releases](https://github.com/AuthurX/pi-reopen/releases)

**Öffnet WezTerm neu. Stellt Ihre Pi-Coding-Agent-Sitzungen, Arbeitsverzeichnisse und Gespräche mit einem einzigen Befehl wieder her.**

![Pi session recovery preview](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/preview.png)

Eine [Pi](https://github.com/earendil-works/pi)-Erweiterung und CLI für **Sitzungswiederherstellung nach dem Schließen des Terminals**. Sie erfasst offene Pi-Sitzungen und öffnet sie erneut als [WezTerm](https://wezterm.org/)-Tabs; Sitzungen, die noch laufen, werden übersprungen.

## Eine Sitzung fortsetzen oder einen Workspace wiederherstellen?

| Ziel | Verwendung |
| --- | --- |
| Neueste Sitzung im aktuellen Verzeichnis fortsetzen | Eingebautes `pi -c` |
| Ein vergangenes Gespräch auswählen | Eingebautes `pi -r` oder `/resume` |
| Erfasste Pi-Sitzungen über Projekte hinweg nach dem Schließen von WezTerm neu öffnen | `pi-reopen` |
| Wiederherstellungsplan anzeigen, ohne Tabs zu öffnen | `pi-reopen restore --dry-run` |

Dies ist die **Sitzungswiederherstellung eines Workspaces**, kein Ersatz für den Pi-Sitzungswähler. Es startet neue Pi-Prozesse mit den ursprünglichen Sitzungsdateien; laufende Tools, ungespeicherte Zustände, Split-Pane-Geometrien oder beliebige Shell-Programme werden nicht wiederhergestellt. Bewusstes Beenden von Pi entfernt die Registrierung. Beim Start von WezTerm wird die Wiederherstellung nicht automatisch ausgelöst; führen Sie `pi-reopen` aus, nachdem Sie es erneut geöffnet haben.

## So nutzen Sie es: Denken Sie an Browser-Tabs

| Browser | pi-reopen |
| --- | --- |
| Tabs, die beim Beenden noch offen waren | Pi-Sitzungen, die beim Schließen von WezTerm noch offen waren |
| Offene Tabs kommen beim nächsten Start zurück | `pi-reopen` öffnet die aufbewahrten Einträge als neue Tabs |
| Tabs, die Sie selbst geschlossen haben, bleiben außerhalb der Wiederherstellungsliste | Ein mit `ctrl+w` geschlossener Tab wird standardmäßig vergessen (oder immer, wenn Sie in Pi `/quit` ausführen) |
| „Zuletzt geschlossen" per Ctrl+Shift+T | `/reopen recent` — die letzten 24 h, auch ohne Eintrag |
| Absturz → „Seiten wiederherstellen?" | Absturz / komplettes Schließen von WezTerm / WSL-Abschaltung → alle Einträge bleiben, `pi-reopen` stellt sie wieder her |

Die Regel, die Sie im Kopf behalten sollten: **offen = behalten, geschlossen = freigegeben**. Keine Markierungen oder zusätzlichen Befehle — ein Tab, den Sie offen lassen, ist Ihr „Ich will das zurück"-Signal, und das Schließen eines Tabs bedeutet „Ich bin damit fertig". (Standard: Ein geschlossener Tab wird browserartig aus der Wiederherstellungsliste entfernt; setzen Sie `PI_REOPEN_FORGET_ON_TAB_CLOSE=0`, um Einträge immer zu behalten.)

## Anwendungsfall und Plattformunterstützung

**Entwickelt für die Arbeit über mehrere Projekte in WezTerm: Sie haben mehrere Pi-Sitzungen offen, schließen das Terminal und möchten die erfassten Sitzungen mit ihren Arbeitsverzeichnissen und Gesprächen zurück.** Öffnen Sie WezTerm erneut und führen Sie `pi-reopen` aus, um ausstehende Sitzungen in neuen Tabs wiederherzustellen.

| Laufzeitumgebung | Unterstützungsstatus | Wo Sitzungen wieder geöffnet werden |
| --- | --- | --- |
| Natives Linux | Implementiert | Neue Tabs in der lokalen Linux-WezTerm-Instanz |
| Natives macOS | Implementiert | Neue Tabs in der lokalen Mac-WezTerm-Instanz |
| Natives Windows | Implementiert | Neue Tabs in der lokalen Windows-WezTerm-Instanz, mit nativem Windows-Pi |
| WSL | Implementiert | Neue Tabs im Windows-WezTerm, startet Pi in der zugehörigen WSL-Distribution |
| FreeBSD und andere Betriebssysteme | Nicht unterstützt | Der Restore-Präflight lehnt nicht unterstützte Plattformen ab |

**Das einzige Wiederherstellungsziel ist das lokale WezTerm.** Die Wiederherstellung in Windows Terminal, iTerm2, das VS-Code-Integriert-Terminal oder tmux wird nicht unterstützt. PowerShell, Bash und zsh sind Shells, keine Ziel-Terminalanwendungen; auch die Ausführung des Befehls aus PowerShell erfordert ein offenes WezTerm. Natives Windows und WSL sind getrennte Umgebungen: Eine Installation auf der einen Seite kann keine Sitzungen der anderen Seite wiederherstellen. Migration zwischen Maschinen wird nicht unterstützt.

„Implementiert" bedeutet, dass ein plattformspezifischer Wiederherstellungspfad existiert, nicht dass alle Realgeräte-Szenarien verifiziert wurden. Siehe [Plattform-Hinweise](docs/PLATFORMS.md) für Prüfungsumfang und Einschränkungen.

## Schnellstart

`@ellieyujin/pi-reopen` ist das einzige gepflegte npm-Paket. Der CLI-Befehl bleibt `pi-reopen`.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

`setup` bündelt Prüfungen der Erweiterungsquelle, ob der erfasste Prozess noch lebt, der globalen CLI und des PATH, der Versionenübereinstimmung und doppelter Legacy-Einträge. Es zeigt plattformspezifische nächste Befehle an, führt aber niemals `sudo` oder `setx` aus und ändert keine Systemkonfiguration.

Führen Sie in jedem bestehenden Pi `/reload` aus, damit er mit dem Erfassen beginnt. Nach dem Schließen und erneuten Öffnen von WezTerm:

```bash
pi-reopen restore --dry-run
pi-reopen
```

Lesen Sie vor dem Wechsel des Paketnamens die [Installations- und Migrationsanleitung](#installation).

## Voraussetzungen

- **Linux / macOS / natives Windows + lokales WezTerm** oder **WSL + Windows-WezTerm**
- Node ≥ 22.19, mit [Pi](https://github.com/earendil-works/pi) in derselben OS-Umgebung installiert
- WezTerm vor der Wiederherstellung öffnen; dieses Tool fügt Tabs einer laufenden Instanz hinzu, kein entfernter SSH-Bereich
- Linux/macOS/WSL benötigen Bash. Natives Windows benötigt Windows PowerShell 5.1 (einschließlich CIM); installieren Sie Git for Windows für das Bash-Tool von Pi, und bevorzugen Sie ein aktuelles WezTerm-Nightly
- WSL-Wiederherstellung verwendet den Standardbenutzer der Distribution; führen Sie dieses Tool als dieser Benutzer aus. Lassen Sie natives Windows und WSL nicht eine gemeinsame Registrierung teilen

Version 1.0.0 ist der erste stabile Release. CI führt Plattformtests auf Linux, macOS und Windows aus, mit der vollständigen Regressionssuite, packaged-tarball-Prüfungen und echtem Pi-PTY-Lebenszyklus auf Linux; die GUI-Zu-/Auf-Akzeptanz auf macOS/Windows erfordert noch Realgeräteverifikation. Siehe [Plattform-Hinweise](docs/PLATFORMS.md).

## Verwendung

```bash
pi-reopen
```

```text
  ✔ pi-workspace: gestartet und bestätigt (/home/ellie/work/MY/code/pi-workspace)
  ⚠ other-proj: Tab erstellt, pi-Start nicht rechtzeitig bestätigt (/home/ellie/work/other-proj)
2 verarbeitet
```

Die Ausgabe folgt der Locale: Chinesisch bei `zh_*`, sonst Englisch. Erzwingen Sie es mit `PI_REOPEN_LANG=zh|en`.

| Ausgabe | Bedeutung |
| --- | --- |
| `✔ gestartet und bestätigt` | gestartet und bestätigt |
| `⚠ Tab erstellt, pi-Start nicht rechtzeitig bestätigt` | Tab erstellt, aber die pi-Startbestätigung ist abgelaufen |
| `N verarbeitet` | N verarbeitet |

Äquivalente Einstiegspunkte in Pi:

- `/reopen` — registrierte Pis wiederherstellen
- `/reopen recent` — aus dem Gesprächsverlauf der letzten 24 h auffangen (für nicht registrierte Fenster)
- `/reopen clear` — Registrierung leeren (löscht keine Gesprächsdateien)
- `Strg+Shift+O` — Wiederherstellung per Klick

`/all` funktioniert weiterhin als veralteter Alias für `/reopen` (zeigt einen Umbenachrichtigungshinweis).

## Befehle

| Befehl | Beschreibung |
| --- | --- |
| `pi-reopen` (d. h. `pi-reopen restore`) | Öffnet die beim letzten Schließen noch offenen Pis erneut; laufende werden übersprungen |
| `pi-reopen restore --dry-run` | Zeigt nur den Plan, öffnet keine Tabs |
| `pi-reopen restore --no-wait` | Überspringt das Warten auf die Startbestätigung jedes pi |
| `pi-reopen restore --only <Muster>` | Stellt nur passende Sitzungen wieder her (Teilstring, `*`-Glob oder Index der aktuellen Liste; Name, Pfad oder id) |
| `pi-reopen restore --interactive` | Zeigt die aktuelle Liste an, Indizes eingeben, um Sitzungen auszuwählen |
| `pi-reopen restore --limit <N>` | Öffnet bei diesem Lauf höchstens N Tabs; der Rest wird auf später verschoben |
| `pi-reopen restore --json` | Maschinell lesbare Ausgabe |
| `pi-reopen list [--wide\|--json]` | Listet registrierte Mitglieder und Status auf; lange Inhalte werden standardmäßig auf die Terminalbreite gekürzt |
| `pi-reopen show <Index\|id\|Präfix> ...` | Zeigt Status, Pfade, Sitzungsdatei und Registrierungsdetails |
| `pi-reopen forget <Index\|id\|Präfix> ...` | Entfernt bestimmte Einträge (Gesprächsdateien bleiben unberührt) |
| `pi-reopen prune [--dry-run]` | Entfernt abgelaufene/unwiederherstellbare Einträge (behält die letzten 14 Tage) |
| `pi-reopen setup` | Geführte Erstlauf-Prüfungen; zeigt Befehle an, ohne das System zu ändern |
| `pi-reopen doctor` | Umgebungs- und Registrierungsprüfung (Erweiterungsprozess-Identität, Versionsübereinstimmung und WSL-Einzeltabschließ-Erkennung) |
| `pi-reopen clear` | Leert Registrierung und Startansprüche (löscht keine Gesprächsdateien oder Legacy-Formateinträge) |
| `pi-reopen --help` / `--version` | Verwendung / Version |

Die `#`-Spalte ist ein **Index im aktuellen Listensnapshot, keine stabile ID**. Jeder Befehl löst ihn gegen die neueste Liste in derselben Reihenfolge auf; führen Sie nach Hinzufügungen, Entfernungen oder Zeitstempel-Umordnungen erneut `pi-reopen list` aus. Rein numerische Eingaben werden zuerst als Index behandelt; Sitzungs-IDs und eindeutige Präfixe werden weiterhin unterstützt.

```bash
pi-reopen list
pi-reopen restore --only 1,3 --dry-run
pi-reopen show 2
pi-reopen forget 2
pi-reopen restore --interactive
```

`list`-Status: running (laufend) / start claimed (Start beansprucht) / pending restore (Wiederherstellung ausstehend) / expired (abgelaufen) / in other window open (in anderem Fenster offen) / working directory missing (Arbeitsverzeichnis fehlt) / session file missing (Sitzungsdatei fehlt) / nicht von `--only` gematcht / durch `--limit` verschoben / andere Plattform oder Distribution / doppelter Eintrag.

Exit-Codes: 0 Erfolg; 1 Wiederherstellungsanfrage fehlgeschlagen oder unbekannter Befehl; 2 Umgebungs-Präflight fehlgeschlagen; 3 Anfragen gesendet, aber nicht bestätigt; 4 nur übersprungen (beansprucht/verschoben).

## Installation

### Aus npm

Verwenden Sie `@ellieyujin/pi-reopen` mit dem stabilen `latest`-Dist-Tag. Das nicht gescopete Paket `pi-reopen` wurde veröffentlicht zurückgezogen. Das nicht gescopete `pi-workspace` auf npm ist ein Projekt eines anderen Autors.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

- `pi install` registriert und lädt die Erweiterung, garantiert aber nicht, dass die CLI im PATH einer gewöhnlichen Shell liegt; `npm install -g` installiert die externe CLI (das npm-Global-bin-Verzeichnis muss ebenfalls im PATH sein)
- Die CLI hängt nicht von den Peer-Paketen von Pi ab, daher `--omit=peer`, um den Host nicht zusätzlich zu installieren; die beiden Installationen müssen separat aktualisiert und auf derselben Version gehalten werden (`pi-reopen setup` / `doctor` meldet Abweichungen)
- `pi install` deklariert nur eine minimale Peer-Version (`>=1.5.0`), ohne Obergrenze: jeder neuere Pi kann direkt installiert werden

**Die Registrierung erfordert die Erweiterung**: Die Installation nur der CLI kann keine Sitzungen erfassen. Führen Sie nach der Installation in jedem bereits offenen Pi `/reload` oder einen Neustart aus; eine Neuinstallation kann vorher nicht registrierte Fenster nicht exakt wiederherstellen. Laden Sie keinen veralteten lokalen Erweiterungseintrag (z. B. einen alten `open-all.ts`-Symlink oder eine separate `pi-reopen`-Kopie) gleichzeitig mit dem Paket. `pi-reopen setup` prüft Paketquellen und wahrscheinlich doppelte Einträge im persönlichen Erweiterungsverzeichnis; überprüfen Sie sie mit `pi list`, deaktivieren Sie nur alte Einträge und löschen Sie keine Sitzungs- oder Auth-Dateien. `doctor`/`setup` verifiziert die Selbstregistrierung per PID, Prozessstartzeit und Boot-ID; eine alte `extension.json` allein bedeutet nicht mehr, dass die Erweiterung gerade läuft.

### Migration vom nicht mehr veröffentlichten Paket

`@ellieyujin/pi-reopen`-Nutzer müssen den Paketnamen nicht ändern. Wenn Sie das inzwischen zurückgezogene `pi-reopen` installiert haben, entfernen Sie es vor der Installation des gepflegten Pakets, um doppeltes Laden und CLI-Konflikte zu vermeiden. Prüfen Sie `pi list` und entfernen Sie die dort angezeigte genaue alte Quelle. Für eine Installation mit `@latest`:

```bash
pi remove npm:pi-reopen@latest
npm uninstall -g pi-reopen
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
```

Starten Sie Pi neu und führen Sie `pi-reopen doctor` aus. Sitzungsdateien und `~/.pi/agent/pi-reopen/`-Registrierungen bleiben unverändert; löschen Sie sie nicht. CLI- und Erweiterungsversion sollten übereinstimmen. Kombinieren Sie keinen lokalen Erweiterungslink (z. B. einen alten `open-all.ts` oder einen `pi-reopen`-Symlink) mit dem npm-Paket.

### Aus dem Quellcode

Die folgenden Befehle laufen auf Linux/macOS/WSL und installieren den aktuell gecheckoutten Quellcode:

```bash
git clone https://github.com/AuthurX/pi-reopen.git
cd pi-reopen
pi install .
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/pi-reopen.js" "$HOME/.local/bin/pi-reopen"
export PATH="$HOME/.local/bin:$PATH"
pi-reopen setup
```

Speichern Sie die PATH-Konfiguration in Ihrer Shell-Startdatei. Wenn der CLI-Symlink bereits existiert, prüfen Sie zuerst sein Ziel; überschreiben Sie ihn nicht blind.

Auf nativem Windows, aus dem gecheckten Repository in PowerShell:

```powershell
pi install .
node .\bin\pi-reopen.js doctor
node .\bin\pi-reopen.js
```

Verwenden Sie `pi.cmd` statt `pi`, wenn die PowerShell-Ausführungspolitik npm's `.ps1`-Shim blockiert; es ist keine Policy-Änderung nötig.

Wenn Sie nur die Erweiterung benötigen, können Sie auch die gepushte Git-Version direkt installieren:

```bash
pi install git:github.com/AuthurX/pi-reopen
```

## Optionale Konfiguration

| Umgebungsvariable | Zweck |
| --- | --- |
| `PI_REOPEN_WEZTERM` | Absoluter Pfad des lokalen WezTerm (`wezterm` / `wezterm.exe`); unter WSL seinen Windows-Pfad verwenden, z. B. `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_REOPEN_PI_BIN` | Absoluter Pfad der Pi-Executable, ohne Argumente; Windows akzeptiert npm `pi.cmd`, den JS-Eintrag des Pakets oder `.exe`; Aliase/Funktionen werden nicht unterstützt |
| `PI_CODING_AGENT_DIR` | Anderes Pi-Konfigurations-/Registrierungsverzeichnis verwenden; CLI und Erweiterung müssen übereinstimmen |
| `PI_REOPEN_SRC` | Nur Entwicklung: überschreibt das gemeinsame `src/`-Verzeichnis; bei normalen Paketinstallationen nicht nötig |
| `PI_REOPEN_LANG` | Ausgabesprache erzwingen: `zh` oder `en` (Standard aus `LC_ALL`/`LANG`) |
| `PI_REOPEN_TERMINAL` | Terminal-Adapter-id; nur `wezterm` implementiert (siehe [docs/TERMINALS.md](docs/TERMINALS.md)) |
| `PI_REOPEN_MAX_AGE_DAYS` | Tage, nach denen tote Einträge nicht mehr wiederhergestellt werden (Standard 14, `0` deaktiviert) |
| `PI_REOPEN_FORGET_ON_TAB_CLOSE` | Schließen eines einzelnen Tabs (WezTerm hat noch andere Tabs) wird als „Aufgabe erledigt" gewertet und der Eintrag gelöscht (standardmäßig an); das Schließen des gesamten Terminals oder ein unklare Prüfung behält den Eintrag. `0`/`false` immer Einträge behalten |

Legacy-Namen (`PI_WORKSPACE_*`) werden weiterhin respektiert; der kanonische `PI_REOPEN_*`-Name gewinnt, wenn beide gesetzt sind.

Wenn Pi beispielsweise über nvm, pnpm oder ein benutzerdefiniertes npm-Präfix installiert ist, setzen Sie es explizit:

```bash
export PI_REOPEN_PI_BIN="$(type -P pi)"
export PI_REOPEN_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

Auf Linux/macOS/WSL wird Pi aus dem PATH und der Bash-Login-Umgebung gefunden. Natives Windows löst `pi.exe` oder npm's `pi.cmd` aus dem PATH auf; npm-Shims werden auf Node + den installierten Paket-Eintrag aufgelöst, um `cmd.exe`-Quotierung und PowerShell-Skriptpolicy-Probleme zu vermeiden. Ungewöhnliche Windows-Shims erfordern einen expliziten JS-Eintrag oder `.exe`. Wiederhergestellte Tabs erhalten den PATH und das Agentenverzeichnis des Aufrufenden, nicht die vollständige Umgebung oder Auth-Daten. Die WezTerm-Erkennung prüft plattformspezifische PATHs und übliche Installationsorte; nur WSL verwendet `where.exe` + `wslpath`. Für benutzerdefinierte Layouts einen expliziten Pfad setzen. Pi nach Änderungen von Umgebungsvariablen neu starten; `/reload` liest die neue Umgebung der Eltern-Shell nicht.

## Funktionsweise

![How it works](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/how-it-works.png)

- **Registrierung**: Bei jedem Pi-Start wird `{Sitzungsdatei-Absolutpfad, cwd, pid, processStart, bootId, paneId, weztermPid (WSL), platform, distro, user, schemaVersion}` in Echtzeit nach `~/.pi/agent/pi-reopen/members/` geschrieben (eine Datei pro Sitzung, atomarer Ersatz). Unter `pi-workspace/` von 0.3.0 und älteren Versionen geschriebene Einträge werden weiterhin gelesen und aufgeräumt.
- **Schließ-Erkennung**: Auch Pi-Signal-Exits senden ein `quit`-Bereinigungsevent, daher ist der Eventname allein nicht verlässlich. Die Erweiterung erfasst SIGHUP/SIGTERM im TUI-Lebenszyklus; ein bewusster `/quit` oder Sitzungsuwechsel ohne Signal löscht den Eintrag; Reload behält den Eintrag und räumt Listener auf. Ohne verfolgtes Signal fragt sie WezTerm, ob das aktuelle Pane noch existiert (`WEZTERM_PANE`): Ein verschwundenes Pane bedeutet, dass das Fenster geschlossen wurde, der Eintrag bleibt. Standardmäßig (Opt-out mit `PI_REOPEN_FORGET_ON_TAB_CLOSE=0`) wird ein verschwundenes Pane stattdessen gelöscht, wenn WezTerm noch andere Panes hat (Tab schließen = Aufgabe erledigt, browserartig „geschlossene Tabs treten nicht in den Wiederherstellungsverkehr ein"); ohne andere Panes oder bei unklare Prüfung bleibt der Eintrag. Unter WSL justiert `list`/`restore` in einem gesunden CLI-Prozess erneut: Löschung erfordert eine passende Signal-Schließ-Marke, dieselbe registrierte GUI-PID, einen toten Pi, ein fehlendes ursprüngliches Pane und mindestens ein verbleibendes Pane. Ein Absturz ohne Schließ-Marke, ein neugestartetes WezTerm oder eine fehlgeschlagene Abfrage behält den Eintrag zur Wiederherstellung. Wenn ein Hard Kill die Bereinigung verhindert, wird der Rest erfasst. Bei Stromausfall werden höchstens die persistierten Einträge wiederhergestellt; die letzten nicht flushenden Änderungen sind nicht garantiert.
- **Sicheres Starten**: Tabs werden parallel geöffnet (standardmäßig 5 gleichzeitig); jede `wezterm cli spawn`-Anfrage wird nach 15 s ohne Antwort mit Fehler abgebrochen, und 3 aufeinanderfolgende Fehlversuche stoppen frühzeitig, um lange Wartezeiten bei einem eingefrorenen WezTerm zu vermeiden. `--limit` begrenzt den Burst.
- **Entdopplung**: Vor der Wiederherstellung wird die Prozesslebensfähigkeit geprüft (pid + Startzeit + bootId; alte PIDs nach einem Neustart werden nicht missverstanden), laufende Prozesse werden nach `--session <datei>` gescannt, damit ein nicht registriertes Fenster nicht zweimal geöffnet wird, und Startansprüche (60 s TTL + Halter-Lebensfähigkeitsprüfung) reduzieren doppelte Anfragen. Die globale Wiederherstellungssperre (`restore.lock`, 30-Minuten-TTL + pid-Lebensfähigkeit + bootId-Prüfung) wird mit `O_EXCL` erstellt, sodass gleichzeitige Wiederherstellungen nicht beide einen Batch starten können; sie kann nach dem Tod des Halterprozesses oder einem OS-Neustart übernommen werden.
- **Verifizierung**: „Anfrage akzeptiert" und „pi registriert" werden getrennt gemeldet; das Bestätigungsfenster skaliert mit der Batch-Größe (15 s + 2 s pro Sitzung, gedeckelt bei 90 s).
- **Titel und Hygiene**: Tabs tragen den Sitzungs- bzw. cwd-Ordernamen als Titel. Einträge älter als 14 Tage sind `expired` und werden nicht mehr automatisch wiederhergestellt; `forget`/`prune` räumen auf, ohne Gesprächsdateien anzufassen.
- **Sicherheit**: Wenn der Präflight (Prozessidentität / laufendes WezTerm / Pi / Terminal-Adapter / Registrierungsgesundheit, zutreffend plus WSL-Interop) fehlschlägt, wird nichts im Bulk gestartet; niemals Auto-Sudo; ENOEXEC kommt mit einem Reparaturhinweis.

## Entwicklung und Tests

```bash
# aus dem Repository-Wurzelverzeichnis
npm test                    # vollständige Linux/WSL-Regressionssuite (Integrationstest übersprungen)
npm run test:platform       # native Linux/macOS/Windows-Suite
npm run verify-pack         # Tarball bauen, Inhalt prüfen, entpackte CLI ausführen
npm run test:integration    # echter WezTerm-Spawn/Title-Test (benötigt laufendes WezTerm)
python3 test/pty-shutdown.py # echter Pi-PTY: Signal behält den Eintrag, /quit entfernt ihn
```

```text
extensions/index.ts      Pi-Erweiterung (dünne Adapter-Schicht): registriert lebende Pis, bietet /reopen
src/                     gemeinsamer Kern (reines JS ESM, von Erweiterung und CLI genutzt)
  terminals/             Terminal-Adapter (wezterm; siehe docs/TERMINALS.md)
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/
  launch/spawn/verify/restore/cli/prune/health/inuse/pane/sessions/i18n/version
bin/pi-reopen.js         CLI-Einstiegspunkt (direkt mit node ausführen, kein Build-Schritt)
test/                    Node-Eingebaut-Tests (isolierte Verzeichnisse + injizierte Mocks, keine echten Terminalaufrufe)
docs/                    Anforderungen, Status, Plattformen, Terminals, Veröffentlichung
```

Die Tests decken Kern-Wiederherstellung, Signalbehandlungsreihenfolge, Reload-Bereinigung, pane-basierte Schließ-Erkennung, `/reopen recent`-Auswahl, nicht-standard Pi-Installationspfade, Shell-Escaping, Eintragsvereinigung aus dem Legacy-Verzeichnis, Schema-Gating, i18n und Laden nach Paketumzug ab; die Tests sind über temporäre Verzeichnisse und einen Mock-Launcher isoliert. Der Test-Hook `PI_REOPEN_HOOKS` sollte bei normalem Gebrauch nicht gesetzt werden.

CI führt die Plattform-Suite auf Linux/macOS/Windows, die vollständige Suite auf Linux, die packaged-tarball-Prüfung und den echten Pi-PTY-Lebenszyklus (installiert den Pi-Host) aus. CI kann kein WezTerm-GUI öffnen, daher bleibt der echte Spawn/Title-Test opt-in über `PI_REOPEN_INTEGRATION=1`.

Maintainer-Release-Schritte: siehe [Veröffentlichungsguide](docs/PUBLISHING.md) und [CHANGELOG](CHANGELOG.md).

## Feedback und Teilen

Wenn das Ihr Terminal-Neustart-Workflow löst, teilen Sie das [Repository](https://github.com/AuthurX/pi-reopen) mit anderen Pi-/WezTerm-Nutzern. [Melden Sie Wiederherstellungsprobleme](https://github.com/AuthurX/pi-reopen/issues) mit Ihrem OS, den Pi-/WezTerm-Versionen und der **geschwärzten** `pi-reopen doctor`-Ausgabe. Laden Sie niemals Zugangsdaten oder private Gesprächsdateien hoch. Siehe [Outreach-Entwürfe und Messplan](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md).

## Mitwirkende

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## Lizenz

[MIT](LICENSE), Copyright (c) 2026 ellieyujin
