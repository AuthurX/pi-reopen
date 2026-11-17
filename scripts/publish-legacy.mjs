import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
if (args.some((arg) => !["--dry-run", "--provenance"].includes(arg))) {
	throw new Error("Usage: node scripts/publish-legacy.mjs [--dry-run] [--provenance]");
}
const work = mkdtempSync(join(tmpdir(), "pi-reopen-legacy-"));
const npm = (args, cwd = root) => execFileSync("npm", args, { cwd, encoding: "utf8" });
try {
	// Pack the same allowlisted files as the main package; never edit the worktree.
	const result = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--pack-destination", work]));
	const entry = Array.isArray(result) ? result[0] : Object.values(result)[0];
	execFileSync("tar", ["-xzf", join(work, entry.filename), "-C", work]);
	const staged = join(work, "package");
	const manifest = join(staged, "package.json");
	const pkg = JSON.parse(readFileSync(manifest, "utf8"));
	if (pkg.name !== "pi-reopen") throw new Error("Expected main package pi-reopen");
	pkg.name = "@ellieyujin/pi-reopen";
	pkg.description = "Compatibility distribution of pi-reopen: restore Pi coding agent sessions as WezTerm tabs. Install only one distribution.";
	pkg.keywords = pkg.keywords.filter((keyword) => keyword !== "pi-package");
	delete pkg.scripts;
	writeFileSync(manifest, `${JSON.stringify(pkg, null, 2)}\n`);
	const tag = pkg.version.includes("-") ? "next" : "latest";
	execFileSync("npm", ["publish", "--access", "public", "--tag", tag, ...args], { cwd: staged, stdio: "inherit" });
} finally {
	rmSync(work, { recursive: true, force: true });
}
