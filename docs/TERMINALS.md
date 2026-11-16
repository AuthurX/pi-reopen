# 终端适配器

恢复的目标终端通过适配器接入。当前只有 WezTerm 一个实现；新增终端（Windows Terminal、iTerm2、tmux 等）不需要改恢复编排，只需实现同一接口并注册。

## 选择适配器

环境变量 `PI_WORKSPACE_TERMINAL` 指定适配器 id，默认 `wezterm`。未知 id 会让预检失败（`终端适配器` 检查项），不会静默退回 WezTerm——用错误的终端打开标签页只会产生坏结果。

## 接口

`src/terminals/index.js` 维护注册表：

```js
export const TERMINALS = { wezterm };
export function getTerminal(id) { /* 返回适配器或 undefined */ }
export function terminalId(env) { /* 读取 PI_WORKSPACE_TERMINAL */ }
```

每个适配器导出：

```js
id: string

// 找到本机可执行文件；返回绝对路径或 undefined
discover(env, deps) -> string | undefined

// 请求打开一个标签页。ok 只表示“请求被接受”，不代表 pi 已启动
spawnTab({ program, distro, cwd, sessionFile, piBin, piCommand,
           powershell, env, platform, spawner, spawnTimeoutMs })
  -> { ok: boolean, stdout?: string, error?: string }

// 设置标签页标题（失败只影响外观）
setTabTitle({ program, paneId, title, env, runner }) -> boolean

// 当前 pane 是否还存在：true / false / undefined（无法判断）
paneExists(paneId, { program, env, runner }) -> boolean | undefined

// 当前进程所在 pane 的 id（用于关窗判定）
currentPaneId(env) -> number | undefined
```

`program` 是 `discover` 返回的可执行文件路径。`runner(program, args)` 是可注入的同步执行器（默认 `spawnSync`），便于测试。

## 接入新终端的最小步骤

1. 新建 `src/terminals/<id>.js`，实现上述五个函数。
2. 在 `src/terminals/index.js` 的 `TERMINALS` 中注册。
3. 确认 `spawnTab` 的 `stdout` 能给出新 pane 的 id（标题功能依赖它）。
4. 若该终端不注入 pane id 环境变量，`currentPaneId` 返回 `undefined`——关窗判定会退回“信号 + quit 事件”的旧逻辑。
5. 在 `test/` 中加一条适配器契约测试：参数拼装、标题设置、pane 探测、失败路径。

## 与恢复编排的关系

- `preflight` 调 `discover` 和终端自身的 `--version` / `cli list` 探测（目前探测逻辑在适配器外部，WezTerm 专属）。
- `runRestore` 通过 `spawn.openTab` 调 `spawnTab`，通过 `pane.setTabTitle` 调 `setTabTitle`。
- 关窗判定（`extensions/open-all.ts`）通过 `pane.currentPaneId` + `paneExists` 区分“主动 /quit”与“窗口被关闭”。

## 现有实现

`src/terminals/wezterm.js`：`wezterm cli spawn --domain-name local`、`wezterm cli set-tab-title`、`wezterm cli list --format json`。WSL 下通过 `wsl.exe -d <发行版> -e bash -lc` 定向发行版；原生平台直接 `bash -lc`（Windows 用 PowerShell 5.1）。
