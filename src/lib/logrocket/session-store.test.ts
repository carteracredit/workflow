import { afterEach, describe, expect, it } from "vitest";
import { getCachedSessionUrl, setCachedSessionUrl } from "./session-store";

describe("logrocket/session-store", () => {
	afterEach(() => {
		setCachedSessionUrl(undefined);
	});

	it("starts with no cached session URL", () => {
		expect(getCachedSessionUrl()).toBeUndefined();
	});

	it("stores and returns the session URL", () => {
		setCachedSessionUrl("https://app.logrocket.com/session/abc");
		expect(getCachedSessionUrl()).toBe("https://app.logrocket.com/session/abc");
	});

	it("can clear the cached session URL", () => {
		setCachedSessionUrl("https://app.logrocket.com/session/abc");
		setCachedSessionUrl(undefined);
		expect(getCachedSessionUrl()).toBeUndefined();
	});
});
