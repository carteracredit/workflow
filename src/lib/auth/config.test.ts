import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAuthServiceUrl, getAuthAppUrl, getEnvironment } from "./config";

describe("auth config", () => {
	const originalServiceUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
	const originalAppUrl = process.env.NEXT_PUBLIC_AUTH_APP_URL;

	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
		delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
	});

	afterEach(() => {
		if (originalServiceUrl !== undefined) {
			process.env.NEXT_PUBLIC_AUTH_SERVICE_URL = originalServiceUrl;
		}
		if (originalAppUrl !== undefined) {
			process.env.NEXT_PUBLIC_AUTH_APP_URL = originalAppUrl;
		}
	});

	describe("getAuthServiceUrl", () => {
		it("returns default dev URL when env is not set", () => {
			expect(getAuthServiceUrl()).toBe(
				"https://auth-svc.carteracredit.workers.dev",
			);
		});

		it("returns env value when NEXT_PUBLIC_AUTH_SERVICE_URL is set", () => {
			process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
				"https://custom-auth.example.com";
			expect(getAuthServiceUrl()).toBe("https://custom-auth.example.com");
		});
	});

	describe("getAuthAppUrl", () => {
		it("returns default dev URL when env is not set", () => {
			expect(getAuthAppUrl()).toBe("https://auth.carteracredit.workers.dev");
		});

		it("returns env value when NEXT_PUBLIC_AUTH_APP_URL is set", () => {
			process.env.NEXT_PUBLIC_AUTH_APP_URL =
				"https://custom-auth-app.example.com";
			expect(getAuthAppUrl()).toBe("https://custom-auth-app.example.com");
		});
	});

	describe("getEnvironment", () => {
		it("returns 'dev' when auth service URL does not contain carteracredit.com", () => {
			process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
				"https://auth-svc.carteracredit.workers.dev";
			expect(getEnvironment()).toBe("dev");
		});

		it("returns 'prod' when auth service URL contains carteracredit.com", () => {
			process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
				"https://auth-svc.carteracredit.com";
			expect(getEnvironment()).toBe("prod");
		});

		it("returns 'dev' when using default URL", () => {
			expect(getEnvironment()).toBe("dev");
		});
	});
});
