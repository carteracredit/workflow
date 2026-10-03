/**
 * Managed by harness/scripts/sync.mjs — do not edit in consumer repos.
 * Source: harness/scripts/preview-slug.mjs
 *
 * One slug per git branch. Used as:
 *   frontend alias: https://<slug>-<worker>.carteracredit.workers.dev
 *   backend stack:  https://<worker>-<slug>.carteracredit.workers.dev
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PREVIEW_SLUG_MAX = 32;

const STABLE_BRANCHES = new Set(["main", "dev", "master"]);

export function isStableBranch(branch) {
	return STABLE_BRANCHES.has(String(branch ?? "").trim());
}

export function branchFromEnv(env = process.env) {
	return (
		env.PREVIEW_BRANCH ||
		env.WORKERS_CI_BRANCH ||
		env.GITHUB_HEAD_REF ||
		env.GITHUB_REF_NAME ||
		""
	).trim();
}

/**
 * Sanitize a git branch into a DNS-safe Cloudflare preview alias / worker suffix.
 * Aliases must start with a letter; truncated slugs append `-<6 hex sha1>`.
 */
export function previewSlug(branch) {
	const raw = String(branch ?? "").trim();
	let slug = raw
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!slug) slug = "preview";
	if (!/^[a-z]/.test(slug)) slug = `p-${slug}`;
	if (slug.length <= PREVIEW_SLUG_MAX) return slug;
	const hash = createHash("sha1").update(raw).digest("hex").slice(0, 6);
	const keep = PREVIEW_SLUG_MAX - 1 - hash.length;
	return `${slug.slice(0, keep).replace(/-+$/g, "")}-${hash}`;
}

function isInvokedAsCli() {
	const self = fileURLToPath(import.meta.url);
	const argv1 = process.argv[1];
	if (!argv1) return false;
	return resolve(argv1) === self;
}

if (isInvokedAsCli()) {
	const branch = process.argv[2] || branchFromEnv();
	if (!branch) {
		console.error("usage: node preview-slug.mjs <branch>");
		process.exit(1);
	}
	process.stdout.write(`${previewSlug(branch)}\n`);
}
