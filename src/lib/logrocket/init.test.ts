import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const getSessionURLMock = vi.fn();

vi.mock("logrocket", () => ({
	default: { init: initMock, getSessionURL: getSessionURLMock },
}));

describe("initLogRocket", () => {
	beforeEach(() => {
		vi.resetModules();
		initMock.mockClear();
		getSessionURLMock.mockClear();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("does not call LogRocket.init when disabled (no app ID)", async () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "");
		const { initLogRocket } = await import("./init");
		initLogRocket();
		expect(initMock).not.toHaveBeenCalled();
	});

	it("calls LogRocket.init with the resolved config when enabled", async () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "org/app");
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ROOT_HOSTNAME", ".cartera.credit");
		const { initLogRocket } = await import("./init");
		initLogRocket();
		expect(initMock).toHaveBeenCalledTimes(1);
		expect(initMock).toHaveBeenCalledWith(
			"org/app",
			expect.objectContaining({
				rootHostname: ".cartera.credit",
				shouldParseXHRBlob: false,
				dom: { inputSanitizer: true, imageSanitizer: true },
				browser: { urlSanitizer: expect.any(Function) },
			}),
		);
		expect(getSessionURLMock).toHaveBeenCalledTimes(1);
	});

	it("omits rootHostname when it is unset", async () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "org/app");
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_ROOT_HOSTNAME", "");
		const { initLogRocket } = await import("./init");
		initLogRocket();
		expect(initMock).toHaveBeenCalledWith(
			"org/app",
			expect.objectContaining({ rootHostname: undefined }),
		);
	});

	it("is idempotent — only initializes once across multiple calls", async () => {
		vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "org/app");
		const { initLogRocket } = await import("./init");
		initLogRocket();
		initLogRocket();
		initLogRocket();
		expect(initMock).toHaveBeenCalledTimes(1);
	});
});
