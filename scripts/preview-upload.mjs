/**
 * Managed by harness/scripts/sync.mjs — do not edit in consumer repos.
 * Source: harness/scripts/preview-upload.mjs
 *
 * Workers Builds non-production deploy command. The OpenNext build already
 * ran via cf-build.mjs; this only uploads `wrangler versions upload
 * --preview-alias <slug>`.
 */
import { execSync } from "node:child_process";

import { aliasOrigin, workerName } from "./preview-env.mjs";
import { branchFromEnv, isStableBranch, previewSlug } from "./preview-slug.mjs";

async function main() {
	const branch = process.env.PREVIEW_ALIAS ? "alias" : branchFromEnv();
	if (!process.env.PREVIEW_ALIAS && isStableBranch(branch)) {
		console.log(`Skipping preview:upload on stable branch ${branch}`);
		process.exit(0);
	}
	if (!branch && !process.env.PREVIEW_ALIAS) {
		console.error("No branch name in WORKERS_CI_BRANCH / GITHUB_HEAD_REF");
		process.exit(1);
	}

	const worker = workerName();
	const slug = process.env.PREVIEW_ALIAS || previewSlug(branch);
	const self = aliasOrigin(slug, worker);
	console.log(`preview:upload ${slug} → ${self}`);
	execSync(
		`pnpm exec wrangler versions upload --config wrangler.jsonc --preview-alias ${slug}`,
		{ stdio: "inherit", env: process.env },
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
