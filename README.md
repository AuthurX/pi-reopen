# pi-reopen

<p align="center">
  <a href="https://github.com/AuthurX/pi-workspace/blob/main/README.md">English</a> | <a href="https://github.com/AuthurX/pi-workspace/blob/main/README.zh-CN.md">简体中文</a>
</p>

**Reopen your Pi terminals after WezTerm closes.**

![preview](https://raw.githubusercontent.com/AuthurX/pi-workspace/main/assets/preview.png)

A [Pi](https://github.com/earendil-works/pi) package: the extension registers open Pis in real time, and the `pi-reopen` CLI reopens them as [WezTerm](https://wezm.dev/) tabs.

## Requirements

- **Linux / macOS / native Windows + local WezTerm**, or **WSL + Windows WezTerm**
- Node ≥ 22.19, with [Pi](https://github.com/earendil-works/pi) installed in the same OS environment
- Open WezTerm before restoring; this tool adds tabs to a running instance, not a remote SSH domain
- Linux/macOS/WSL require Bash. Native Windows requires Windows PowerShell 5.1 (including CIM); install Git for Windows for Pi's Bash tool, and prefer a recent WezTerm nightly
- WSL restore uses the distro's default user; run this tool as that user. Do not share one registry between native Windows and WSL

Version 0.3.0 adds native platform support. Release checks run on Linux, macOS and Windows; macOS/Windows GUI close/reopen acceptance still needs real-machine verification. See [platform notes](docs/PLATFORMS.md).

## Usage

```bash
pi-reopen
```

```text
  ✔ pi-workspace：已启动并确认（/home/ellie/work/MY/code/pi-workspace）
  ⚠ other-proj：已创建标签页，超时未确认 pi 启动（/home/ellie/work/other-proj）
已处理 2 个
```

CLI output is in Simplified Chinese:

| Output | Meaning |
| --- | --- |
| `✔ 已启动并确认` | launched and confirmed |
| `⚠ 已创建标签页，超时未确认 pi 启动` | tab created, but pi start confirmation timed out |
| `已处理 N 个` | N processed |

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
| `pi-reopen list` | List registered members and status; long content is truncated to terminal width by default |
| `pi-reopen list --wide` | No truncation |
| `pi-reopen doctor` | Environment check (platform / process identity / running WezTerm / pi; WSL interop when applicable) |
| `pi-reopen clear` | Clear the registry and start claims (does not delete conversation files or legacy-format records) |

`list` statuses (labels in Chinese): running (运行中) / pending restore (待恢复) / start claimed (启动占用中) / working directory missing (工作目录缺失) / session file missing (会话文件缺失) / duplicate entry (重复条目).

Exit codes: 0 success; 1 restore failed or unknown command; 2 environment preflight failed.

## Installation

### From npm

Use the full package name `@ellieyujin/pi-reopen` with the stable `latest` dist-tag. The unscoped `pi-workspace` on npm is a different author's project.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen doctor
```

- `pi install` registers and loads the extension, but does not guarantee the CLI is on a regular shell's PATH; `npm install -g` installs the external CLI (the npm global bin directory must also be on PATH)
- The CLI does not depend on Pi's peer packages, hence `--omit=peer` to avoid installing the host as well; the two installs must be updated separately and kept at the same version

**Registration requires the extension**: installing only the CLI cannot record sessions. After install, run `/reload` or restart in each already-open Pi; a fresh install cannot precisely recover previously unregistered windows. Do not load an old `open-all.ts` copy/symlink at the same time as the package; before migrating, check `pi list` and the personal extension directory, disable the old entry only, and do not delete session or auth files.

### From source

The following commands run on Linux/macOS/WSL and install the currently checked-out source:

```bash
git clone https://github.com/AuthurX/pi-workspace.git
cd pi-workspace
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
pi install git:github.com/AuthurX/pi-workspace
```

## Optional Configuration

| Environment variable | Purpose |
| --- | --- |
| `PI_WORKSPACE_WEZTERM` | Absolute path of local WezTerm (`wezterm` / `wezterm.exe`); in WSL use its Windows path, e.g. `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_WORKSPACE_PI_BIN` | Absolute Pi executable path, no arguments; Windows accepts npm `pi.cmd`, the package's JS entry, or `.exe`; aliases/functions are unsupported |
| `PI_CODING_AGENT_DIR` | Use a different Pi config/registry directory; CLI and extension must stay consistent |
| `PI_WORKSPACE_SRC` | Development only: overrides the shared `src/` directory; not needed for normal package installs |

For example, if Pi is installed via nvm, pnpm, or a custom npm prefix, set it explicitly:

```bash
export PI_WORKSPACE_PI_BIN="$(type -P pi)"
export PI_WORKSPACE_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

On Linux/macOS/WSL, Pi is located from PATH and the Bash login environment. Native Windows resolves `pi.exe` or npm's `pi.cmd` from PATH; npm shims are resolved to Node + the installed package entry, avoiding `cmd.exe` quoting and PowerShell script-policy issues. Nonstandard Windows shims require an explicit JS entry or `.exe`. Restored tabs receive the caller's PATH and agent directory, not the full environment or authentication data. WezTerm discovery checks platform-specific PATH and common install locations; only WSL uses `where.exe` + `wslpath`. For custom layouts set an explicit path. Restart Pi after changing environment variables; `/reload` does not read the parent shell's new environment.

## How It Works

![How it works](https://raw.githubusercontent.com/AuthurX/pi-workspace/main/assets/how-it-works.png)

- **Registration**: on every Pi startup, `{session file absolute path, cwd, pid, processStart, bootId}` is written in real time to `~/.pi/agent/pi-workspace/members/` (one file per session, atomic replacement).
- **Close detection**: Pi's signal exits also emit a `quit` cleanup event, so the event name alone is not reliable. The extension records SIGHUP/SIGTERM within the TUI lifecycle: signal exits keep the record; a signal-less deliberate `/quit` or session switch deletes the record; reload keeps the record and cleans up listeners. When a hard kill prevents cleanup, the leftover is recorded. On power loss, at most the persisted records are recovered; the latest unflushed changes are not guaranteed.
- **Safe startup**: each `wezterm cli spawn` request is aborted with an error after 15s of no response, and 3 consecutive request failures stop early, avoiding long waits when WezTerm is stuck; by default it waits for all pis to start and register before reporting, `--no-wait` skips this.
- **Deduplication**: before restore, process liveness is checked (pid + start time + bootId; stale PIDs after a reboot are not misjudged), and start claims (60s TTL + holder liveness check) reduce duplicate requests. A global restore lock (`restore.lock`, 30-minute TTL + pid liveness + bootId check) rejects concurrent restores; it can be taken over after the lock holder dies or the OS reboots.
- **Safety**: if preflight (process identity / running WezTerm / Pi, plus WSL interop where applicable) fails, nothing is launched in bulk; never auto-sudo; ENOEXEC comes with a fix hint; "tab created" and "pi start confirmed" are reported separately.

## Development & Testing

```bash
# from the repo root
npm test                 # full Linux/WSL regression suite
npm run test:platform    # native Linux/macOS/Windows suite
npm pack --dry-run
```

```text
extensions/open-all.ts   Pi extension (thin adapter layer): registers live Pis, provides /reopen
src/                     shared core (pure JS ESM, used by both extension and CLI)
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/launch/spawn/verify/restore/cli
bin/pi-reopen.js         CLI entry point (run directly with node, no build step)
test/                    Node built-in tests (isolated dirs + injected mocks, no real terminal calls)
docs/                    requirements and status
```

Tests cover core restore, signal handling order, reload cleanup, `/reopen recent` picking, non-standard Pi install paths, shell escaping, and loading after the package moves; tests are isolated via temporary directories and a mock launcher. The test hook `PI_WORKSPACE_HOOKS` should not be set during normal use.

Optional Pi PTY test: `python test/pty-shutdown.py`. Uses a temporary config and session, checking that signal exits keep the member and a deliberate `/quit` removes it; no model calls, no visible tabs.

Maintainer release steps: see the [publishing guide](docs/PUBLISHING.md).

## Contributors

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## License

[MIT](LICENSE), Copyright (c) 2026 ellieyujin
