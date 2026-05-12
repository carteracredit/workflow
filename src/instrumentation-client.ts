// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { getSentryDsn } from "@/lib/auth/config";

const dsn = getSentryDsn();
const environment =
	process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || "development";
const isDevelopment = environment === "development";

Sentry.init({
	dsn,
	environment,
	integrations: [Sentry.replayIntegration()],
	tracesSampleRate: isDevelopment ? 1.0 : 0.2,
	enableLogs: true,
	replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
	replaysOnErrorSampleRate: 1.0,
	sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
