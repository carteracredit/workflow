import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Determine environment from NEXT_PUBLIC_ENVIRONMENT (set in Cloudflare Worker config)
// Set NEXT_PUBLIC_ENVIRONMENT=development for dev branch, NEXT_PUBLIC_ENVIRONMENT=production for main branch
const sentryEnvironment = (
	process.env.NEXT_PUBLIC_ENVIRONMENT ||
	process.env.NODE_ENV ||
	"development"
).trim();

// Commit SHA injected by Cloudflare Workers Builds (unset when building locally).
// Exposed to the client bundle via `env` below so LogRocket can reuse the same
// release identifier as Sentry without requiring a NEXT_PUBLIC_ prefix at the source.
const commitSha = process.env.WORKERS_CI_COMMIT_SHA?.trim() || undefined;

const sentryReleaseName = commitSha
	? `workflow@${sentryEnvironment}-${commitSha}`
	: `workflow@${sentryEnvironment}`;

const nextConfig: NextConfig = {
	env: {
		NEXT_PUBLIC_COMMIT_SHA: commitSha ?? "",
	},
};

export default withSentryConfig(nextConfig, {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: process.env.SENTRY_ORG,

	project: process.env.SENTRY_PROJECT,

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Keep source map files after Sentry upload so logrocket:sourcemaps can
	// upload the same artifacts. Delete them from .open-next/ only after that step
	// (see scripts/logrocket-sourcemaps.mjs) so they are never served publicly.
	sourcemaps: {
		deleteSourcemapsAfterUpload: false,
	},

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// Exclude `/monitoring` from auth middleware matchers or client reporting fails.
	// Known (non-blocking) behavior on Cloudflare/OpenNext: some POSTs return 401 from
	// Sentry ingest with body `bad envelope authentication header` / `username is empty`.
	// Verified 2026-08-08: the tunnel reaches Sentry (same body via direct ingest for bad
	// envelopes); Authorization is not the cause; error+API sample events still arrive.
	// Do not remove the tunnel solely for those 401s — they are envelope-auth rejects for
	// specific payload types, not a total outage.
	tunnelRoute: "/monitoring",

	// Set the release name based on environment (and commit SHA, when available)
	// for better tracking in Sentry
	release: {
		name: sentryReleaseName,
	},

	webpack: {
		// Disabled: app targets Cloudflare Workers, not Vercel Cron.
		automaticVercelMonitors: false,

		// Tree-shaking options for reducing bundle size
		treeshake: {
			// Automatically tree-shake Sentry logger statements to reduce bundle size
			removeDebugLogging: true,
		},
	},
});

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
