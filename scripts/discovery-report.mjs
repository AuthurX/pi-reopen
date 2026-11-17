import { execFileSync } from "node:child_process";

const packages = ["@ellieyujin/pi-reopen"];
const queries = ["pi reopen", "pi wezterm", "pi resume", "pi restore session", "wezterm session recovery"];
const errors = [];
function get(url) {
	const raw = execFileSync("curl", ["--silent", "--show-error", "--location", "--max-time", "30", "--retry", "2", url], { encoding: "utf8" });
	return JSON.parse(raw);
}
function collect(label, fn) {
	try { return fn(); }
	catch (error) {
		errors.push({ source: label, error: error.message });
		return null;
	}
}
const report = {
	checkedAt: new Date().toISOString(),
	note: "Downloads are requests, not unique installs or users. Rankings are one registry-search snapshot, limited to 50 results. Missing data is not zero.",
	downloads: Object.fromEntries(packages.map((name) => [name, Object.fromEntries(["last-week", "last-month"].map((period) => [period, collect(`${name}/${period}`, () => {
		const data = get(`https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(name)}`);
		if (data.error) throw new Error(data.error);
		if (typeof data.downloads !== "number") throw new Error("Missing downloads count");
		return data;
	})]))])),
	search: queries.map((query) => ({
		query,
		result: collect(query, () => {
			const data = get(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=50`);
			if (!Array.isArray(data.objects)) throw new Error("Missing search results");
			const names = data.objects.map(({ package: pkg }) => pkg.name);
			return { ranks: Object.fromEntries(packages.map((name) => [name, names.includes(name) ? names.indexOf(name) + 1 : null])), top10: names.slice(0, 10) };
		}),
	})),
	errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
