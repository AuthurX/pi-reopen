# 平台支持

0.3.0 新增原生 Linux、macOS、Windows 启动路径，保留 WSL。旧版 npm 0.2.0 不具备这些能力。

## 运行条件

| 环境 | 终端目标 | Pi 启动方式 | 进程身份 |
| --- | --- | --- | --- |
| Linux | 本机 WezTerm | Bash 登录环境 + exec Pi | procfs boot_id + 进程 starttime |
| macOS | 本机 WezTerm | Bash 登录环境 + exec Pi | sysctl kern.boottime + ps lstart |
| Windows 原生 | 本机 WezTerm | Windows PowerShell + 原生 Pi | CIM LastBootUpTime + Get-Process StartTime |
| WSL | Windows WezTerm | wsl.exe 定向发行版 + Bash | Linux procfs |

- 首次安装后运行 `pi-reopen setup`，按输出完成 PATH、`/reload`、版本与重复入口检查。恢复时先打开 WezTerm，再运行 `pi-reopen doctor` 和 `pi-reopen`。不自动拉起 GUI，不恢复远程 SSH 域。
- CLI 与 Pi 扩展必须运行在同一系统、同一用户下，并使用相同 `PI_CODING_AGENT_DIR`。Windows 与 WSL 不共用登记目录；本功能不是跨机器会话迁移。
- WezTerm 必须是本机安装的可执行程序。Flatpak/Snap 沙箱、容器、远程 mux 不在本轮验收范围。
- Linux/macOS 使用 Bash 执行启动脚本，不要求用户交互 Shell 是 Bash。依赖仅在 zsh/fish 中初始化时，需把 Pi 放入调用方 PATH，或设置 `PI_REOPEN_PI_BIN`。
- macOS 会自动查找 PATH、Homebrew 和 `/Applications/WezTerm.app/Contents/MacOS/wezterm`；其他位置可显式配置。
- Windows 需要系统 Windows PowerShell 5.1 和 CIM 权限；不自动修改执行策略。Pi 的 Bash 工具还需要 Git for Windows。Pi 官方建议 WezTerm 使用近期 nightly，旧版 Windows conhost 存在 TUI 兼容问题。

## Windows Pi 入口

自动查找 PATH 中的 `pi.exe` 或 `pi.cmd`。npm `pi.cmd` 从其相邻的 `node_modules/@earendil-works/pi-coding-agent/package.json` 解析 `bin.pi`，使用原生 Node 直接启动，不通过 `cmd.exe` 拼接命令。

自定义安装布局、pnpm shim 等无法识别时，指定包的 JS 入口或原生 `.exe`：

```powershell
$env:PI_REOPEN_WEZTERM = 'C:\Program Files\WezTerm\wezterm.exe'
$env:PI_REOPEN_PI_BIN = 'C:\your-install\pi-coding-agent\dist\cli.js'
node .\bin\pi-reopen.js doctor
```

路径是示例，需替换为实际位置。环境变量不接受额外参数、别名或函数。PowerShell 启动脚本采用 UTF-16LE 编码参数和单引号字面量，避免路径中的空格、单引号、`$`、`&`、`%` 被展开。编码不是加密；命令中仅传递必要路径和 PATH，不传递认证配置。

## 可靠性边界

- 预检会确认本机进程身份可读取、WezTerm 运行实例可连接；失败不批量启动。
- 所有平台继续区分“请求被接受”与“Pi 登记确认”。`--no-wait` 不代表启动已确认。
- macOS `ps lstart` 精度为秒，低于 Linux/Windows 的进程创建时间精度；同一秒内极端 PID 重用仍有误判可能。
- Windows 的进程查询会启动 PowerShell，速度比 Linux 读取 procfs 慢；大量会话需要额外性能验收。
- 关闭事件由 Pi 与终端/ConPTY 共同决定。SIGHUP/SIGTERM 保留记录，主动 `/quit` 删除记录；没有受跟踪信号时再查询 `WEZTERM_PANE` 是否还存在（pane 消失=关窗，保留记录）。Windows/macOS 的真实关窗行为仍需实机验证。
- WSL 下 `WEZTERM_PANE` 不会自动进入发行版：需在 Windows 侧 `WSLENV` 中加入 `WEZTERM_PANE`（保留已有值；`pi-reopen setup` 会给出 PowerShell 示例，改后重启 WezTerm 生效）。缺失时 pane 探测不可用，`PI_REOPEN_FORGET_ON_TAB_CLOSE` 退化为“总是保留记录”。`setup` 和 `doctor` 都会单独报告“WSL 单标签关闭识别”是否可用；该缺失以警告显示，不阻塞普通恢复。工具只提示命令，不自动执行 `setx` 或修改系统配置。扩展的 pane 探测与 CLI 使用同一发现逻辑：显式 `PI_REOPEN_WEZTERM` 优先，否则自动查找（WSL 下找 Windows 侧 wezterm.exe，不会误用发行版内的 wezterm）。
- 全局恢复锁与启动声明使用 `O_EXCL` 原子创建，接管前复核记录；8 进程并发测试验证恰好一个赢家。仍不承诺跨版本（旧 CLI 写旧锁目录）的互斥。
- 恢复前扫描运行中进程的 `--session <文件>`；即使扩展未加载或记录被清空，也不会对同一会话文件开第二个 Pi。
- 记录带 `platform/distro/user/schemaVersion`；其他平台/发行版的记录会被跳过，比 CLI 更新的记录结构不参与恢复。
- 扩展不限制 Pi 主版本（peer 只有下限 `>=1.5.0`，新版 Pi 直接可装）：登记前检测 `ctx.sessionManager.getSessionFile/getSessionId`，API 变更时提示一次并停止登记（不会静默失效）。
- 标签页并发打开（默认同时 5 个）；确认窗口 15s + 2s/会话（上限 90s），`--limit` 可进一步限流。

## 验证

```text
npm test                 Linux/WSL 完整回归集
npm run test:platform    原生三平台测试集（含真实主机进程身份、锁回收、扩展生命周期）
```

`.github/workflows/test.yaml` 在 Linux/macOS/Windows 上运行原生测试集，在 Linux 上额外运行完整回归。Windows runner 还会真正执行 PowerShell 路径往返测试。CI 不打开 WezTerm GUI，因此不能替代以下验收：

1. A、B、C 三个 Pi 发消息落盘，主动 `/quit` B，再关闭 WezTerm。
2. 重开 WezTerm，`doctor` 通过后恢复，只启动 A、C；对话、工作目录一致，等待用户输入。
3. 再执行恢复，不重复启动；分别从 CLI、`/reopen`、`/reopen recent` 验证。
4. 使用中文、空格、单引号、`$` 等路径重复操作。
5. 系统重启、强杀 Pi、缺失会话文件、WezTerm 不运行时检查诊断。
6. 在 Windows/macOS 上验证快捷键、关窗信号与大量会话性能。

正式发布通过复用此测试工作流，等待三平台检查全部成功后才上传 npm。本机测试不能替代跨平台 CI；CI 也不能替代尚未完成的 macOS/Windows 真实 GUI 关窗与恢复验收。

## 参考

- [WezTerm cli spawn](https://wezterm.org/cli/cli/spawn.html)
- [WezTerm CLI 实例选择](https://wezterm.org/cli/cli/index.html)
- [Pi Windows 支持说明](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/windows.md)
