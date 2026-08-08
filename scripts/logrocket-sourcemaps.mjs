/**
 * Uploads source maps to LogRocket for the current `.open-next/assets` build
 * output, then deletes public `.map` files so they are never deployed.
 *
 * Order (wired into `cf-build` / `deploy`):
 *   1. build        — `opennextjs-cloudflare build` produces `.open-next/` with
 *                     `.map` files alongside the client JS (Sentry keeps them
 *                     because `deleteSourcemapsAfterUpload: false`).
 *   2. Sentry       — the Sentry webpack plugin uploads maps during the build.
 *   3. LogRocket    — this script uploads `.open-next/assets` with
 *                     `--url-prefix=~/` so artifact paths match served URLs
 *                     (`/_next/static/...`, not `/assets/_next/static/...`).
 *   4. delete .map  — remove all .map files under `.open-next/assets` only.
 *                     Worker maps under `.open-next/` are left alone for
 *                     Cloudflare (`upload_source_maps: true`).
 *
 * `release` mirrors `getLogRocketConfig()` in `src/lib/logrocket/config.ts`.
 * Without `LOGROCKET_API_KEY` the script skips upload and exits 0 so local /
 * CI builds without the secret do not fail.
 *
 * LogRocket CLI failures are non-fatal: warn, still strip public `.map` files
 * (Sentry already has them), exit 0 so Cloudflare deploys are not blocked.
 * The API key is passed via `LOGROCKET_APIKEY` (CLI env prefix), never argv.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = ".open-next/assets";

const environment = (
	process.env.NEXT_PUBLIC_ENVIRONMENT ||
	process.env.NODE_ENV ||
	"development"
).trim();
const commitSha = process.env.WORKERS_CI_COMMIT_SHA?.trim();
// LogRocket release versions are capped at 60 chars; use short SHA.
const shortSha = commitSha ? commitSha.slice(0, 7) : "local";
const release = `workflow-${environment}-${shortSha}`;

/**
 * Recursively delete .map files under `dir`. Leaves non-map assets intact
 * and does not touch worker sourcemaps outside `assets/`.
 */
function deleteMapFiles(dir) {
	if (!existsSync(dir)) {
		return 0;
	}

	let deleted = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			deleted += deleteMapFiles(fullPath);
		} else if (entry.name.endsWith(".map")) {
			unlinkSync(fullPath);
			deleted += 1;
		}
	}
	return deleted;
}

function runLogRocket(args, apiKey) {
	execFileSync("pnpm", ["exec", "logrocket", ...args], {
		stdio: "inherit",
		env: {
			...process.env,
			// logrocket-cli yargs uses `.env("LOGROCKET")` → LOGROCKET_APIKEY
			LOGROCKET_APIKEY: apiKey,
		},
	});
}

const apiKey = process.env.LOGROCKET_API_KEY;
if (!apiKey) {
	console.warn(
		"LOGROCKET_API_KEY is not set — skipping LogRocket sourcemaps upload.",
	);
	process.exit(0);
}

if (!existsSync(ASSETS_DIR)) {
	console.warn(
		`${ASSETS_DIR} not found — skipping LogRocket sourcemaps upload.`,
	);
	process.exit(0);
}

console.log(`Uploading LogRocket sourcemaps for release "${release}"...`);
try {
	runLogRocket(["release", release, "--verbose"], apiKey);
	runLogRocket(
		[
			"upload",
			ASSETS_DIR,
			`--release=${release}`,
			"--url-prefix=~/",
			"--verbose",
		],
		apiKey,
	);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.warn(
		`LogRocket sourcemaps upload failed (continuing deploy): ${message}`,
	);
	console.warn(
		"Check LOGROCKET_API_KEY is a project API key from Settings → API Keys " +
			"(format org:app:secret or pat:org:app:secret) for this LogRocket app.",
	);
}

const deleted = deleteMapFiles(ASSETS_DIR);
console.log(
	`Removed ${deleted} public source map file(s) from ${ASSETS_DIR} after LogRocket step.`,
);
