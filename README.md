# pi-reopen — restore Pi sessions in WezTerm

[English](README.md) | [简体中文](README.zh-CN.md) · [Pi package](https://pi.dev/packages/@ellieyujin/pi-reopen) · [Releases](https://github.com/AuthurX/pi-reopen/releases)

**Reopen WezTerm. Restore your Pi coding agent sessions, working directories, and conversations with one command.**

![Pi session recovery preview](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/preview.png)

A [Pi](https://github.com/earendil-works/pi) extension and CLI for **session recovery after closing the terminal**. It records open Pi sessions and reopens them as [WezTerm](https://wezterm.org/) tabs, skipping sessions that are already running.

## Resume one session or restore a workspace?

| Goal | Use |
| --- | --- |
| Continue the latest session in your current directory | Built-in `pi -c` |
| Pick a historical conversation | Built-in `pi -r` or `/resume` |
| Reopen the recorded Pi sessions across projects after WezTerm closes | `pi-reopen` |
| Preview the recovery plan without opening tabs | `pi-reopen restore --dry-run` |

This is workspace **session restoration**, not a replacement for Pi's session picker. It starts new Pi processes with the original session files; it does not restore running tools, unsaved state, split-pane geometry, or arbitrary shell programs. Deliberately quitting Pi removes its registration. WezTerm startup does not automatically trigger recovery; run `pi-reopen` after reopening it.

## Quick start

For the **1.0.2 release**, the primary package is `pi-reopen`; `@ellieyujin/pi-reopen` remains the compatibility distribution. Until 1.0.2 is published, use the scoped name in both installation commands below. Never install both distributions together.

```bash
pi install npm:pi-reopen@latest
npm install -g pi-reopen@latest --omit=peer
pi-reopen doctor
```

Run `/reload` in each existing Pi so it starts recording. After closing and reopening WezTerm:

```bash
pi-reopen restore --dry-run
pi-reopen
```

See [installation and migration](#installation) before switching package names.

## Requirements

- **Linux / macOS / native Windows + local WezTerm**, or **WSL + Windows WezTerm**
- Node ≥ 22.19, with [Pi](https://github.com/earendil-works/pi) installed in the same OS environment
- Open WezTerm before restoring; this tool adds tabs to a running instance, not a remote SSH domain
- Linux/macOS/WSL require Bash. Native Windows requires Windows PowerShell 5.1 (including CIM); install Git for Windows for Pi's Bash tool, and prefer a recent WezTerm nightly
- WSL restore uses the distro's default user; run this tool as that user. Do not share one registry between native Windows and WSL

Version 1.0.0 is the first stable release. CI runs the full suite on Linux, macOS and Windows, verifies the packaged tarball and runs the real Pi PTY lifecycle on Linux; macOS/Windows GUI close/reopen acceptance still needs real-machine verification. See [platform notes](docs/PLATFORMS.md).

## Usage

```bash
pi-reopen
```

```text
  ✔ pi-workspace: started and confirmed (/home/ellie/work/MY/code/pi-workspace)
  ⚠ other-proj: tab created, pi start not confirmed in time (/home/ellie/work/other-proj)
Processed 2
```

Output follows the locale: Chinese for `zh_*`, English otherwise. Force it with `PI_REOPEN_LANG=zh|en`.

| Output | Meaning |
| --- | --- |
| `✔ started and confirmed` | launched and confirmed |
| `⚠ tab created, pi start not confirmed in time` | tab created, but pi start confirmation timed out |
| `Processed N` | N processed |

Equivalent entry points inside Pi:

- `/reopen` — restore registered Pis
- `/reopen recent` — pick up from conversation history of the last 24 hours (for unregistered windows)
- `/reopen clear` — clear the registry (does not delete conversation files)
- `Ctrl+Shift+O` — one-click restore

`/all` still works as a deprecated alias for `/reopen` (shows a rename notice).

## Commands

| Command | Description |
| --- | --- |
| `pi-reopen` (i.e. `pi-reopen restore`) | Reopen the Pis still open at last close; running ones are skipped |
| `pi-reopen restore --dry-run` | Show the plan only, do not open tabs |
| `pi-reopen restore --no-wait` | Skip waiting for each pi's start confirmation |
| `pi-reopen restore --only <pattern>` | Restore only matching sessions (substring or `*` glob; name, path or id) |
| `pi-reopen restore --limit <N>` | Open at most N tabs this run; the rest are deferred to next time |
| `pi-reopen restore --json` | Machine-readable output |
| `pi-reopen list [--wide\|--json]` | List registered members and status; long content is truncated to terminal width by default |
| `pi-reopen forget <id\|prefix> ...` | Drop specific records (conversation files untouched) |
| `pi-reopen prune [--dry-run]` | Drop expired/unrecoverable records (keeps the last 14 days) |
| `pi-reopen doctor` | Environment and registry check (platform / WezTerm / pi / identity / extension / version match) |
| `pi-reopen clear` | Clear the registry and start claims (does not delete conversation files or legacy-format records) |
| `pi-reopen --help` / `--version` | Usage / version |

`list` statuses: running (运行中) / start claimed (启动占用中) / pending restore (待恢复) / expired (已过期) / open in another window (已在其他窗口打开) / working directory missing (工作目录缺失) / session file missing (会话文件缺失) / not matched by `--only` / deferred by `--limit` / other platform or distro (其他平台/发行版) / duplicate entry (重复条目).

Exit codes: 0 success; 1 restore request failed or unknown command; 2 environment preflight failed; 3 requests sent but not confirmed; 4 skipped only (claimed/deferred).

## Installation

### From npm

For 1.0.2 and later, use `pi-reopen` with the stable `latest` dist-tag. Before that release, substitute `@ellieyujin/pi-reopen`. The unscoped `pi-workspace` on npm is a different author's project.

```bash
pi install npm:pi-reopen@latest
npm install -g pi-reopen@latest --omit=peer
pi-reopen doctor
```

- `pi install` registers and loads the extension, but does not guarantee the CLI is on a regular shell's PATH; `npm install -g` installs the external CLI (the npm global bin directory must also be on PATH)
- The CLI does not depend on Pi's peer packages, hence `--omit=peer` to avoid installing the host as well; the two installs must be updated separately and kept at the same version (`pi-reopen doctor` reports drift)
- `pi install` declares only a minimum peer version (`>=1.5.0`), with no upper bound: any newer Pi can be installed directly

**Registration requires the extension**: installing only the CLI cannot record sessions. After install, run `/reload` or restart in each already-open Pi; a fresh install cannot precisely recover previously unregistered windows. Do not load an old `open-all.ts` copy/symlink at the same time as the package; before migrating, check `pi list` and the personal extension directory, disable the old entry only, and do not delete session or auth files.

### Moving to the shorter package name (after release)

`pi-reopen` and `@ellieyujin/pi-reopen` are intended to distribute the same implementation. **Load only one**: Pi treats different npm names as different packages. Check `pi list` and remove the exact old source shown there before installing the new one. For an installation using `@latest`:

```bash
pi remove npm:@ellieyujin/pi-reopen@latest
npm uninstall -g @ellieyujin/pi-reopen
pi install npm:pi-reopen@latest
npm install -g pi-reopen@latest --omit=peer
```

Restart Pi, then run `pi-reopen doctor`. Session files and `~/.pi/agent/pi-reopen/` registrations are unchanged; do not delete them. Existing users may stay on the scoped distribution. CLI and extension versions should match. Do not combine a local `open-all.ts` link with either package.

### From source

The following commands run on Linux/macOS/WSL and install the currently checked-out source:

```bash
git clone https://github.com/AuthurX/pi-reopen.git
cd pi-reopen
pi install .
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/pi-reopen.js" "$HOME/.local/bin/pi-reopen"
export PATH="$HOME/.local/bin:$PATH"
pi-reopen doctor
```

Save the PATH configuration in your shell startup file for future use. If the CLI symlink already exists, check its target first; do not blindly overwrite it.

On native Windows, from the checked-out repository in PowerShell:

```powershell
pi install .
node .\bin\pi-reopen.js doctor
node .\bin\pi-reopen.js
```

Use `pi.cmd` instead of `pi` if PowerShell execution policy blocks npm's `.ps1` shim; no policy change is needed.

If you only need the extension, you can also install the pushed Git version directly:

```bash
pi install git:github.com/AuthurX/pi-reopen
```

## Optional Configuration

| Environment variable | Purpose |
| --- | --- |
| `PI_REOPEN_WEZTERM` | Absolute path of local WezTerm (`wezterm` / `wezterm.exe`); in WSL use its Windows path, e.g. `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_REOPEN_PI_BIN` | Absolute Pi executable path, no arguments; Windows accepts npm `pi.cmd`, the package's JS entry, or `.exe`; aliases/functions are unsupported |
| `PI_CODING_AGENT_DIR` | Use a different Pi config/registry directory; CLI and extension must stay consistent |
| `PI_REOPEN_SRC` | Development only: overrides the shared `src/` directory; not needed for normal package installs |
| `PI_REOPEN_LANG` | Force output language: `zh` or `en` (defaults from `LC_ALL`/`LANG`) |
| `PI_REOPEN_TERMINAL` | Terminal adapter id; only `wezterm` is implemented (see [docs/TERMINALS.md](docs/TERMINALS.md)) |
| `PI_REOPEN_MAX_AGE_DAYS` | Days after which dead records stop being restored (default 14, `0` disables) |

Legacy names (`PI_WORKSPACE_*`) are still honored; the canonical `PI_REOPEN_*` name wins when both are set.

For example, if Pi is installed via nvm, pnpm, or a custom npm prefix, set it explicitly:

```bash
export PI_REOPEN_PI_BIN="$(type -P pi)"
export PI_REOPEN_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

On Linux/macOS/WSL, Pi is located from PATH and the Bash login environment. Native Windows resolves `pi.exe` or npm's `pi.cmd` from PATH; npm shims are resolved to Node + the installed package entry, avoiding `cmd.exe` quoting and PowerShell script-policy issues. Nonstandard Windows shims require an explicit JS entry or `.exe`. Restored tabs receive the caller's PATH and agent directory, not the full environment or authentication data. WezTerm discovery checks platform-specific PATH and common install locations; only WSL uses `where.exe` + `wslpath`. For custom layouts set an explicit path. Restart Pi after changing environment variables; `/reload` does not read the parent shell's new environment.

## How It Works

![How it works](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/how-it-works.png)

- **Registration**: on every Pi startup, `{session file absolute path, cwd, pid, processStart, bootId, platform, distro, user, schemaVersion}` is written in real time to `~/.pi/agent/pi-reopen/members/` (one file per session, atomic replacement). Records written by 0.3.0 and earlier under `pi-workspace/` are still read and cleaned.
- **Close detection**: Pi's signal exits also emit a `quit` cleanup event, so the event name alone is not reliable. The extension records SIGHUP/SIGTERM within the TUI lifecycle; a signal-less deliberate `/quit` or session switch deletes the record; reload keeps the record and cleans up listeners. Without a tracked signal it also asks WezTerm whether the current pane still exists (`WEZTERM_PANE`): a vanished pane means the window was closed, so the record is kept. When a hard kill prevents cleanup, the leftover is recorded. On power loss, at most the persisted records are recovered; the latest unflushed changes are not guaranteed.
- **Safe startup**: tabs open concurrently (5 at a time by default); each `wezterm cli spawn` request is aborted with an error after 15s of no response, and 3 consecutive request failures stop early, avoiding long waits when WezTerm is stuck. `--limit` bounds the burst.
- **Deduplication**: before restore, process liveness is checked (pid + start time + bootId; stale PIDs after a reboot are not misjudged), running processes are scanned for `--session <file>` so an unregistered window is not opened twice, and start claims (60s TTL + holder liveness check) reduce duplicate requests. The global restore lock (`restore.lock`, 30-minute TTL + pid liveness + bootId check) is created with `O_EXCL`, so concurrent restores cannot both start a batch; it can be taken over after the lock holder dies or the OS reboots.
- **Verification**: "request accepted" and "pi registered" are reported separately; the confirmation window scales with the batch size (15s + 2s per session, capped at 90s).
- **Titles and hygiene**: tabs are titled with the session name, else the cwd folder name. Records older than 14 days are `expired` and no longer auto-restored; `forget`/`prune` clean up without touching conversation files.
- **Safety**: if preflight (process identity / running WezTerm / Pi / terminal adapter / registry health, plus WSL interop where applicable) fails, nothing is launched in bulk; never auto-sudo; ENOEXEC comes with a fix hint.

## Development & Testing

```bash
# from the repo root
npm test                    # full Linux/WSL regression suite (integration test skipped)
npm run test:platform       # native Linux/macOS/Windows suite
npm run verify-pack         # build the tarball, assert contents, run the unpacked CLI
npm run test:integration    # real WezTerm spawn/title test (needs a running WezTerm)
python3 test/pty-shutdown.py # real Pi PTY: signal keeps the record, /quit removes it
```

```text
extensions/open-all.ts   Pi extension (thin adapter layer): registers live Pis, provides /reopen
src/                     shared core (pure JS ESM, used by both extension and CLI)
  terminals/             terminal adapters (wezterm; see docs/TERMINALS.md)
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/
  launch/spawn/verify/restore/cli/prune/health/inuse/pane/sessions/i18n/version
bin/pi-reopen.js         CLI entry point (run directly with node, no build step)
test/                    Node built-in tests (isolated dirs + injected mocks, no real terminal calls)
docs/                    requirements, status, platforms, terminals, publishing
```

Tests cover core restore, signal handling order, reload cleanup, pane-based close detection, `/reopen recent` picking, non-standard Pi install paths, shell escaping, record merging from the legacy directory, schema gating, i18n and loading after the package moves; tests are isolated via temporary directories and a mock launcher. The test hook `PI_REOPEN_HOOKS` should not be set during normal use.

CI runs the platform suite on Linux/macOS/Windows, the full suite on Linux, the packaged-tarball check and the real Pi PTY lifecycle (it installs the Pi host). CI cannot open a WezTerm GUI, so the real spawn/title test stays opt-in via `PI_REOPEN_INTEGRATION=1`.

Maintainer release steps: see the [publishing guide](docs/PUBLISHING.md) and [CHANGELOG](CHANGELOG.md).

## Feedback and sharing

If this solves your terminal restart workflow, share the [repository](https://github.com/AuthurX/pi-reopen) with other Pi / WezTerm users. [Report recovery problems](https://github.com/AuthurX/pi-reopen/issues) with your OS, Pi/WezTerm versions, and **redacted** `pi-reopen doctor` output. Never upload credentials or private conversation files. See the [outreach drafts and measurement plan](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md).

## Contributors

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## License

[MIT](LICENSE), Copyright (c) 2026 ellieyujin
