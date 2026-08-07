// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { getSentryDsn } from "@/lib/auth/config";
import { initLogRocket } from "@/lib/logrocket/init";
import { getCachedSessionUrl } from "@/lib/logrocket/session";

// Start LogRocket session replay before Sentry so its session URL is
// available (once resolved) to attach to Sentry events via `beforeSend`.
initLogRocket();

const dsn = getSentryDsn();
const environment =
	process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || "development";
const isDevelopment = environment === "development";

Sentry.init({
	dsn,
	environment,
	integrations: [
		Sentry.replayIntegration(),
		Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
	],
	tracesSampleRate: isDevelopment ? 1.0 : 0.2,
	enableLogs: true,
	replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
	replaysOnErrorSampleRate: 1.0,
	sendDefaultPii: true,
	beforeSend(event) {
		const sessionUrl = getCachedSessionUrl();
		if (sessionUrl) {
			event.contexts = {
				...event.contexts,
				logrocket: { sessionURL: sessionUrl },
			};
		}
		return event;
	},
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
