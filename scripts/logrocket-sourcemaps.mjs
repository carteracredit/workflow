/**
 * Uploads source maps to LogRocket for the current `.open-next/` build output.
 *
 * Correct order for a deploy (NOT wired into `build`/`deploy` yet — run
 * manually once LOGROCKET_API_KEY is configured, to verify the flow first):
 *   1. build       — `pnpm run cf-build` produces `.open-next/` with `.map` files alongside the bundled JS.
 *   2. Sentry       — the Sentry webpack plugin (via `withSentryConfig` in next.config.ts) uploads
 *                     source maps to Sentry automatically as part of the build step above.
 *   3. LogRocket    — this script, uploading the same `.open-next/` output to LogRocket.
 *   4. delete .map  — remove `.map` files from `.open-next/` before deploying, so they are never
 *                     served publicly (both Sentry and LogRocket already have their own copies).
 *
 * `release` mirrors the format used by `getLogRocketConfig()` in
 * `src/lib/logrocket/config.ts`, so uploaded source maps match the release
 * tag reported by `LogRocket.init()` at runtime.
 */
import { execSync } from "node:child_process";

const environment =
	process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || "development";
const commitSha = process.env.WORKERS_CI_COMMIT_SHA;
const release = `workflow@${environment}-${commitSha ?? "local"}`;

const apiKey = process.env.LOGROCKET_API_KEY;
if (!apiKey) {
	console.error(
		"LOGROCKET_API_KEY is not set — skipping LogRocket sourcemaps upload.",
	);
	process.exit(1);
}

console.log(`Uploading LogRocket sourcemaps for release "${release}"...`);
execSync(`pnpm exec logrocket release "${release}" --apikey="${apiKey}"`, {
	stdio: "inherit",
});
execSync(
	`pnpm exec logrocket upload .open-next/ --release="${release}" --apikey="${apiKey}"`,
	{ stdio: "inherit" },
);
