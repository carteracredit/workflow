import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
	getCachedSessionUrl,
	setCachedSessionUrl,
} from "@/lib/logrocket/session-store";

import { withLogRocketHeader } from "./logrocket-headers";

const dir = dirname(fileURLToPath(import.meta.url));

describe("withLogRocketHeader", () => {
	afterEach(() => {
		setCachedSessionUrl(undefined);
	});

	it("returns the headers unchanged when no LogRocket session is available", () => {
		const headers = withLogRocketHeader({ Authorization: "Bearer x" });
		expect(new Headers(headers).get("X-LogRocket-Session-URL")).toBeNull();
		expect(new Headers(headers).get("Authorization")).toBe("Bearer x");
	});

	it("adds the X-LogRocket-Session-URL header when a session is available", () => {
		setCachedSessionUrl("https://app.logrocket.com/org/app/sessions/abc");
		const headers = withLogRocketHeader({ Authorization: "Bearer x" });
		const result = new Headers(headers);
		expect(result.get("X-LogRocket-Session-URL")).toBe(
			"https://app.logrocket.com/org/app/sessions/abc",
		);
		expect(result.get("Authorization")).toBe("Bearer x");
	});

	it("defaults to an empty headers object when called without arguments", () => {
		expect(() => withLogRocketHeader()).not.toThrow();
	});
});

describe("withLogRocketHeader server-safety", () => {
	it("imports the session URL from the shared store, not the client SDK module", () => {
		const source = readFileSync(join(dir, "logrocket-headers.ts"), "utf8");
		expect(source).toContain("@/lib/logrocket/session-store");
		expect(source).not.toMatch(/from ["']@\/lib\/logrocket\/session["']/);
	});

	it("does not throw when no session is cached (server-action scenario)", () => {
		expect(getCachedSessionUrl()).toBeUndefined();
		expect(() =>
			withLogRocketHeader({ Authorization: "Bearer x" }),
		).not.toThrow();
	});
});
