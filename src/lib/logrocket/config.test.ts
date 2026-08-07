import { afterEach, describe, expect, it, vi } from "vitest";
import { getLogRocketConfig } from "./config";

describe("getLogRocketConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("is disabled and never throws when the app ID is unset", () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "");
		expect(() => getLogRocketConfig()).not.toThrow();
		expect(getLogRocketConfig().enabled).toBe(false);
	});

	it("is enabled when the app ID is set", () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "org/app");
		expect(getLogRocketConfig().enabled).toBe(true);
		expect(getLogRocketConfig().appId).toBe("org/app");
	});

	it("returns the configured root hostname", () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ROOT_HOSTNAME", ".cartera.credit");
		expect(getLogRocketConfig().rootHostname).toBe(".cartera.credit");
	});

	it("defaults the root hostname to an empty string when unset", () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ROOT_HOSTNAME", "");
		expect(getLogRocketConfig().rootHostname).toBe("");
	});

	it("builds the release from environment and commit SHA", () => {
		vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "production");
		vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "abc1234");
		expect(getLogRocketConfig().release).toBe("workflow@production-abc1234");
	});

	it("falls back to 'local' in the release when no commit SHA is set", () => {
		vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "development");
		vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "");
		expect(getLogRocketConfig().release).toBe("workflow@development-local");
	});
});
