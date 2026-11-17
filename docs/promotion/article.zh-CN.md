# 草稿：重开 WezTerm 后，如何一键恢复之前的 Pi 会话？

> 维护者发布前检查：核对当前版本、安装命令与平台验收状态，补充脱敏的真实演示。本文尚未发布；下方先使用当前已发布的 scoped 包名。

## 我的需求不是“找回最后一条聊天”

同时在几个项目里使用 Pi coding agent，关闭 WezTerm 后，通常需要重新打开多个终端、进入各自目录、选择正确的历史会话。

Pi 原生 `pi -c` 可以继续当前目录最近的会话，`pi -r` 可以选择历史记录。但要把关窗前那一组 Pi 会话一起找回来，需要额外记住哪些项目、哪些对话当时仍然开着。

我维护的开源工具 **pi-reopen** 就做这件事：扩展记录正在使用的 Pi 会话，CLI 在重开 WezTerm 后把它们恢复成标签页。

## 如何使用

需要同一系统环境中的 Node ≥22.19、Pi 和可访问的 WezTerm。安装扩展和外部 CLI：

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen doctor
```

在之前已经打开的每个 Pi 中执行 `/reload`，让扩展开始登记。关闭并重新打开 WezTerm 后，先查看计划：

```bash
pi-reopen restore --dry-run
```

确认后恢复：

```bash
pi-reopen
```

它会恢复原工作目录、加载原会话文件，并跳过已在运行的会话。也可以在 Pi 里输入 `/reopen`。它不会自动向模型发送“继续”，而是等待你的输入。

## 它与 pi -c 的区别

| 场景 | 建议 |
| --- | --- |
| 继续当前项目最近的一段对话 | `pi -c` |
| 手动找一个历史会话 | `pi -r` |
| 恢复关窗前已登记的多项目 Pi 会话 | `pi-reopen` |

## 明确边界

- 恢复的是对话与目录，不是原进程、正在运行的工具或分屏布局。
- 需要先启动 WezTerm，再运行恢复命令，不会在启动终端时自动执行。
- 主动退出 Pi 的会话不作为待恢复窗口保留。
- 扩展安装前未登记的窗口无法精确还原；`/reopen recent` 可以辅助从近期历史中补选。
- 支持 Linux/macOS/Windows 原生以及 WSL + Windows WezTerm；WSL 有实机验收，macOS/Windows 的 GUI 关窗恢复仍需更多验证。
- 不要同时安装本地软链、旧 scoped 包和新短包名，避免重复加载。

## 欢迎反馈

项目采用 MIT 协议：https://github.com/AuthurX/pi-reopen

如果你也有多项目 Pi 会话恢复的需求，欢迎反馈环境与复现步骤。分享 `pi-reopen doctor` 输出前请去掉私人路径，不要上传认证文件或对话内容。
