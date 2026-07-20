import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
	process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/1";
}

afterEach(() => {
	cleanup();
});
