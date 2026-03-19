import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./authClient", () => ({
	getClientJwt: vi.fn(),
}));

import { getClientJwt } from "./authClient";
import { tokenStore, clearTokenStore, getClientJwtCached } from "./tokenStore";

describe("tokenStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearTokenStore();
	});

	describe("clearTokenStore", () => {
		it("resets token state to initial", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("some-jwt");
			await getClientJwtCached();
			expect(tokenStore.get().token).toBe("some-jwt");

			clearTokenStore();
			expect(tokenStore.get().token).toBeNull();
			expect(tokenStore.get().expiresAt).toBe(0);
			expect(tokenStore.get().error).toBeNull();
		});
	});

	describe("getClientJwtCached", () => {
		it("fetches and caches token when cache is empty", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-123");

			const result = await getClientJwtCached();

			expect(result).toBe("jwt-123");
			expect(tokenStore.get().token).toBe("jwt-123");
			expect(tokenStore.get().expiresAt).toBeGreaterThan(Date.now());
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});

		it("returns cached token when not expired and forceRefetch is false", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-first");
			await getClientJwtCached();
			vi.mocked(getClientJwt).mockResolvedValue("jwt-second");

			const result = await getClientJwtCached(false);

			expect(result).toBe("jwt-first");
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});

		it("refetches when forceRefetch is true", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-first");
			await getClientJwtCached();
			vi.mocked(getClientJwt).mockResolvedValue("jwt-second");

			const result = await getClientJwtCached(true);

			expect(result).toBe("jwt-second");
			expect(getClientJwt).toHaveBeenCalledTimes(2);
		});

		it("sets error in store when fetch fails", async () => {
			vi.mocked(getClientJwt).mockRejectedValue(new Error("Auth failed"));

			const result = await getClientJwtCached();

			expect(result).toBeNull();
			expect(tokenStore.get().error).toEqual(new Error("Auth failed"));
			expect(tokenStore.get().token).toBeNull();
		});

		it("sets error when fetch returns null", async () => {
			vi.mocked(getClientJwt).mockResolvedValue(null);

			const result = await getClientJwtCached();

			expect(result).toBeNull();
			expect(tokenStore.get().token).toBeNull();
		});
	});
});
