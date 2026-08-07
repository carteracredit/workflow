import { afterEach, describe, expect, it, vi } from "vitest";
import { withLogRocketHeader } from "./logrocket-headers";

vi.mock("@/lib/logrocket/session", () => ({
	getCachedSessionUrl: vi.fn(),
}));

import { getCachedSessionUrl } from "@/lib/logrocket/session";

describe("withLogRocketHeader", () => {
	afterEach(() => {
		vi.mocked(getCachedSessionUrl).mockReset();
	});

	it("returns the headers unchanged when no LogRocket session is available", () => {
		vi.mocked(getCachedSessionUrl).mockReturnValue(undefined);
		const headers = withLogRocketHeader({ Authorization: "Bearer x" });
		expect(new Headers(headers).get("X-LogRocket-Session-URL")).toBeNull();
		expect(new Headers(headers).get("Authorization")).toBe("Bearer x");
	});

	it("adds the X-LogRocket-Session-URL header when a session is available", () => {
		vi.mocked(getCachedSessionUrl).mockReturnValue(
			"https://app.logrocket.com/org/app/sessions/abc",
		);
		const headers = withLogRocketHeader({ Authorization: "Bearer x" });
		const result = new Headers(headers);
		expect(result.get("X-LogRocket-Session-URL")).toBe(
			"https://app.logrocket.com/org/app/sessions/abc",
		);
		expect(result.get("Authorization")).toBe("Bearer x");
	});

	it("defaults to an empty headers object when called without arguments", () => {
		vi.mocked(getCachedSessionUrl).mockReturnValue(undefined);
		expect(() => withLogRocketHeader()).not.toThrow();
	});
});
