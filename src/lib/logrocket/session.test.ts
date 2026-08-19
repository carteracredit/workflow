import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getCachedSessionUrl, setCachedSessionUrl } from "./session-store";

const getSessionURLMock = vi.fn((callback: (sessionUrl: string) => void) =>
	callback("https://app.logrocket.com/session/abc"),
);

vi.mock("logrocket", () => ({
	default: { getSessionURL: getSessionURLMock },
}));

const dir = dirname(fileURLToPath(import.meta.url));

describe("logrocket/session", () => {
	afterEach(() => {
		getSessionURLMock.mockClear();
		setCachedSessionUrl(undefined);
	});

	it("forwards the resolved session URL to the callback", async () => {
		const { getSessionUrl } = await import("./session");
		const callback = vi.fn();
		getSessionUrl(callback);
		expect(callback).toHaveBeenCalledWith(
			"https://app.logrocket.com/session/abc",
		);
	});

	it("caches the resolved session URL in the shared store for later synchronous reads", async () => {
		const { getSessionUrl } = await import("./session");
		getSessionUrl(() => {});
		expect(getCachedSessionUrl()).toBe("https://app.logrocket.com/session/abc");
	});

	it("makes the cached URL readable by withLogRocketHeader", async () => {
		const { getSessionUrl } = await import("./session");
		const { withLogRocketHeader } =
			await import("@/lib/workflow-api/logrocket-headers");
		getSessionUrl(() => {});
		const headers = withLogRocketHeader({ Authorization: "Bearer x" });
		expect(new Headers(headers).get("X-LogRocket-Session-URL")).toBe(
			"https://app.logrocket.com/session/abc",
		);
		expect(new Headers(headers).get("Authorization")).toBe("Bearer x");
	});
});

describe("logrocket/session-store source contract", () => {
	it("is a server-safe module: no use client directive and no logrocket SDK import", () => {
		const source = readFileSync(join(dir, "session-store.ts"), "utf8");
		expect(source).not.toMatch(/^["']use client["']/m);
		expect(source).not.toMatch(/from ["']logrocket["']/);
	});
});
