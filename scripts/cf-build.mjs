/**
 * Managed by harness/scripts/sync.mjs — do not edit in consumer repos.
 * Source: harness/scripts/cf-build.mjs
 *
 * Workers Builds build command. Stable `dev` / `main` (or no branch) run
 * OpenNext as today. Non-production branches bake preview NEXT_PUBLIC_*
 * (stable-dev hosts, same-slug stacks when /healthz is ok) then build once.
 * LogRocket sourcemap upload runs after OpenNext when that script exists.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { resolvePreviewBuildEnv } from "./preview-env.mjs";
import { branchFromEnv, isStableBranch } from "./preview-slug.mjs";

function runOpenNext(env) {
	execSync("pnpm exec opennextjs-cloudflare build", {
		stdio: "inherit",
		env,
	});
}

function runLogrocketIfPresent(env, cwd = process.cwd()) {
	const script = join(cwd, "scripts", "logrocket-sourcemaps.mjs");
	if (!existsSync(script)) return;
	console.log("cf-build: uploading LogRocket sourcemaps");
	execSync("node ./scripts/logrocket-sourcemaps.mjs", {
		stdio: "inherit",
		env,
		cwd,
	});
}

async function main() {
	const branch = branchFromEnv();
	if (!branch || isStableBranch(branch)) {
		if (branch) console.log(`cf-build: stable branch ${branch}`);
		runOpenNext(process.env);
		runLogrocketIfPresent(process.env);
		return;
	}

	const { env, slug, self } = await resolvePreviewBuildEnv({ branch });
	console.log(`cf-build: preview ${slug} → ${self}`);
	console.log(
		`cf-build: NEXT_PUBLIC_AUTH_SVC_URL=${env.NEXT_PUBLIC_AUTH_SVC_URL}`,
	);
	runOpenNext(env);
	runLogrocketIfPresent(env);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
