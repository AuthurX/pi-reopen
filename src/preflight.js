import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { BINFMT_FIX_COMMAND } from "./binfmt.js";
import { envCompat } from "./env.js";
import { discoverWezterm } from "./discover.js";
import { resolveLang, t } from "./i18n.js";
import { getTerminal, terminalId } from "./terminals/index.js";
import { launchSetup, shellQuote } from "./launch.js";
import { currentBootId, processStart } from "./liveness.js";
import { powershellPath, runtimePlatform } from "./platform.js";
import { discoverWindowsPi } from "./windows.js";

function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/** 启动前环境检查；任何一项不通过都不得批量开标签页。 */
export function preflight({ env = process.env, platform = runtimePlatform(env), wezterm, prober, piProber, identityProber, lang = resolveLang(env) } = {}) {
	const checks = [];
	const add = (name, ok, detail, hint) => checks.push({ name, ok, detail, hint: ok ? undefined : hint });

	add(t(lang, "pf.platform"), ["wsl", "linux", "darwin", "win32"].includes(platform), platform, t(lang, "pf.platformHint"));
	const terminal = terminalId(env);
	const adapter = getTerminal(terminal);
	add(t(lang, "pf.terminal"), !!adapter, terminal, t(lang, "pf.terminalHint"));
	const distro = platform === "wsl" ? env.WSL_DISTRO_NAME : undefined;
	if (platform === "wsl") {
		add(t(lang, "pf.distro"), !!distro, distro || t(lang, "pf.distroUnset"), distro ? undefined : t(lang, "pf.distroHint"));
		add(t(lang, "pf.interop"), existsSync("/run/WSL"), "/run/WSL", existsSync("/run/WSL") ? undefined : t(lang, "pf.interopHint"));
	}
	const identity = identityProber ? identityProber() : { bootId: currentBootId(), processStart: processStart(process.pid) };
	add(t(lang, "pf.identity"), !!identity?.bootId && !!identity?.processStart, identity?.bootId || t(lang, "pf.identityUnavailable"), t(lang, "pf.identityHint"));

	const explicit = wezterm ?? envCompat(env, "PI_REOPEN_WEZTERM");
	let found;
	if (explicit) {
		if (isFile(explicit)) {
			found = explicit;
			add(t(lang, "pf.wezterm"), true, found);
		} else {
			add(
				t(lang, "pf.wezterm"),
				false,
				t(lang, "pf.weztermExplicitMissing", { path: explicit }),
				t(lang, "pf.weztermExplicitHint"),
			);
		}
	} else {
		found = adapter?.discover(env, { platform });
		add(
			t(lang, "pf.wezterm"),
			!!found,
			found || t(lang, "pf.weztermMissing"),
			found ? undefined : t(lang, "pf.weztermHint"),
		);
	}

	if (found) {
		const probe = prober
			? prober(found, ["--version"])
			: spawnSync(found, ["--version"], { env, timeout: 8000, encoding: "utf8", windowsHide: true });
		if (probe.status === 0) {
			add(t(lang, "pf.weztermExec"), true, String(probe.stdout ?? "").trim() || t(lang, "pf.weztermExecOk"));
			const mux = prober ? prober(found, ["cli", "list", "--format", "json"])
				: spawnSync(found, ["cli", "list", "--format", "json"], { env, timeout: 8000, encoding: "utf8", windowsHide: true });
			add(
				t(lang, "pf.weztermInstance"),
				mux.status === 0,
				mux.status === 0 ? t(lang, "pf.weztermInstanceOk") : String(mux.stderr || mux.error || "").trim(),
				t(lang, "pf.weztermInstanceHint"),
			);
		} else {
			const enoexec = probe.error?.code === "ENOEXEC";
			add(
				t(lang, "pf.weztermExec"),
				false,
				enoexec ? t(lang, "pf.weztermExecEnoexec") : String(probe.stderr ?? probe.error ?? "").trim(),
				enoexec && platform === "wsl"
					? `${t(lang, "pf.weztermExecEnoexecHint")}\n${BINFMT_FIX_COMMAND}`
					: t(lang, "pf.weztermExecHint"),
			);
		}
	}

	if (platform === "win32") {
		const pi = piProber ? piProber() : discoverWindowsPi(env);
		const piOk = !!pi?.piCommand?.length;
		add(t(lang, "pf.pi"), piOk, pi?.piBin || t(lang, "pf.weztermMissing"), t(lang, "pf.piHint"));
		const powershell = powershellPath(env);
		add(t(lang, "pf.powershell"), isFile(powershell), powershell, t(lang, "pf.powershellHint"));
		return { ok: checks.every((c) => c.ok), platform, terminal, wezterm: found, checks, piBin: pi?.piBin, piCommand: pi?.piCommand, powershell };
	}

	const explicitPi = envCompat(env, "PI_REOPEN_PI_BIN");
	const candidate = explicitPi ? shellQuote(explicitPi) : '"$pi_bin"';
	const probeScript = [
		launchSetup(env, explicitPi),
		...(explicitPi ? [] : ['pi_bin=$(type -P pi) || exit 1']),
		`[[ ${candidate} = /* && -f ${candidate} && -x ${candidate} ]] || exit 1`,
		`printf '%s\\n' ${candidate}`,
	].join("; ");
	const piProbe = piProber
		? piProber()
		: spawnSync("bash", ["-lc", probeScript], { env, timeout: 5000, encoding: "utf8" });
	const piPath = String(piProbe.stdout ?? "").trim().split(/\r?\n/).at(-1);
	const piOk = piProbe.status === 0 && !!piPath;
	add(
		t(lang, "pf.pi"),
		piOk,
		piOk ? piPath : explicitPi || t(lang, "pf.weztermMissing"),
		piOk ? undefined : t(lang, "pf.piHint"),
	);

	return { ok: checks.every((c) => c.ok), platform, terminal, wezterm: found, checks, distro, lang, piBin: piOk ? piPath : undefined };
}
