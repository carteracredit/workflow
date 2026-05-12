// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
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
	tracesSampleRate: isDevelopment ? 1.0 : 0.2,
	enableLogs: true,
	sendDefaultPii: true,
});
