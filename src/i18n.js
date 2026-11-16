/**
 * 输出国际化：默认跟随 locale，中文环境用中文，其余用英文（npm 包面向英文用户）。
 * PI_WORKSPACE_LANG=zh|en 可强制指定。
 */
export const LANGS = ["zh", "en"];

export function resolveLang(env = process.env) {
	const explicit = env.PI_WORKSPACE_LANG;
	if (explicit) {
		const value = String(explicit).toLowerCase();
		if (value.startsWith("en")) return "en";
		if (value.startsWith("zh")) return "zh";
	}
	const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || "";
	if (/^zh/i.test(locale)) return "zh";
	return "en";
}

const MESSAGES = {
	// 成员状态
	"state.live": { zh: "运行中", en: "running" },
	"state.claimed": { zh: "启动占用中", en: "start claimed" },
	"state.missing-cwd": { zh: "工作目录缺失", en: "cwd missing" },
	"state.missing-file": { zh: "会话文件缺失", en: "session file missing" },
	"state.in-use": { zh: "已在其他窗口打开", en: "open in another window" },
	"state.duplicate": { zh: "重复条目", en: "duplicate" },
	"state.restorable": { zh: "待恢复", en: "pending restore" },
	"state.expired": { zh: "已过期", en: "expired" },
	"state.filtered": { zh: "未匹配 --only", en: "not matched by --only" },
	"state.deferred": { zh: "本次未处理", en: "deferred" },
	"state.wrong-platform": { zh: "其他平台/发行版", en: "other platform/distro" },

	// 恢复报告
	"restore.preflightHeader": { zh: "环境预检未通过，未打开任何标签页：", en: "Preflight failed; no tabs were opened:" },
	"restore.check": { zh: "  ✖ {name}：{detail}", en: "  ✖ {name}: {detail}" },
	"restore.hint": { zh: "    → {hint}", en: "    → {hint}" },
	"restore.lockedHeader": { zh: "✖ 另一个恢复进程正在进行，本次未打开任何标签页：", en: "✖ Another restore is running; no tabs were opened:" },
	"restore.lockedHolder": { zh: "  → 持有者 pid {pid}，开始于 {ts}", en: "  → holder pid {pid}, started {ts}" },
	"restore.cancelled": { zh: "已取消，未打开任何标签页。", en: "Cancelled; no tabs were opened." },
	"restore.dryRunHeader": { zh: "[dry-run] 待恢复 {n} 个{skipped}", en: "[dry-run] {n} to restore{skipped}" },
	"restore.dryRunItem": { zh: "  → {title} | {cwd}", en: "  → {title} | {cwd}" },
	"restore.claimedItem": { zh: "  ⏭ {title}：其他恢复进程正在启动，跳过", en: "  ⏭ {title}: another restore is starting it, skipped" },
	"restore.deferredItem": { zh: "  ⏭ {title}：本次未处理（超出 --limit，下次可继续）", en: "  ⏭ {title}: deferred by --limit, retry next run" },
	"restore.abortedItem": { zh: "  ⏭ {title}：未尝试（WezTerm 请求连续失败，提前停止）", en: "  ⏭ {title}: not attempted (repeated WezTerm failures, stopped early)" },
	"restore.failedItem": { zh: "  ✖ {title}：WezTerm 请求失败 — {error}", en: "  ✖ {title}: WezTerm request failed — {error}" },
	"restore.verifiedItem": { zh: "  ✔ {title}：已启动并确认（{cwd}）", en: "  ✔ {title}: started and confirmed ({cwd})" },
	"restore.unverifiedItem": { zh: "  ⚠ {title}：已创建标签页，超时未确认 pi 启动（{cwd}）", en: "  ⚠ {title}: tab created, pi start not confirmed in time ({cwd})" },
	"restore.none": { zh: "没有待恢复的会话{skipped}", en: "No sessions to restore{skipped}" },
	"restore.processed": { zh: "已处理 {n} 个{skipped}{aborted}", en: "Processed {n}{skipped}{aborted}" },
	"restore.skipped": { zh: "；跳过：{list}", en: "; skipped: {list}" },
	"restore.skippedItem": { zh: "{label} {n}", en: "{label} {n}" },
	"restore.abortedSuffix": { zh: "（已提前停止）", en: " (stopped early)" },

	// CLI
	"cli.version": { zh: "pi-reopen {version}", en: "pi-reopen {version}" },
	"cli.usage": {
		zh: `pi-reopen — 恢复上次的 Pi 终端组合

用法：
  pi-reopen                       # 补开上次关闭时仍打开的 Pi（已运行的跳过）
  pi-reopen restore [选项]        # 显式恢复；选项见下
  pi-reopen --dry-run             # 等价于 restore --dry-run
  pi-reopen --help | --version    # 用法 / 版本号
  pi-reopen list [--wide|--json]  # 查看登记成员与状态
  pi-reopen forget <id|前缀> ...  # 删除指定登记（不删除对话文件）
  pi-reopen prune [--dry-run]     # 清理过期/无法恢复的记录（默认保留最近 14 天）
  pi-reopen doctor                # 环境检查（平台 / WezTerm / pi / 进程身份）
  pi-reopen clear                 # 清空登记（不删除对话文件）

restore 选项：
  --dry-run            只打印计划，不开标签页
  --no-wait            发出请求后立即返回，不等待 pi 登记确认
  --json               输出机器可读的 JSON（便于脚本消费）
  --only <模式>        只恢复匹配的会话；子串或 * 通配符，可重复/逗号分隔
  --limit <N>          本次最多开 N 个标签页（其余保留待下次）
  --delay <ms>         每个标签页之间等待的毫秒数（缓解批量启动压力）
  --yes                跳过批量确认提示（超过 5 个时默认会询问）

每个 wezterm cli spawn 请求超过 15s 无响应会终止并报失败，连续 3 次请求失败提前停止；
默认在全部请求发出后等待各 pi 启动并登记再报告，--no-wait 跳过该等待。

退出码：0 成功；1 请求失败/用法错误；2 预检失败；3 请求已发但未确认；4 仅有跳过项。`,
		en: `pi-reopen — reopen the Pi sessions you had open

Usage:
  pi-reopen                       # reopen Pis that were open at last close (running ones skipped)
  pi-reopen restore [options]     # explicit restore, see options below
  pi-reopen --dry-run             # same as restore --dry-run
  pi-reopen --help | --version    # usage / version
  pi-reopen list [--wide|--json]  # list registered members and their state
  pi-reopen forget <id|prefix>... # drop specific records (conversation files untouched)
  pi-reopen prune [--dry-run]     # drop expired/unrecoverable records (keeps the last 14 days)
  pi-reopen doctor                # environment check (platform / WezTerm / pi / identity)
  pi-reopen clear                 # clear all records (conversation files untouched)

restore options:
  --dry-run            print the plan only, open no tabs
  --no-wait            return after requesting tabs, without waiting for registration
  --json               machine-readable JSON output
  --only <pattern>     restore only matching sessions; substring or * glob, repeatable/comma-separated
  --limit <N>          open at most N tabs this run; the rest stay for next time
  --delay <ms>         wait between tab requests to soften large bursts
  --yes                skip the bulk confirmation prompt (asked above 5 sessions)

Each 'wezterm cli spawn' request is aborted after 15s; 3 consecutive failures stop early.
By default it waits for every pi to start and register before reporting; --no-wait skips that.

Exit codes: 0 ok; 1 request failed/usage error; 2 preflight failed; 3 requested but unconfirmed; 4 skipped only.`,
	},
	"cli.confirmBulk": { zh: "将打开 {n} 个标签页：", en: "About to open {n} tab(s):" },
	"cli.forgetUsage": { zh: "用法：pi-reopen forget <会话 id 或唯一前缀> [...]", en: "Usage: pi-reopen forget <session id or unique prefix> [...]" },
	"cli.forgetAmbiguous": { zh: "✖ 前缀「{input}」有歧义，匹配：{candidates}", en: "✖ Prefix \"{input}\" is ambiguous, matches: {candidates}" },
	"cli.forgetRemoved": { zh: "已移除 {n} 条登记{missing}", en: "Removed {n} record(s){missing}" },
	"cli.forgetMissing": { zh: "；未找到：{list}", en: "; not found: {list}" },
	"cli.pruneItem": { zh: "  − {title}：{cwd}", en: "  − {title}: {cwd}" },
	"cli.pruneDryRun": { zh: "[dry-run] 将清理 {n} 条记录{kept}", en: "[dry-run] would remove {n} record(s){kept}" },
	"cli.pruneDone": { zh: "已清理 {n} 条记录{kept}", en: "Removed {n} record(s){kept}" },
	"cli.pruneKept": { zh: "；保留 {n} 条", en: "; kept {n}" },
	"cli.clear": { zh: "已清空 {n} 条登记与启动占用；对话文件与旧格式记录未删除。", en: "Cleared {n} record(s) and start claims; conversation files and legacy records were left alone." },
	"cli.doctorReady": { zh: "环境就绪。", en: "Environment ready." },
	"cli.doctorBlocked": { zh: "存在未通过项，恢复前需先解决。", en: "Unresolved checks; fix them before restoring." },
	"cli.doctorCheck": { zh: "{mark} {name}：{detail}", en: "{mark} {name}: {detail}" },
	"cli.binfmtWarning": { zh: "⚠ WSLInterop 已注册但未持久化：", en: "⚠ WSLInterop is registered but not persisted:" },
	"cli.listEmpty": {
		zh: "没有登记成员。关闭 WezTerm 时仍打开的 Pi 会在下次启动后自动登记。",
		en: "No registered members. Pis still open when WezTerm closes are recorded on their next start.",
	},
	"cli.listState": { zh: "状态", en: "STATE" },
	"cli.listSession": { zh: "会话", en: "SESSION" },
	"cli.listPath": { zh: "路径", en: "PATH" },
	"cli.listTime": { zh: "时间", en: "TIME" },

	// 启动
	"spawn.timeout": {
		zh: "wezterm cli 超过 {ms}ms 无响应（WezTerm 可能已卡死），已终止该请求",
		en: "wezterm cli did not respond within {ms}ms (WezTerm may be hung); request aborted",
	},
	"spawn.exitCode": { zh: "wezterm cli 退出码 {code}", en: "wezterm cli exited with code {code}" },
	"spawn.unsupportedPlatform": { zh: "不支持的平台：{platform}", en: "Unsupported platform: {platform}" },
	"windows.noPiCommand": { zh: "Windows Pi 启动命令未经预检", en: "Windows Pi command was not preflighted" },

	// 预检
	"pf.platform": { zh: "运行平台", en: "Platform" },
	"pf.platformHint": { zh: "支持 Linux、macOS、Windows 和 WSL", en: "Supported: Linux, macOS, Windows and WSL" },
	"pf.distro": { zh: "WSL 发行版", en: "WSL distro" },
	"pf.distroUnset": { zh: "未设置", en: "not set" },
	"pf.distroHint": { zh: "缺少 WSL_DISTRO_NAME，无法定向启动标签页", en: "WSL_DISTRO_NAME is missing; cannot target the tab" },
	"pf.interop": { zh: "WSL 互操作套接字", en: "WSL interop socket" },
	"pf.interopHint": { zh: "未找到 /run/WSL，WSL 互操作未启用（检查 wsl.conf 的 interop 设置）", en: "/run/WSL is missing; WSL interop is disabled (check interop in wsl.conf)" },
	"pf.identity": { zh: "进程身份检测", en: "Process identity" },
	"pf.identityUnavailable": { zh: "不可用", en: "unavailable" },
	"pf.identityHint": {
		zh: "无法可靠检测存活进程，停止恢复以避免重复打开；检查 procfs / sysctl、ps / PowerShell、CIM 权限",
		en: "Cannot detect live processes reliably; refusing to restore to avoid duplicates. Check procfs/sysctl, ps/PowerShell and CIM permissions",
	},
	"pf.wezterm": { zh: "WezTerm 程序", en: "WezTerm binary" },
	"pf.weztermMissing": { zh: "未找到", en: "not found" },
	"pf.weztermExplicitMissing": { zh: "指定的文件不存在：{path}", en: "specified file does not exist: {path}" },
	"pf.weztermHint": { zh: "未找到 WezTerm；可用环境变量 PI_WORKSPACE_WEZTERM 指定完整路径", en: "WezTerm not found; set PI_WORKSPACE_WEZTERM to its full path" },
	"pf.weztermExplicitHint": { zh: "检查 PI_WORKSPACE_WEZTERM 环境变量或传入的路径", en: "Check the PI_WORKSPACE_WEZTERM variable or the supplied path" },
	"pf.weztermExec": { zh: "WezTerm 程序执行", en: "WezTerm executes" },
	"pf.weztermExecOk": { zh: "ok", en: "ok" },
	"pf.weztermExecEnoexec": { zh: "Exec format error (ENOEXEC)", en: "Exec format error (ENOEXEC)" },
	"pf.weztermExecEnoexecHint": { zh: "WSLInterop 未注册，Windows 程序无法从 WSL 启动。", en: "WSLInterop is not registered; Windows programs cannot start from WSL." },
	"pf.weztermExecHint": { zh: "WezTerm 无法执行；确认安装完整且适用于当前平台", en: "WezTerm cannot execute; verify the install matches this platform" },
	"pf.weztermInstance": { zh: "WezTerm 运行实例", en: "WezTerm instance" },
	"pf.weztermInstanceOk": { zh: "已连接", en: "connected" },
	"pf.weztermInstanceHint": { zh: "请先打开本机 WezTerm；检查 WEZTERM_UNIX_SOCKET 是否指向当前实例", en: "Start WezTerm first; check that WEZTERM_UNIX_SOCKET points at the current instance" },
	"pf.pi": { zh: "pi 命令", en: "pi command" },
	"pf.piHint": {
		zh: "请先安装 pi 并加入 PATH，或设置 PI_WORKSPACE_PI_BIN 为当前系统内可执行文件的绝对路径（不含参数、别名或 Shell 函数）",
		en: "Install pi and put it on PATH, or set PI_WORKSPACE_PI_BIN to an absolute executable path (no arguments, aliases or shell functions)",
	},
	"pf.powershell": { zh: "Windows PowerShell", en: "Windows PowerShell" },
	"pf.powershellHint": { zh: "需要 Windows PowerShell 5.1，供启动和进程身份检测使用", en: "Windows PowerShell 5.1 is required for launching and identity checks" },

	// binfmt 持久化
	"binfmt.persistHint": {
		zh: "WSLInterop 注册可能在 WSL 重启后再次丢失（未发现 binfmt.d 持久化配置）。\n一次性持久化（需 sudo 密码，工具不会自动执行）：\nprintf '%s\\n' ':WSLInterop:M::MZ::/init:PF' | sudo tee /usr/lib/binfmt.d/WSLInterop.conf >/dev/null\necho -1 | sudo tee /proc/sys/fs/binfmt_misc/WSLInterop >/dev/null\nsudo systemctl restart systemd-binfmt",
		en: "The WSLInterop registration may disappear after a WSL restart (no binfmt.d entry found).\nOne-time persistence (needs sudo; this tool never runs it for you):\nprintf '%s\\n' ':WSLInterop:M::MZ::/init:PF' | sudo tee /usr/lib/binfmt.d/WSLInterop.conf >/dev/null\necho -1 | sudo tee /proc/sys/fs/binfmt_misc/WSLInterop >/dev/null\nsudo systemctl restart systemd-binfmt",
	},

	// Pi 内入口
	"ext.recentNone": { zh: "近 24 小时没有可补选的对话{skipped}", en: "No conversations from the last 24h to pick up{skipped}" },
	"ext.recentSkippedCwd": { zh: "（{n} 个工作目录已不存在，已跳过）", en: " ({n} working directories no longer exist, skipped)" },
	"ext.recentPrompt": { zh: "近期候选（不代表原先打开的窗口）{skipped}\n{list}\n输入序号，多个用逗号分隔；取消则不打开", en: "Recent candidates (not the windows you had open){skipped}\n{list}\nEnter indexes separated by commas; cancel to skip" },
	"ext.invalidIndex": { zh: "序号无效，未打开标签页", en: "Invalid index; no tabs opened" },
	"ext.confirmRecent": { zh: "恢复选中的 Pi 对话？", en: "Restore the selected Pi conversations?" },
	"ext.locked": { zh: "另一个恢复进程正在进行，本次未打开标签页", en: "Another restore is running; no tabs opened" },
	"ext.spawnFailed": { zh: "{cwd}：WezTerm 请求失败 — {error}", en: "{cwd}: WezTerm request failed — {error}" },
	"ext.recentOpened": { zh: "已请求打开 {n} 个 pi 终端", en: "Requested {n} pi terminal(s)" },
	"ext.recentOpenedVerified": { zh: "已请求打开 {n} 个 pi 终端，已确认启动", en: "Requested {n} pi terminal(s), start confirmed" },
	"ext.recentOpenedUnverified": { zh: "已请求打开 {n} 个 pi 终端；{m} 个超时未确认启动", en: "Requested {n} pi terminal(s); {m} not confirmed in time" },
	"ext.noneOpened": { zh: "没有打开任何标签页", en: "No tabs opened" },
	"ext.clear": { zh: "已清空 {n} 条登记；对话文件未删除", en: "Cleared {n} record(s); conversation files untouched" },
	"ext.reopenUsage": { zh: "用法：/reopen | /reopen recent | /reopen clear", en: "Usage: /reopen | /reopen recent | /reopen clear" },
	"ext.aliasNotice": { zh: "/all 已改名为 /reopen", en: "/all was renamed to /reopen" },
	"ext.confirmBulkTitle": { zh: "将打开 {n} 个标签页", en: "About to open {n} tab(s)" },
};

export function t(lang, key, params = {}) {
	const entry = MESSAGES[key];
	if (!entry) return key;
	const template = entry[lang] ?? entry.en ?? entry.zh ?? key;
	return template.replace(/\{(\w+)\}/g, (match, name) =>
		Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

export { MESSAGES };
