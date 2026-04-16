import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./authClient", () => ({
	getClientJwt: vi.fn(),
}));

import { getClientJwt } from "./authClient";
import { tokenCache } from "./tokenCache";

describe("tokenCache", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		tokenCache.clear();
	});

	describe("getToken", () => {
		it("fetches and caches token when cache is empty", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-123");

			const result = await tokenCache.getToken(null, false);

			expect(result).toBe("jwt-123");
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});

		it("returns cached token when same org and not stale", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-first");
			await tokenCache.getToken(null, false);
			vi.mocked(getClientJwt).mockResolvedValue("jwt-second");

			const result = await tokenCache.getToken(null, false);

			expect(result).toBe("jwt-first");
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});

		it("refetches when forceRefresh is true", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-first");
			await tokenCache.getToken(null, false);
			vi.mocked(getClientJwt).mockResolvedValue("jwt-second");

			const result = await tokenCache.getToken(null, true);

			expect(result).toBe("jwt-second");
			expect(getClientJwt).toHaveBeenCalledTimes(2);
		});

		it("clears cache and refetches when organizationId changes", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-org-a");
			await tokenCache.getToken("org-a", false);
			vi.mocked(getClientJwt).mockResolvedValue("jwt-org-b");

			const result = await tokenCache.getToken("org-b", false);

			expect(result).toBe("jwt-org-b");
			expect(getClientJwt).toHaveBeenCalledTimes(2);
		});

		it("deduplicates concurrent getToken calls", async () => {
			let resolve: (v: string | null) => void;
			vi.mocked(getClientJwt).mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					}),
			);

			const p1 = tokenCache.getToken(null, false);
			const p2 = tokenCache.getToken(null, false);
			resolve!("jwt-dedup");
			const [r1, r2] = await Promise.all([p1, p2]);

			expect(r1).toBe("jwt-dedup");
			expect(r2).toBe("jwt-dedup");
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});

		it("returns null and clears cache when fetch returns null", async () => {
			vi.mocked(getClientJwt).mockResolvedValue(null);

			const result = await tokenCache.getToken(null, false);

			expect(result).toBeNull();
			expect(tokenCache.isValid(null)).toBe(false);
		});

		it("clears cache when fetch throws", async () => {
			vi.mocked(getClientJwt).mockRejectedValue(new Error("Auth failed"));

			await expect(tokenCache.getToken(null, false)).rejects.toThrow(
				"Auth failed",
			);
			expect(tokenCache.isValid(null)).toBe(false);
		});
	});

	describe("clear", () => {
		it("resets cache so next getToken refetches", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-1");
			await tokenCache.getToken(null, false);
			tokenCache.clear();
			vi.mocked(getClientJwt).mockResolvedValue("jwt-2");

			const result = await tokenCache.getToken(null, false);

			expect(result).toBe("jwt-2");
			expect(getClientJwt).toHaveBeenCalledTimes(2);
		});
	});

	describe("forceRefresh", () => {
		it("refetches using last known organizationId", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-old");
			await tokenCache.getToken(null, false);
			vi.mocked(getClientJwt).mockResolvedValue("jwt-new");

			const result = await tokenCache.forceRefresh();

			expect(result).toBe("jwt-new");
			expect(getClientJwt).toHaveBeenCalledTimes(2);
		});
	});

	describe("getCachedToken", () => {
		it("returns cached token when not stale", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-cached");
			await tokenCache.getToken(null, false);
			vi.mocked(getClientJwt).mockResolvedValue("jwt-other");

			const result = await tokenCache.getCachedToken();

			expect(result).toBe("jwt-cached");
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});

		it("refetches when cache is empty", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt-from-getCached");

			const result = await tokenCache.getCachedToken();

			expect(result).toBe("jwt-from-getCached");
			expect(getClientJwt).toHaveBeenCalledTimes(1);
		});
	});

	describe("isValid", () => {
		it("returns true when cache matches org and is not stale", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt");
			await tokenCache.getToken(null, false);

			expect(tokenCache.isValid(null)).toBe(true);
		});

		it("returns false when cache is empty", () => {
			expect(tokenCache.isValid(null)).toBe(false);
		});

		it("returns false when organizationId does not match", async () => {
			vi.mocked(getClientJwt).mockResolvedValue("jwt");
			await tokenCache.getToken("org-1", false);

			expect(tokenCache.isValid("org-2")).toBe(false);
		});
	});
});
