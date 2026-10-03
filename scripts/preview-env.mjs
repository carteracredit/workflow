/**
 * Managed by harness/scripts/sync.mjs — do not edit in consumer repos.
 * Source: harness/scripts/preview-env.mjs
 *
 * Resolve NEXT_PUBLIC_* for a frontend preview alias: stable-dev hosts by
 * default, same-slug backend stack / sibling aliases when they answer.
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { previewSlug } from "./preview-slug.mjs";

export const WORKERS_DEV = "carteracredit.workers.dev";

export const DEV_SVC = {
	NEXT_PUBLIC_AUTH_SVC_URL: `https://auth-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_AUTH_SERVICE_URL: `https://auth-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_AUTH_URL: `https://auth-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_CASES_SVC_URL: `https://cases-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_CASES_SERVICE_URL: `https://cases-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_NOTIFICATIONS_SVC_URL: `https://notifications-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_CHAT_SVC_URL: `https://chat-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_WORKFLOW_SERVICE_URL: `https://workflow-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_PROXY_SVC_URL: `https://proxy-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_PROXY_SERVICE_URL: `https://proxy-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_CAL_SVC_URL: `https://cal-svc.${WORKERS_DEV}`,
	NEXT_PUBLIC_DOC_SVC_URL: `https://doc-svc.${WORKERS_DEV}`,
};

export const DEV_FE = {
	NEXT_PUBLIC_AUTH_APP_URL: `https://auth.${WORKERS_DEV}`,
	NEXT_PUBLIC_CASES_APP_URL: `https://cases.${WORKERS_DEV}`,
	NEXT_PUBLIC_ADMIN_URL: `https://admin.${WORKERS_DEV}`,
	NEXT_PUBLIC_CONTRACTOR_APP_URL: `https://contractor.${WORKERS_DEV}`,
	NEXT_PUBLIC_WORKFLOW_APP_URL: `https://workflow.${WORKERS_DEV}`,
	NEXT_PUBLIC_FORMS_APP_URL: `https://forms.${WORKERS_DEV}`,
	NEXT_PUBLIC_WIDGETS_APP_URL: `https://widgets.${WORKERS_DEV}`,
	NEXT_PUBLIC_AUTH_REDIRECT_URL: `https://cases.${WORKERS_DEV}`,
};

export const SVC_STACK = [
	[
		"auth-svc",
		[
			"NEXT_PUBLIC_AUTH_SVC_URL",
			"NEXT_PUBLIC_AUTH_SERVICE_URL",
			"NEXT_PUBLIC_AUTH_URL",
		],
	],
	["cases-svc", ["NEXT_PUBLIC_CASES_SVC_URL", "NEXT_PUBLIC_CASES_SERVICE_URL"]],
	["notifications-svc", ["NEXT_PUBLIC_NOTIFICATIONS_SVC_URL"]],
	["chat-svc", ["NEXT_PUBLIC_CHAT_SVC_URL"]],
	["workflow-svc", ["NEXT_PUBLIC_WORKFLOW_SERVICE_URL"]],
	["proxy-svc", ["NEXT_PUBLIC_PROXY_SVC_URL", "NEXT_PUBLIC_PROXY_SERVICE_URL"]],
	["cal-svc", ["NEXT_PUBLIC_CAL_SVC_URL"]],
	["doc-svc", ["NEXT_PUBLIC_DOC_SVC_URL"]],
];

export const FE_ALIAS = [
	["auth", ["NEXT_PUBLIC_AUTH_APP_URL"]],
	["cases", ["NEXT_PUBLIC_CASES_APP_URL", "NEXT_PUBLIC_AUTH_REDIRECT_URL"]],
	["admin", ["NEXT_PUBLIC_ADMIN_URL"]],
	["contractor", ["NEXT_PUBLIC_CONTRACTOR_APP_URL"]],
	["workflow", ["NEXT_PUBLIC_WORKFLOW_APP_URL"]],
	["forms", ["NEXT_PUBLIC_FORMS_APP_URL"]],
	["widgets", ["NEXT_PUBLIC_WIDGETS_APP_URL"]],
];

export const SELF_URL_VAR = {
	auth: "NEXT_PUBLIC_AUTH_APP_URL",
	cases: "NEXT_PUBLIC_CASES_APP_URL",
	admin: "NEXT_PUBLIC_ADMIN_URL",
	contractor: "NEXT_PUBLIC_CONTRACTOR_APP_URL",
	workflow: "NEXT_PUBLIC_WORKFLOW_APP_URL",
	forms: "NEXT_PUBLIC_FORMS_APP_URL",
	widgets: "NEXT_PUBLIC_WIDGETS_APP_URL",
};

export function workerName(cwd = process.cwd(), env = process.env) {
	try {
		const text = readFileSync(join(cwd, "wrangler.jsonc"), "utf8");
		const match = text.match(/"name"\s*:\s*"([^"]+)"/);
		if (match?.[1]) return match[1];
	} catch {
		/* fall through */
	}
	return env.npm_package_name || basename(cwd);
}

export function aliasOrigin(slug, worker) {
	return `https://${slug}-${worker}.${WORKERS_DEV}`;
}

export function stackOrigin(svc, slug) {
	return `https://${svc}-${slug}.${WORKERS_DEV}`;
}

const PREVIEW_PROBE_UA = "cartera-preview-env";
const HEALTHZ_ATTEMPTS = 3;

function probeHeaders() {
	return { "user-agent": PREVIEW_PROBE_UA };
}

export async function probeOk(url) {
	try {
		const res = await fetch(url, {
			method: "GET",
			redirect: "manual",
			headers: probeHeaders(),
			signal: AbortSignal.timeout(4000),
		});
		return res.status >= 200 && res.status < 400;
	} catch {
		return false;
	}
}

export async function probeHealthz(base) {
	const url = `${base.replace(/\/$/, "")}/healthz`;
	for (let attempt = 1; attempt <= HEALTHZ_ATTEMPTS; attempt++) {
		try {
			const res = await fetch(url, {
				headers: probeHeaders(),
				signal: AbortSignal.timeout(4000),
			});
			if (res.ok) {
				const body = await res.json();
				if (body?.ok === true) return true;
			}
		} catch {
			// retry remaining attempts
		}
		if (attempt < HEALTHZ_ATTEMPTS) {
			await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
		}
	}
	return false;
}

/**
 * Keys in `.env.example` that are `NEXT_PUBLIC_*` with a non-empty value.
 * Empty assignments (`NEXT_PUBLIC_SENTRY_DSN=`) stay optional.
 */
export function requiredPublicEnvKeys(exampleText) {
	const keys = [];
	for (const line of String(exampleText || "").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)=(.*)$/);
		if (!match) continue;
		if (match[2].trim() === "") continue;
		keys.push(match[1]);
	}
	return keys;
}

export function examplePublicEnvDefaults(exampleText) {
	const out = {};
	for (const line of String(exampleText || "").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)=(.*)$/);
		if (!match) continue;
		const value = match[2].trim();
		if (value === "") continue;
		out[match[1]] = value;
	}
	return out;
}

export function assertRequiredPublicEnv(env, keys) {
	const missing = (keys || []).filter((key) => {
		const value = env[key];
		return typeof value !== "string" || value.trim() === "";
	});
	if (missing.length) {
		throw new Error(
			`preview build missing required NEXT_PUBLIC_* after overrides: ${missing.join(", ")}. ` +
				"preview-env.mjs should have filled these from stable-dev defaults.",
		);
	}
}

export function readRequiredPublicEnvKeys(cwd = process.cwd()) {
	try {
		return requiredPublicEnvKeys(readFileSync(`${cwd}/.env.example`, "utf8"));
	} catch (err) {
		if (err && err.code === "ENOENT") {
			throw new Error("preview build: .env.example is missing");
		}
		throw err;
	}
}

function readExampleDefaults(cwd = process.cwd()) {
	try {
		return examplePublicEnvDefaults(
			readFileSync(`${cwd}/.env.example`, "utf8"),
		);
	} catch (err) {
		if (err && err.code === "ENOENT") return {};
		throw err;
	}
}

export async function resolvePreviewBuildEnv({
	branch,
	slug: slugArg,
	worker: workerArg,
	env: baseEnv = process.env,
	cwd = process.cwd(),
} = {}) {
	const worker = workerArg || workerName(cwd, baseEnv);
	const slug = slugArg || previewSlug(branch);
	const self = aliasOrigin(slug, worker);
	const env = {
		...readExampleDefaults(cwd),
		...baseEnv,
		NEXT_PUBLIC_ENVIRONMENT: "development",
		NEXT_PUBLIC_ENVIROMENT: "development",
		...DEV_SVC,
		...DEV_FE,
	};

	for (const [svc, keys] of SVC_STACK) {
		const origin = stackOrigin(svc, slug);
		if (await probeHealthz(origin)) {
			for (const key of keys) env[key] = origin;
			console.log(`linked ${svc} stack ${origin}`);
		}
	}

	for (const [peer, keys] of FE_ALIAS) {
		if (peer === worker) continue;
		const origin = aliasOrigin(slug, peer);
		if (await probeOk(origin)) {
			for (const key of keys) env[key] = origin;
			console.log(`linked frontend alias ${origin}`);
		}
	}

	const selfVar = SELF_URL_VAR[worker];
	if (selfVar) env[selfVar] = self;
	if (worker === "cases") env.NEXT_PUBLIC_AUTH_REDIRECT_URL = self;

	assertRequiredPublicEnv(env, readRequiredPublicEnvKeys(cwd));
	return { env, worker, slug, self };
}
