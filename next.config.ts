import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Determine environment from NEXT_PUBLIC_ENVIRONMENT (set in Cloudflare Worker config)
// Set NEXT_PUBLIC_ENVIRONMENT=development for dev branch, NEXT_PUBLIC_ENVIRONMENT=production for main branch
const sentryEnvironment =
	process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || "development";

const nextConfig: NextConfig = {
	/* config options here */
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

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	tunnelRoute: "/monitoring",

	// Set the release name based on environment for better tracking in Sentry
	release: {
		name: `workflow@${sentryEnvironment}`,
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
