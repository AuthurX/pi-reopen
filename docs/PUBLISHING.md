# 发布到 npm 与 Pi 目录

## 结论

Pi 没有要求把源码上传到单独的 Pi 注册中心。分发有两条路径：

1. **Git 分发**：推送仓库后，别人用 `pi install git:github.com/AuthurX/pi-reopen` 安装；不需要先发布 npm。正式分享建议固定已推送的 tag 或 commit。
2. **npm 分发 / Pi 目录发现**：发布公开 npm 包，包含 `keywords: ["pi-package"]` 和 `pi.extensions`。官方说明关键词让包具备被 [Pi package gallery](https://pi.dev/packages) 发现的资格；没有承诺即时收录或固定同步时限。

当前 package 已包含扩展 manifest、CLI bin、host peerDependencies（`>=1.5.0`，不设上界，新版 Pi 直接可装）、公开发布配置与发布前测试。源码 TypeScript 由 Pi 加载，无需单独构建。

## 发布前必须确认

- **包名**：仅发布 `@ellieyujin/pi-reopen`，使用 npm 账户 `ellieyujin`，保留 `pi-package` 关键词。无 scope 的 `pi-reopen` 已撤包，不再发布。CLI 仍为 `pi-reopen`，不更改用户登记目录。
- **迁移**：已安装短包名的用户按双语 README 移除旧来源，再安装 scoped 包；原 scoped 包用户无需迁移。
- **许可证**：已选择 [MIT](../LICENSE)，版权人为 `ellieyujin`；`package.json.license` 已声明为 `MIT`，发布包须包含完整 LICENSE。
- **版本**：`@ellieyujin/pi-reopen@1.0.2` 已发布；本次单包配置与文档修正使用 `1.0.3`，不能覆盖 `1.0.2`。`publishConfig.tag` 为 `latest`。
- **功能验收**：WSL 恢复已完成实机验收；三平台 CI 通过，打包实物与真实 Pi PTY 生命周期由 CI 覆盖。macOS/Windows 真实 WezTerm 关窗与恢复仍待实机验收。恢复锁与启动声明已改为原子创建，但跨版本（旧 CLI）并发不承诺互斥。
- **工作树**：核对所有未提交修改（含原有修改），不要把未审查内容一起提交。本文不自动提交、推送或发布。

## 本地检查

在 WSL 仓库根目录运行：

```bash
npm test
npm run verify-pack
python3 test/pty-shutdown.py
# 有运行中的 WezTerm 时，再跑真实集成测试
npm run test:integration
```

PTY 测试需要已安装 Pi；它只用临时配置测试信号退出与主动退出，不调用模型、不打开 WezTerm 标签页。`verify-pack` 会断言 tarball 包含 `extensions/`、`src/`、`bin/`、README、LICENSE、发布文档，且不包含认证、个人会话、`.env`、测试临时文件或 `node_modules`，随后解压并运行解压后的 CLI（`--version`、`list`、`restore --dry-run`、预检失败退出码 2、未知命令退出码 1）。

打包实物也应在临时目录解压后测试 CLI 和 Pi 扩展，且不设置 `PI_REOPEN_SRC`，避免本机源码兜底掩盖漏打包。

## 仓库改名与发布门禁

仓库由 `AuthurX/pi-workspace` 改名为 `AuthurX/pi-reopen`。更新本地 origin 与公开链接；不要重新创建旧名仓库，以免破坏 GitHub 重定向。本地源码目录无需改名，避免破坏扩展软链。

发布前在 npm 网页设置中核对 `@ellieyujin/pi-reopen` 的 Trusted Publisher：

- GitHub 用户：`AuthurX`
- 仓库：`pi-reopen`
- Workflow：`release.yaml`
- 现有 publisher 连接的字段不可直接修改；需要时按 npm 指引删除旧连接并创建新连接。已有绑定是否随重命名生效需实测，不要仅凭 GitHub 重定向判断。首次成功发布绑定仓库身份；新建配置需按 npm 当前时限验证。
- `repository.url` 必须与实际发布仓库一致。不要在核验完成前推送发布 tag。

检查完成且版本号更新后，维护者可执行 `npm publish --access public --tag latest`（本地不传 `--provenance`）；CI 发布传 `--provenance`。仅发布 scoped 包，不再进行改名兼容发行。

双语 README、Pi 目录链接与推广文案统一指向 `@ellieyujin/pi-reopen`。npm 上的 1.0.2 包含双包时期的描述和文档，1.0.3 改回单包说明；本地修改需发布后才会同步到 npm。

### 当前环境恢复登录与核验授权

发布前核验登录与授权；若返回 E401，由维护者在自己的交互终端重新登录。不能把 dry-run 通过当作授权成功：

```bash
export http_proxy=http://127.0.0.1:7890 https_proxy=http://127.0.0.1:7890
npm login --registry=https://registry.npmjs.org/ --auth-type=web --browser=false
npm whoami --registry=https://registry.npmjs.org/
npm trust list @ellieyujin/pi-reopen --browser=false
```

CLI 支持 `npm trust` 时，可先预览配置（不修改服务端）：

```bash
npm trust github @ellieyujin/pi-reopen --repo AuthurX/pi-reopen --file release.yaml --allow-publish --browser=false --dry-run
```

核对现有 trust 列表后，才决定是否创建/替换连接，不盲目撤销已生效的授权。只需核验 `@ellieyujin/pi-reopen`，不为已撤包的短包名配置发布权限。凭据、OTP 和浏览器授权链接无需发到聊天。

## GitHub 自动发布

更新版本并提交后，推送 main 和对应的 `v<版本号>` tag。`.github/workflows/release.yaml` 调用同一提交的三平台测试工作流；所有检查通过后，核对 tag 与 package 版本、检查打包清单，再通过核验后的 npm trusted publishing 发布 `@ellieyujin/pi-reopen` 并创建 GitHub Release。任一平台失败均阻止发布，无需复制 npm token。

正式 tag（例如 `v0.3.0`）发布到 `latest`；带预发布后缀的 tag 才发布到 `next`。不要重写或移动已经发布的 tag。

## npm 发布（手动备用）

以下命令在仓库根目录由维护者确认后手动运行。已登录时无需重复登录；`whoami` 应输出 `ellieyujin`：

```bash
npm login --registry=https://registry.npmjs.org/ --auth-type=web --browser=false
# 保持终端运行，手动打开本次生成的链接，完成授权并等待登录成功。
npm whoami --registry=https://registry.npmjs.org/
npm pkg get name license version publishConfig
npm view @ellieyujin/pi-reopen --registry=https://registry.npmjs.org/
```

`npm view` 返回现有包时需核对所有者权限；404 只说明查询时没找到，最终是否允许该名称仍由 registry 判断。不要把 token、密码或 2FA 验证码写入仓库或聊天。

直接发布需要 npm 账户开启 2FA，或使用有发布权限且允许 bypass 2FA 的 granular access token。手动发布推荐浏览器登录与 2FA；本仓库 CI 已使用 npm trusted publishing，不要复制旧的长期 token 教程。

```bash
npm test
npm pack --dry-run
npm publish --dry-run --access public --tag latest
# 确认名称、许可、版本、文件清单和三平台测试结果后，才执行真正发布：
npm publish --access public --tag latest
```

`prepublishOnly` 会再次运行测试。`--dry-run` 不上传包，也不能证明账户具备真实发布权限。

## 稳定版发布清单

按顺序执行，任一步失败都停下来：

1. `npm test`、`npm run verify-pack`、`python3 test/pty-shutdown.py` 全绿。
2. 有运行中的 WezTerm 时执行 `npm run test:integration`（真实开标签页 + 标题）。
3. 按 [PLATFORMS.md](PLATFORMS.md) 的验收清单在 macOS/Windows 实机验证关窗与恢复；未验证的平台差异写进 Release notes。
4. 确认 `package.json` 的包名为 `@ellieyujin/pi-reopen`、版本号尚未发布且与 tag 一致，发布授权已验证，`publishConfig.tag` 为 `latest`。
5. 审核提交后推送 `main` 与对应 tag；CI 在 Linux/macOS/Windows、打包实物、真实 Pi PTY 全部通过后才发布该包。
6. 发布后按下方“发布后的安装验证”跑一遍；`pi-reopen doctor` 应同时显示扩展已加载且版本一致。

不要重写或移动已发布的 tag；发现问题时发新版本。

## 发布后的安装验证

```bash
npm view @ellieyujin/pi-reopen@latest name version repository dist-tags --registry=https://registry.npmjs.org/
# Linux/macOS/WSL：临时配置与 CLI 前缀，不修改个人安装。
CHECK_DIR="$(mktemp -d)"
PI_CODING_AGENT_DIR="$CHECK_DIR/agent" pi install npm:@ellieyujin/pi-reopen@latest
npm install --prefix "$CHECK_DIR/cli" --omit=peer @ellieyujin/pi-reopen@latest
node "$CHECK_DIR/cli/node_modules/@ellieyujin/pi-reopen/bin/pi-reopen.js" --version
# 启动隔离的 Pi 并加载扩展后，在其中运行 /reopen；无需调用模型。
PI_CODING_AGENT_DIR="$CHECK_DIR/agent" pi
# doctor 应在同一隔离配置下执行；未启动扩展前报告“未加载”属于预期。
```

- `pi install` 管理扩展资源；外部 CLI 用 npm 全局安装，并确认全局 bin 在 PATH。
- 使用 `--omit=peer` 避免 CLI 安装额外的 Pi 宿主副本；扩展运行时由 Pi 提供声明的 peer 包。
- 在新 Pi 会话中检查 `/reopen` 命令和登记；已有会话需要 `/reload` 或重启。
- 仅保留一个扩展加载入口，不要把旧手工符号链接、Git 安装和 npm 安装同时启用。
- Pi 目录未立即出现时先确认公开包、关键词、manifest 和实际安装是否正常。目录索引与 npm 安装是两件事。

## 后续更新

```bash
# 维护者：使用新的版本号；此命令不会自动创建 Git commit/tag。
npm version patch --no-git-tag-version
# 审查并提交版本改动后，推送对应版本 tag，交由上述 CI 发布。

# 使用者：Pi 扩展和 CLI 分别更新。
pi update npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
```

完成验收并决定发布稳定版后，设置非 prerelease 版本，并把 `publishConfig.tag` 改为 `latest`，发布时也显式指定 `--tag latest`。不要直接沿用开发版的 `next` 配置。固定版本/tag/commit 的 Pi 安装不会自动跟随其他版本，需要改用新的来源版本。

卸载扩展使用 `pi remove <原安装来源>`，卸载 CLI 使用 `npm uninstall -g @ellieyujin/pi-reopen`；不要顺带删除 Pi 认证、会话或整个 agent 目录。

## 曝光与效果核验

按 [推广计划](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md) 发布真实演示和双语介绍；`npm run discovery-report` 记录查询时间、下载统计窗口与搜索排名。下载量不是用户数，不为了排名空发版本，不刷下载或堆竞品包名。

## 官方依据

- [Pi Packages：来源、manifest、关键词与 host peers](https://pi.dev/docs/latest/packages)
- [Pi Command Line：安装和更新命令](https://pi.dev/docs/latest/cli)
- [npm：发布 scoped public packages 与 2FA](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
- [npm：trusted publishers](https://docs.npmjs.com/trusted-publishers)
- [名称冲突核验：pi-workspace registry metadata](https://registry.npmjs.org/pi-workspace/latest)
