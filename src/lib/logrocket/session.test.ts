import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionURLMock = vi.fn((callback: (sessionUrl: string) => void) =>
	callback("https://app.logrocket.com/session/abc"),
);

vi.mock("logrocket", () => ({
	default: { getSessionURL: getSessionURLMock },
}));

describe("logrocket/session", () => {
	afterEach(() => {
		getSessionURLMock.mockClear();
	});

	it("forwards the resolved session URL to the callback", async () => {
		const { getSessionUrl } = await import("./session");
		const callback = vi.fn();
		getSessionUrl(callback);
		expect(callback).toHaveBeenCalledWith(
			"https://app.logrocket.com/session/abc",
		);
	});

	it("caches the resolved session URL for later synchronous reads", async () => {
		const { getSessionUrl, getCachedSessionUrl } = await import("./session");
		getSessionUrl(() => {});
		expect(getCachedSessionUrl()).toBe("https://app.logrocket.com/session/abc");
	});
});
