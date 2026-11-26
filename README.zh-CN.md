# pi-reopen — 重开 WezTerm 后恢复 Pi 会话

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Pi 扩展目录](https://pi.dev/packages/@ellieyujin/pi-reopen) · [版本发布](https://github.com/AuthurX/pi-reopen/releases)

**一条命令恢复之前打开的 Pi coding agent 会话、工作目录与对话，不必逐个寻找历史记录。**

![Pi 会话恢复预览](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/preview.zh.png)

一个 [Pi](https://github.com/earendil-works/pi) 扩展 + CLI，面向**关闭终端后的会话恢复（session resume / restore）**：实时登记打开的 Pi，通过 [WezTerm](https://wezterm.org/) 重新开成标签页，跳过仍在运行的会话。

## 恢复一个会话，还是恢复整个工作区？

| 需求 | 使用方式 |
| --- | --- |
| 继续当前目录最近的会话 | Pi 原生 `pi -c` |
| 从历史对话中选择一个 | Pi 原生 `pi -r` 或 `/resume` |
| 重开 WezTerm 后恢复跨项目的已登记 Pi 会话 | `pi-reopen` |
| 先预览，不打开标签页 | `pi-reopen restore --dry-run` |

它负责**重新启动进程并加载原对话**，不是历史会话选择器，也不会恢复运行中的工具、未保存状态、分屏几何布局或其他 Shell 程序。主动退出 Pi 会移除登记。它不会在启动 WezTerm 时自动执行；重开终端后运行 `pi-reopen` 即可。

## 怎么用：把它当浏览器标签页

| 浏览器 | pi-reopen |
| --- | --- |
| 退出时还开着的 tab | 关 WezTerm 时还活着的 Pi 会话 |
| 下次启动把开着的 tab 找回来 | `pi-reopen` 把保留的记录开成新 tab |
| 自己关掉的 tab 不进恢复列表 | `ctrl+w` 关掉的 tab 默认被遗忘（Pi 内 `/quit` 则总是遗忘） |
| Ctrl+Shift+T"最近关闭" | `/reopen recent`——最近 24 小时，没有记录也能捞 |
| 崩溃 → "要恢复吗?" | 崩溃 / 关整个 WezTerm / WSL 关机 → 全部保留，`pi-reopen` 全捞回来 |

一句话记住：**开着 = 留，关掉 = 放走**。不用做任何标记——留着 tab 就是"我要它"，关掉就是"我干完了"。（默认：关 tab 即移出恢复列表，浏览器式行为；设置 `PI_REOPEN_FORGET_ON_TAB_CLOSE=0` 可总是保留记录。）

## 适用场景与平台支持

**适合这样的工作方式：你在 WezTerm 中为多个项目打开了 Pi 会话，关闭终端后，希望一次找回这些已登记会话的工作目录和对话。** 重新打开 WezTerm，再运行 `pi-reopen`，即可将待恢复会话重新开成标签页。

| 运行环境 | 支持状态 | 会话恢复位置 |
| --- | --- | --- |
| Linux 原生 | 已实现 | Linux 本机 WezTerm 的新标签页 |
| macOS 原生 | 已实现 | Mac 本机 WezTerm 的新标签页 |
| Windows 原生 | 已实现 | Windows 本机 WezTerm 的新标签页，运行 Windows 原生 Pi |
| WSL | 已实现 | Windows WezTerm 的新标签页，通过对应 WSL 发行版启动 Pi |
| FreeBSD 等其他系统 | 暂不支持 | 恢复预检会拒绝未支持的平台 |

**目前只支持恢复到本机 WezTerm**，不支持恢复到 Windows Terminal、iTerm2、VS Code 集成终端或 tmux。PowerShell、Bash、zsh 等是 Shell，不是恢复目标终端；使用 PowerShell 运行命令仍需先打开 WezTerm。Windows 原生与 WSL 是两套独立环境，不能用一侧的安装恢复另一侧的会话，也不支持跨机器迁移。

“已实现”表示已有对应平台的恢复代码，不代表所有实机场景均已验收；验证范围与限制见[平台说明](docs/PLATFORMS.md)。

## 快速开始

唯一维护的 npm 包为 `@ellieyujin/pi-reopen`，CLI 命令仍为 `pi-reopen`。

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

`setup` 会集中检查扩展安装来源、当前是否仍有扩展进程运行、全局 CLI 与 PATH、两侧版本及重复旧入口，并按当前平台列出下一步命令。它只读检查，不会执行 `sudo`、`setx` 或修改任何系统配置。

在已有 Pi 会话中运行 `/reload` 开始登记。关闭并重新打开 WezTerm 后：

```bash
pi-reopen restore --dry-run
pi-reopen
```

切换包名前请阅读[安装与迁移说明](#安装)。

## 环境要求

- **Linux / macOS / Windows 原生 + 本机 WezTerm**，以及 **WSL + Windows WezTerm**
- Node ≥ 22.19，在同一系统环境内安装 [Pi](https://github.com/earendil-works/pi)
- 恢复前先打开 WezTerm；本工具向运行中的实例添加标签页，不向远程 SSH 域恢复
- Linux/macOS/WSL 需要 Bash；Windows 原生需要 Windows PowerShell 5.1（含 CIM），并为 Pi 的 Bash 工具安装 Git for Windows；建议使用近期 WezTerm nightly
- WSL 恢复使用发行版默认用户，请以该用户运行；不要让 Windows 原生与 WSL 共用同一登记目录

1.0.0 为第一个稳定版。CI 在 Linux/macOS/Windows 上跑平台测试，并在 Linux 上跑完整回归、打包校验和真实 Pi PTY 生命周期；macOS/Windows 的真实关窗与恢复仍需实机验收，详见[平台说明](docs/PLATFORMS.md)。

## 使用

```bash
pi-reopen
```

```text
  ✔ pi-workspace：已启动并确认（/home/ellie/work/MY/code/pi-workspace）
  ⚠ other-proj：已创建标签页，超时未确认 pi 启动（/home/ellie/work/other-proj）
已处理 2 个
```

输出跟随 locale：`zh_*` 用中文，其余默认英文；可用 `PI_REOPEN_LANG=zh|en` 强制指定。

| 输出 | 含义 |
| --- | --- |
| `✔ 已启动并确认` | 已启动并确认 |
| `⚠ 已创建标签页，超时未确认 pi 启动` | 标签页已创建，但未在窗口内确认 pi 启动 |
| `已处理 N 个` | 本次处理 N 个 |

Pi 内等价入口：

- `/reopen` — 恢复已登记的 Pi
- `/reopen recent` — 从近 24 小时的对话历史补选（适用于未登记的窗口）
- `/reopen clear` — 清空登记（不删除对话文件）
- `Ctrl+Shift+O` — 一键恢复

`/all` 仍可用作 `/reopen` 的过渡别名（会提示改名）。

## 命令

| 命令 | 说明 |
| --- | --- |
| `pi-reopen`（即 `pi-reopen restore`） | 补开上次关闭时仍打开的 Pi；运行中的跳过 |
| `pi-reopen restore --dry-run` | 只打印计划，不开标签页 |
| `pi-reopen restore --no-wait` | 发出请求后立即返回，不等待 pi 登记确认 |
| `pi-reopen restore --only <模式>` | 只恢复匹配的会话（子串、`*` 通配符或当前列表序号；匹配名称、路径、id） |
| `pi-reopen restore --interactive` | 显示当前列表，输入序号选择要恢复的会话 |
| `pi-reopen restore --limit <N>` | 本次最多开 N 个标签页，其余留待下次 |
| `pi-reopen restore --json` | 输出机器可读的 JSON |
| `pi-reopen list [--wide\|--json]` | 列出登记成员与状态；长内容默认按终端宽度截断 |
| `pi-reopen show <序号\|id\|前缀> ...` | 查看指定会话的状态、路径、会话文件与登记信息 |
| `pi-reopen forget <序号\|id\|前缀> ...` | 删除指定登记（不删除对话文件） |
| `pi-reopen prune [--dry-run]` | 清理过期/无法恢复的记录（默认保留最近 14 天） |
| `pi-reopen setup` | 引导式首次安装检查；只提示命令，不修改系统配置 |
| `pi-reopen doctor` | 环境与登记健康检查（含扩展进程身份、版本一致性与 WSL 单标签关闭识别） |
| `pi-reopen clear` | 清空登记与启动占用（不删除对话文件与旧格式记录） |
| `pi-reopen --help` / `--version` | 用法 / 版本号 |

`list` 的 `#` 是**当前列表快照中的序号，不是稳定 ID**。每次命令都按最新列表的相同顺序重新解析；列表增删或时间顺序变化后，应先重新运行 `pi-reopen list`。纯数字输入优先解释为序号，会话 ID 或唯一前缀仍可使用。

```bash
pi-reopen list
pi-reopen restore --only 1,3 --dry-run
pi-reopen show 2
pi-reopen forget 2
pi-reopen restore --interactive
```

`list` 状态：运行中 / 启动占用中 / 待恢复 / 已过期 / 已在其他窗口打开 / 工作目录缺失 / 会话文件缺失 / 未匹配 `--only` / 本次未处理（超出 `--limit`）/ 其他平台或发行版 / 重复条目。

退出码：0 成功；1 恢复请求失败或未知命令；2 环境预检失败；3 请求已发出但未确认；4 仅有跳过项（被占用/超出 limit）。

## 安装

### 从 npm 安装

使用 `@ellieyujin/pi-reopen` 和稳定版 `latest` dist-tag。无 scope 的 `pi-reopen` 已撤包；无 scope 的 `pi-workspace` 属于其他作者的项目。

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

- `pi install` 注册并加载扩展，但不保证 CLI 在普通 Shell 的 PATH 中；`npm install -g` 安装外部 CLI（npm 全局 bin 目录同样需在 PATH）
- CLI 不依赖 Pi 的 peer 包，因此用 `--omit=peer` 避免额外安装宿主；两处安装需分别更新并保持同一版本（`pi-reopen setup` / `doctor` 会报告版本不一致）
- `pi install` 只声明最低 peer 版本（`>=1.5.0`），不设上界：任何更新的 Pi 版本都可以直接安装

**登记依赖扩展**：只安装 CLI 无法记录会话。安装后需在每个已打开的 Pi 中执行 `/reload` 或重启；全新安装无法精确恢复此前未登记的窗口。不要同时加载旧的本地扩展入口（例如 `open-all.ts` 符号链接或单独的 `pi-reopen` 副本）；`pi-reopen setup` 会检查包来源和个人扩展目录中的疑似重复入口，再用 `pi list` 人工核对，只禁用旧入口，不要删除会话或认证文件。`doctor`/`setup` 通过 PID、进程启动时间和 boot ID 核验扩展自述；旧 `extension.json` 文件本身不再代表扩展当前仍在运行。

### 从已撤包的短包名迁移

已经使用 `@ellieyujin/pi-reopen` 的用户无需更换包名。如果曾安装现已撤包的 `pi-reopen`，先移除它，再安装维护中的包，避免重复加载与 CLI 冲突。先用 `pi list` 查看并移除原来的精确来源；以下示例适用于通过 `@latest` 安装的用户：

```bash
pi remove npm:pi-reopen@latest
npm uninstall -g pi-reopen
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
```

重启 Pi 后执行 `pi-reopen doctor`。对话文件与 `~/.pi/agent/pi-reopen/` 登记路径不变，不要删除它们。CLI 与扩展应保持同版本。不要同时加载本地扩展软链（例如 `open-all.ts` 或 `pi-reopen`）与 npm 包。

### 从源码安装

以下命令在 Linux/macOS/WSL 上安装当前检出的源码：

```bash
git clone https://github.com/AuthurX/pi-reopen.git
cd pi-reopen
pi install .
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/pi-reopen.js" "$HOME/.local/bin/pi-reopen"
export PATH="$HOME/.local/bin:$PATH"
pi-reopen setup
```

把 PATH 配置写进 shell 启动文件。若 CLI 符号链接已存在，先检查其指向，不要盲目覆盖。

Windows 原生，在 PowerShell 中从检出的仓库运行：

```powershell
pi install .
node .\bin\pi-reopen.js doctor
node .\bin\pi-reopen.js
```

若 PowerShell 执行策略阻止 npm 的 `.ps1` shim，使用 `pi.cmd` 代替 `pi`，无需修改策略。

只装扩展也可以直接安装已推送的 Git 版本：

```bash
pi install git:github.com/AuthurX/pi-reopen
```

## 可选配置

| 环境变量 | 用途 |
| --- | --- |
| `PI_REOPEN_WEZTERM` | 本机 WezTerm 的绝对路径（`wezterm` / `wezterm.exe`）；WSL 中使用 Windows 版本，例如 `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_REOPEN_PI_BIN` | Pi 可执行文件绝对路径，不含参数；Windows 支持 npm `pi.cmd`、包的 JS 入口或 `.exe`；不支持别名或 Shell 函数 |
| `PI_CODING_AGENT_DIR` | 使用不同的 Pi 配置/登记目录；CLI 与扩展必须一致 |
| `PI_REOPEN_SRC` | 仅供开发：覆盖共享 `src/` 目录，正常 package 安装无需设置 |
| `PI_REOPEN_LANG` | 强制输出语言：`zh` 或 `en`（默认跟随 `LC_ALL`/`LANG`） |
| `PI_REOPEN_TERMINAL` | 终端适配器 id；目前只实现 `wezterm`（见 [docs/TERMINALS.md](docs/TERMINALS.md)） |
| `PI_REOPEN_MAX_AGE_DAYS` | 超过多少天的死记录不再自动恢复（默认 14，`0` 表示不限制） |
| `PI_REOPEN_FORGET_ON_TAB_CLOSE` | 关单个 tab（WezTerm 还有其他 tab）默认视为“任务完成”并删除记录（默认开启）；关整个终端或无法判断时仍保留记录；设置 `0`/`false` 则总是保留记录 |

旧变量名（`PI_WORKSPACE_*`）仍然生效；两者同时设置时以 `PI_REOPEN_*` 为准。

例如 Pi 通过 nvm、pnpm 或自定义 npm prefix 安装时，显式指定：

```bash
export PI_REOPEN_PI_BIN="$(type -P pi)"
export PI_REOPEN_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

Linux/macOS/WSL 会从 PATH 和 Bash 登录环境定位 Pi。Windows 原生从 PATH 解析 `pi.exe` 或 npm 的 `pi.cmd`；npm shim 会解析成 Node + 已安装包的入口，避开 `cmd.exe` 引号与 PowerShell 执行策略问题。非标准 shim 需显式指定 JS 入口或 `.exe`。恢复的标签页只拿到调用方的 PATH 和 agent 目录，不传递完整环境与认证数据。WezTerm 发现会检查各平台 PATH 和常见安装位置；只有 WSL 使用 `where.exe` + `wslpath`。自定义布局请显式指定路径。修改环境变量后需重启 Pi；`/reload` 不会读取父 Shell 的新环境。

## 工作原理

![How it works](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/how-it-works.png)

- **登记**：每次 Pi 启动时把 `{会话文件绝对路径, cwd, pid, processStart, bootId, paneId, weztermPid（WSL）, platform, distro, user, schemaVersion}` 实时写入 `~/.pi/agent/pi-reopen/members/`（每会话一个文件，原子替换）。0.3.0 及更早版本写在 `pi-workspace/` 下的记录仍可读取与清理。
- **关闭判定**：Pi 的信号退出也会发出 `quit` 清理事件，事件名本身不可靠。扩展在 TUI 生命周期内记录 SIGHUP/SIGTERM；无信号的主动 `/quit` 或切换会话删除记录；reload 保留记录并清理监听器。没有受跟踪信号时，再向 WezTerm 查询当前 pane（`WEZTERM_PANE`）是否还存在：pane 已消失说明窗口被关闭，记录保留。默认（设置 `PI_REOPEN_FORGET_ON_TAB_CLOSE=0` 可关闭）pane 已消失但 WezTerm 还有其他 pane 时视为“关单个 tab = 任务完成”，删除记录（浏览器式“关掉的 tab 不进恢复集”）；无其他 pane 或无法判断时仍保留。WSL 的 `list`/`restore` 会在健康 CLI 进程中再次校准：只有存在匹配的信号关闭标记、GUI PID 与登记一致、原 Pi 已退出、原 pane 已消失且仍有其他 pane 时才删除；无关闭标记的崩溃、WezTerm 已重开或查询失败时保留，避免误删恢复记录。硬杀导致无清理时，残留记录会被恢复。断电时最多恢复已落盘的记录，最新未落盘的改动不保证。
- **安全启动**：标签页并发打开（默认同时 5 个）；每个 `wezterm cli spawn` 请求超过 15s 无响应会终止并报错，连续 3 次失败提前停止。`--limit` 限制批量规模。
- **去重**：恢复前检查进程存活（pid + 启动时刻 + bootId，重启后的旧 PID 不会误判），并扫描运行中进程的 `--session <文件>`，避免对未登记的窗口重复开标签页；启动声明（60s TTL + 持有者存活检查）进一步减少重复请求。全局恢复锁（`restore.lock`，30 分钟 TTL + pid 存活 + bootId 校验）用 `O_EXCL` 原子创建，并发恢复不会同时开整批；持锁进程死亡或系统重启后可接管。
- **确认**：“请求被接受”与“pi 已登记”分开报告；确认窗口随批量大小放大（15s + 每个会话 2s，上限 90s）。
- **标题与清理**：标签页标题优先会话名，否则用工作目录的文件夹名。超过 14 天的记录标记为 `expired` 不再自动恢复；`forget`/`prune` 可清理且不触碰对话文件。
- **安全**：预检（进程身份 / WezTerm 运行实例 / Pi / 终端适配器 / 登记健康度，WSL 另含互操作）不通过时不批量启动；不自动 sudo；ENOEXEC 附带修复提示。

## 开发与测试

```bash
# 在仓库根目录
npm test                    # Linux/WSL 完整回归（集成测试默认跳过）
npm run test:platform       # 原生 Linux/macOS/Windows 测试集
npm run verify-pack         # 打包、校验文件清单、运行解压后的 CLI
npm run test:integration    # 真实 WezTerm 开标签页/设置标题（需运行中的 WezTerm）
python3 test/pty-shutdown.py # 真实 Pi PTY：信号退出保留记录，主动 /quit 删除
```

```text
extensions/index.ts      Pi 扩展（薄适配层）：登记存活 Pi，提供 /reopen
src/                     共享核心（纯 JS ESM，扩展与 CLI 共用）
  terminals/             终端适配器（wezterm；见 docs/TERMINALS.md）
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/
  launch/spawn/verify/restore/cli/prune/health/inuse/pane/sessions/i18n/version
bin/pi-reopen.js         CLI 入口（直接用 node 运行，无构建步骤）
test/                    Node 内置测试（隔离目录 + 注入 mock，不调用真实终端）
docs/                    需求、状态、平台、终端适配器、发布说明
```

测试覆盖核心恢复、信号处理顺序、reload 清理、基于 pane 的关窗判定、`/reopen recent` 补选、非标准 Pi 安装路径、Shell 转义、旧目录记录合并、记录结构版本门控、i18n 及 package 移动后的加载；测试通过临时目录和模拟启动器隔离。测试钩子 `PI_REOPEN_HOOKS` 不应在正常使用时设置。

CI 在 Linux/macOS/Windows 跑平台测试集、在 Linux 跑完整回归、校验打包实物，并运行真实 Pi PTY 生命周期（会安装 Pi 宿主）。CI 无法打开 WezTerm GUI，真实开标签页/标题测试仍需 `PI_REOPEN_INTEGRATION=1` 手动启用。

维护者发布步骤见[发布指南](docs/PUBLISHING.md)与 [CHANGELOG](CHANGELOG.md)。

## 反馈与分享

如果它解决了你的终端重启问题，欢迎向 Pi / WezTerm 用户分享[项目地址](https://github.com/AuthurX/pi-reopen)。[反馈恢复问题](https://github.com/AuthurX/pi-reopen/issues)时，请提供系统、Pi/WezTerm 版本和**脱敏后的** `pi-reopen doctor` 输出，不要上传凭据或私密对话。维护者可参考[推广文案与效果记录方案](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md)。

## 贡献者

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## 许可证

[MIT](LICENSE)，Copyright (c) 2026 ellieyujin
