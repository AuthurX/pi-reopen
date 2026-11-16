# Changelog

## 1.0.0 — 2026-11-16

第一个稳定版。0.4 系列的全部修复合并发布：关闭判定、并发安全、产品化外壳与发布流程。

### 关闭判定与数据安全

- 关窗判定新增 pane 存在性探测：没有 SIGHUP/SIGTERM 时查询 `WEZTERM_PANE`，pane 已消失按被动死亡保留记录，避免平台差异导致会话永久丢失。
- 恢复前扫描运行中进程的 `--session <文件>`，即使扩展未加载/记录被清空，也不会对同一会话文件再开一个 Pi（Pi 无会话文件锁，双写会损坏对话）。
- 全局恢复锁与启动声明改为 `O_EXCL` 原子创建；接管过期锁前复核记录，避免删掉其他进程刚写入的新锁。
- 记录新增 `platform`/`distro`/`user`/`schemaVersion`；来自其他平台或发行版的记录会被跳过（`wrong-platform`），比旧 CLI 更新的记录结构不参与恢复。

### 产品化外壳

- `pi-reopen --help`/`--version` 正常返回 0；裸 flag（如 `--dry-run`）等价于 `restore`。
- 新增 `--json`（restore/list）、`--only`（子串或通配符）、`--limit`、`--delay`、`--yes`。
- 超过 5 个待恢复会话先确认；确认窗口随批量放大（15s + 2s/会话，上限 90s），减少“慢启动被误报为失败”。
- 明确退出码：0 成功 / 1 请求失败 / 2 预检失败 / 3 请求已发未确认 / 4 仅有跳过项。
- 标签页标题优先会话名，否则用目录名（`wezterm cli set-tab-title`）。
- `list` 能显示“启动占用中”，并新增 `已过期`、`已在其他窗口打开`、`未匹配 --only`、`本次未处理` 等状态。
- 新增 `forget <id|前缀>` 与 `prune [--dry-run]`；超过 14 天（`PI_REOPEN_MAX_AGE_DAYS`）的记录标记为过期不再自动恢复。
- `doctor` 增加登记目录、扩展自述、版本一致性、记录结构检查；空登记时提示“在每个 Pi 执行 /reload”。
- CLI、doctor、扩展提示支持中/英（`PI_REOPEN_LANG`，默认跟随 locale）。
- `/reopen recent` 显示可读名称（目录名 + 会话名）、校验工作目录、纳入全局锁、等待真实登记确认；失败时释放声明以便重试。
- 扩展缓存进程身份（Windows 上不再每条消息启动 PowerShell）、写失败只提示一次、`/name` 改名即时刷新记录。

### 命名与兼容

- 数据目录统一为 `~/.pi/agent/pi-reopen`；旧的 `pi-workspace/` 记录仍会读取、删除与清理。
- 环境变量统一为 `PI_REOPEN_*`；旧名 `PI_WORKSPACE_*` 继续生效，canonical 优先。
- `peerDependencies` 只声明最低版本 `>=1.5.0`、不设上界，任何新版 Pi 都可直接安装；Pi 扩展 API 若变更，扩展会提示一次而不是静默停止登记。

### 架构与发布

- 抽出终端适配器层（`src/terminals/`），为后续支持其他终端留出接口，见 `docs/TERMINALS.md`。
- CI 新增打包实物校验（`npm run verify-pack`）与真实 Pi PTY 生命周期任务；发布流程改为校验 tarball 后再发布。
- 新增 `test/integration.test.mjs`（`PI_REOPEN_INTEGRATION=1`）覆盖真实 `wezterm cli spawn` 与标题设置。

## 0.3.0 — 2026-11-14

- 新增原生 Linux、macOS、Windows 启动路径，保留 WSL。
- 三平台 CI；npm trusted publishing。

## 0.2.0 — 2026-11-13

- 恢复风暴修复：`wezterm cli spawn` 15s 超时、连续 3 次失败提前停止、全局恢复锁。
- `list` 对齐表格、CJK 宽度、管道 EPIPE 处理。
- 首个稳定发布。

## 0.1.0 — 2026-10-30

- 原型：共享核心（登记/存活判定/计划/预检/启动/回执）、Pi 扩展与独立 CLI。
