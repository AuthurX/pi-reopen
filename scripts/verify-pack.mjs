import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 打包实物校验：npm pack → 检查文件清单 → 解压到临时目录 → 直接运行 CLI。
 * 不设置 PI_REOPEN_SRC，避免本机源码兜底掩盖漏打包。
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const work = mkdtempSync(join(tmpdir(), "pi-reopen-pack-"));
const home = join(work, "home");

const REQUIRED = [
	"package.json",
	"LICENSE",
	"README.md",
	"README.zh-CN.md",
	"CHANGELOG.md",
	"bin/pi-reopen.js",
	"extensions/index.ts",
	"src/cli.js",
	"src/restore.js",
	"src/setup.js",
	"src/selection.js",
	"src/terminals/wezterm.js",
	"src/i18n.js",
	"docs/PLATFORMS.md",
];
const FORBIDDEN = [/node_modules/, /\.env$/, /\.tgz$/, /sessions\//, /pi-workspace\//, /members\//, /test\//, /^docs\/promotion\//, /^scripts\//];

function fail(message) {
	console.error(`✖ ${message}`);
	process.exitCode = 1;
}

try {
	const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", work], {
		cwd: root,
		encoding: "utf8",
	}));
	// npm 10 返回数组，npm 11+ 返回以包名为 key 的对象。
	const entry = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
	const { filename, files } = entry;
	const paths = files.map((file) => file.path);
	for (const required of REQUIRED) {
		if (!paths.includes(required)) fail(`tarball 缺少 ${required}`);
	}
	for (const pattern of FORBIDDEN) {
		if (paths.some((path) => pattern.test(path))) fail(`tarball 不应包含 ${pattern}`);
	}
	console.log(`tarball: ${filename}（${paths.length} 个文件）`);

	execFileSync("tar", ["-xzf", join(work, filename), "-C", work]);
	const pkgDir = join(work, "package");
	const sourceManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
	assert.equal(manifest.name, "@ellieyujin/pi-reopen");
	assert.deepEqual(manifest.bin, { "pi-reopen": "bin/pi-reopen.js" });
	assert.equal(manifest.scripts["publish-legacy"], undefined);
	assert.equal(manifest.version, sourceManifest.version);
	assert.equal(manifest.repository.url, "git+https://github.com/AuthurX/pi-reopen.git");
	assert.ok(manifest.keywords.includes("pi-package"));
	for (const entry of [...manifest.pi.extensions, ...Object.values(manifest.bin)]) {
		assert.ok(existsSync(join(pkgDir, entry)), `missing entrypoint: ${entry}`);
	}
	mkdirSync(home, { recursive: true });
	// 可执行脚本夹具：让预检在任意 CI 上都能通过，不依赖真实 WezTerm/pi。
	const bin = join(home, "bin");
	mkdirSync(bin, { recursive: true });
	const fakeWezterm = join(bin, "wezterm");
	writeFileSync(fakeWezterm, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "wezterm 1.0"; exit 0; fi\necho "[]"\n');
	chmodSync(fakeWezterm, 0o755);
	const fakePi = join(bin, "pi");
	writeFileSync(fakePi, "#!/bin/sh\nexit 0\n");
	chmodSync(fakePi, 0o755);
	const env = {
		HOME: home,
		PATH: `${bin}:${process.env.PATH}`,
		PI_CODING_AGENT_DIR: join(home, ".pi", "agent"),
		PI_REOPEN_LANG: "en",
		PI_REOPEN_WEZTERM: fakeWezterm,
		PI_REOPEN_PI_BIN: fakePi,
	};
	// WSL 上预检要求发行版名；普通 Linux 不设置（否则会被判成 WSL 而缺少 /run/WSL）。
	if (existsSync("/run/WSL")) env.WSL_DISTRO_NAME = "Arch";
	const run = (...args) => spawnSync(process.execPath, [join(pkgDir, "bin", "pi-reopen.js"), ...args], {
		cwd: pkgDir,
		env,
		encoding: "utf8",
	});

	let out = run("--version");
	assert.equal(out.status, 0, out.stderr);
	assert.match(out.stdout, /^pi-reopen \d+\.\d+\.\d+/, "打包后的 --version 必须可用");

	out = run("list");
	assert.equal(out.status, 0, out.stderr);
	assert.match(out.stdout, /No registered members/, "打包后的 list 必须可用（英文环境）");

	out = run("restore", "--dry-run");
	assert.equal(out.status, 0, out.stderr);
	assert.match(out.stdout, /to restore/, "打包后的 restore --dry-run 必须可用");

	out = run("setup");
	assert.equal(out.status, 2, out.stderr);
	assert.match(out.stdout, /first-run setup/, "打包后的 setup 必须可用并如实报告未安装扩展");

	// 预检失败要如实返回 2，而不是崩溃或假装成功
	out = run("restore", "--dry-run", "--json");
	const preflightEnv = { ...env, PI_REOPEN_WEZTERM: join(home, "missing-wezterm") };
	const failed = spawnSync(process.execPath, [join(pkgDir, "bin", "pi-reopen.js"), "restore", "--dry-run", "--json"], {
		cwd: pkgDir, env: preflightEnv, encoding: "utf8",
	});
	assert.equal(failed.status, 2, failed.stdout + failed.stderr);
	assert.equal(JSON.parse(failed.stdout).stage, "preflight");

	out = run("nope");
	assert.equal(out.status, 1, "未知命令必须返回 1");
	assert.match(out.stdout, /Usage:/);

	console.log(process.exitCode ? "✖ pack verification failed" : "✔ pack verification passed");
} finally {
	rmSync(work, { recursive: true, force: true });
}
