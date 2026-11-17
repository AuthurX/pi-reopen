# pi-reopen：曝光与效果跟踪

## 定位

一句话：重开 WezTerm 后，一条命令恢复之前登记的 Pi 会话、工作目录与对话。

核心检索意图：`pi resume`、`pi restore session`、`wezterm session recovery`、`Pi 会话恢复`、`WSL WezTerm 重开终端`。用真实能力解释这些词，不堆砌无关关键词。

- `pi -c`：继续当前目录最近的一个会话。
- `pi-reopen`：把此前登记的多个 Pi 会话重新开成 WezTerm 标签页。
- 不承诺恢复分屏布局、正在运行的工具、未落盘状态或重开终端就自动运行。
- WSL 已有实机验收；macOS/Windows GUI 关窗恢复仍需实机验证。CI 通过不等于所有 GUI 场景已经验证。

## 发布门禁

1. `npm test`、`npm run verify-pack` 通过。
2. 核验 `@ellieyujin/pi-reopen` 的 npm Trusted Publisher；仓库改名后核验 provenance 链路。
3. 审查 diff 后由维护者提交、推送、发布，不能宣称未发布的包已可安装。
4. 验证 `@ellieyujin/pi-reopen` 的扩展和 CLI 均可安装，避免与本地软链重复加载。
5. 更新双语 README 的快速安装、目录链接和发布状态，再发推广文案。
6. 不盲目每周发版本；只有真实修复、功能或文档变更才发布。

## 推广顺序（人工发布，不自动群发）

| 渠道 | 内容 | 操作 |
| --- | --- | --- |
| GitHub About / topics | 简短功能说明、README 链接、pi/wezterm/session-recovery 等 | 仓库维护者更新 |
| npm / Pi gallery | description、keywords、manifest、预览图 | 正式发版后等待索引；不保证同步时限 |
| Pi 社区合适的扩展分享区 | `announcement.en.md`，注明作者身份 | 阅读版规后发布一次，回复反馈 |
| 中文技术社区（掘金/博客园/CSDN 选一个首发） | `article.zh-CN.md` + 实际演示 | 人工审核发布，避免同内容刷屏 |
| WezTerm 社区 | 分享 WSL/多项目恢复用例 | 先核对是否允许推广；不要提交广告 issue |

建议录制 20–40 秒演示：两个项目的 Pi 已登记 → 关闭 WezTerm → 重开 → dry-run → restore → 展示原目录与历史对话。遮盖用户名、绝对路径、私有仓库名和模型输出。现有 `assets/preview.png` 可用于截图；新演示未录制前不要写“已实测”。

## 测量

在仓库目录执行（CLI 联网默认使用代理）：

```bash
export http_proxy=http://127.0.0.1:7890 https_proxy=http://127.0.0.1:7890
node scripts/discovery-report.mjs > /tmp/pi-reopen-discovery.json
```

改动前留一份基线；发布后第 7、14、28 天再采样。报告只查询公开 npm API，不上传本地会话。`curl` 读取代理环境变量；单项失败以 errors 标注并返回非零，缺失不当作零。

记录：日期、查询词、前 50 结果排名、周/月下载窗口、文章链接、用户实际反馈、复现成功的安装问题。仅跟踪 `@ellieyujin/pi-reopen`，下载量不当作独立用户数；CI、重复下载、发布测试和迁移都能增加下载次数。GitHub traffic 仅维护者可查看，不能用 stars 代替安装数。

## 依据与边界

- [npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)：description / keywords 有助于发现包，没有保证排名。
- [Pi packages](https://pi.dev/docs/latest/packages)：`pi-package` 提供目录发现资格，不保证立即收录。
- [GitHub 仓库改名](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)：保留常规链接重定向；不要重新占用旧仓库名。
- 没有证据证明 scoped 名称天然降权，README 对 npm 内部搜索的权重也未验证。双语说明主要提升网页检索、理解和安装转化；不能保证曝光增长。
