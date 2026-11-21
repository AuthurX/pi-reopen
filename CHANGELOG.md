# Changelog

## 1.0.9 — 2026-11-21

- `pi-reopen list` 表格新增序号列（`#`）：每行按列表顺序编号，列宽随行数位数自适应（100+ 行自动加宽）；窄终端回退的简单行同样带序号。
- `list --json` 输出结构不变，脚本消费不受影响。

## 1.0.8 — 2026-11-20

- `PI_REOPEN_FORGET_ON_TAB_CLOSE` 默认改为**开启**：关单个 tab（WezTerm 还有其他 tab）视为“任务完成”、删除登记记录；设置 `0`/`false`/`off`/`no` 可恢复“总是保留记录”的旧行为。关整个终端、崩溃或无法判断时仍保留记录，行为不变。
- 修复：扩展的 pane 探测（`paneExists`/`otherPanesExist`）在未设置 `PI_REOPEN_WEZTERM` 时回退到 PATH 中的 `wezterm`，WSL 下会误用发行版内的 Linux wezterm；现与 CLI 共用同一发现逻辑（WSL 下自动定位 Windows 侧 wezterm.exe）。
- 文档：`docs/PLATFORMS.md` 补充 WSL 下需在 Windows 侧 `WSLENV` 中加入 `WEZTERM_PANE`，否则 pane 探测不可用、forget-on-tab-close 退化为“总是保留记录”。

## 1.0.7 — 2026-11-19

- 重绘双语 README “How It Works” 图：奶油底 + 网格 + 五色卡片风格（深海军蓝 / 淡紫 / 薄荷绿 / 淡蓝 / 琥珀），卡片内文字放大，恢复勾选标记重绘为圆头对勾；`assets/gen_how_it_works.py` 同步更新。无运行时逻辑变更。

## 1.0.6 — 2026-11-19

- 更新双语 README 首页预览图：英文版 `assets/preview.png` 与新增中文版 `assets/preview.zh.png`（1280×720 海报，2x 导出）；中文版 README 首页图改用 `preview.zh.png`。

## 1.0.5 — 2026-11-19

- 新增 `PI_REOPEN_FORGET_ON_TAB_CLOSE`（`1`/`true`，默认关闭）：启用后，被动死亡（关窗）时若 WezTerm 里还有其他 pane，视为“关单个 tab = 任务完成”，删除登记记录；无其他 pane（关整个终端）或无法判断时仍保留记录、照常可恢复。对齐浏览器“关掉的 tab 不进恢复集”模型；误关可用 `/reopen recent` 在 24 小时内补回。
- 修复：`otherPanesExist` 在无法确定自身 pane（如 `WEZTERM_PANE` 缺失）或存在坏 pane 条目时误判“还有其他 pane”，导致误删登记记录；现在按“无法判断”保守保留。

## 1.0.4 — 2026-11-18

- Pi 扩展入口由 `extensions/open-all.ts` 更名为 `extensions/index.ts`：npm 包安装后 Pi 扩展列表显示 `@ellieyujin/pi-reopen`，本地目录安装显示 `pi-reopen`；升级后需手动禁用或移除旧的本地 `open-all.ts` 入口。
- 后台 PowerShell 系统/进程查询禁用进度输出，并显式捕获 stderr，避免 CLIXML 及乱码直接输出到终端；保留原有查询失败处理，不改变 WezTerm 连接与 Pi 交互启动方式。

## 1.0.3 — 2026-11-17

- 统一以 `@ellieyujin/pi-reopen` 为唯一 npm 发行包；移除双包发布脚本与 CI 步骤，同步安装、迁移和发布文档。CLI 名称与会话登记目录不变。
- 打包校验固定 scoped 包名并保留 `pi-package` 关键词；搜索与下载统计仅跟踪该包。
- 双语 README 新增适用场景与平台支持表，明确仅恢复到本机 WezTerm，以及 Windows 原生与 WSL 的环境边界。
- 本次不修改恢复运行时逻辑。已知 Windows PowerShell CLIXML 进度输出问题尚未修复；macOS/Windows 真实 GUI 关窗与恢复仍待实机验收。

## 1.0.2 — 2026-11-17

- 曾发布 `pi-reopen` 与 `@ellieyujin/pi-reopen` 双包；无 scope 的 `pi-reopen` 随后撤包，不再作为安装入口。
- 补充 session / resume / restore 等需求关键词及双语快速入门、原生 `pi -c` 对比和包名迁移说明。
- 公开链接统一为 `AuthurX/pi-reopen`；补充仓库改名后的 npm Trusted Publisher 发布门禁。
- 新增公开搜索/下载统计脚本、推广文案草稿与效果跟踪计划；未改变会话恢复运行时逻辑。

## 1.0.1 — 2026-11-16

- 精简 npm 包描述为一句："Reopen your Pi terminals after WezTerm closes."

## 1.0.0 — 2026-11-16

第一个稳定版。0.4 系列的全部修复合并发布：关闭判定、并发安全、产品化外壳与发布流程。

### 关闭判定与数据安全

- 关窗判定新增 pane 存在性探测：没有 SIGHUP/SIGTERM 时查询 `WEZTERM_PANE`，pane 已消失按被动死亡保留记录，避免平台差异导致会话永久丢失。
- 恢复前扫描运行中进程的 `--session <文件>`，即使扩展未加载/记录被清空，也不会对同一会话文件再开一个 Pi（Pi 无会话文件锁，双写会损坏对话）。
- 全局恢复锁与启动声明改为 `O_EXCL` 原子创建；接管过期锁前复核记录，避免删掉其他进程刚写入的新锁。
- 记录新增 `platform`/`distro`/`user`/`schemaVersion`；来自其他平台或发行版的记录会被跳过（`wrong-platform`），比旧 CLI 更新的记录结构不参与恢复。

### 产品化外壳

- `pi-reopen --help`/`--version` 正常返回 0；裸 flag（如 `--dry-run`）等价于 `restore`。
- 新增 `--json`（restore/list）、`--only`（子串或通配符）、`--limit`。
- 标签页并发打开（默认同时 5 个）；确认窗口随批量放大（15s + 2s/会话，上限 90s），减少“慢启动被误报为失败”。
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
