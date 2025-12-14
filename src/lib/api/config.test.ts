import { describe, expect, it } from "vitest";
import { DEFAULT_API_BASE_URL, getUpstreamApiBaseUrl } from "./config";

describe("api/config", () => {
	it("prefers ALGTOOLS_API_BASE_URL over NEXT_PUBLIC_ALGTOOLS_API_BASE_URL", () => {
		const prevAlg = process.env.ALGTOOLS_API_BASE_URL;
		const prevPublic = process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;

		try {
			process.env.ALGTOOLS_API_BASE_URL = "https://server.example";
			process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL = "https://public.example";
			expect(getUpstreamApiBaseUrl()).toBe("https://server.example");
		} finally {
			if (prevAlg === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
			else process.env.ALGTOOLS_API_BASE_URL = prevAlg;
			if (prevPublic === undefined)
				delete process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;
			else process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL = prevPublic;
		}
	});

	it("falls back to DEFAULT_API_BASE_URL when env vars are unset", () => {
		const prevAlg = process.env.ALGTOOLS_API_BASE_URL;
		const prevPublic = process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;

		try {
			delete process.env.ALGTOOLS_API_BASE_URL;
			delete process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;
			expect(getUpstreamApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
		} finally {
			if (prevAlg === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
			else process.env.ALGTOOLS_API_BASE_URL = prevAlg;
			if (prevPublic === undefined)
				delete process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;
			else process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL = prevPublic;
		}
	});

	it("uses NEXT_PUBLIC_ALGTOOLS_API_BASE_URL when server env var is unset", () => {
		const prevAlg = process.env.ALGTOOLS_API_BASE_URL;
		const prevPublic = process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;

		try {
			delete process.env.ALGTOOLS_API_BASE_URL;
			process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL = "https://public.example";
			expect(getUpstreamApiBaseUrl()).toBe("https://public.example");
		} finally {
			if (prevAlg === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
			else process.env.ALGTOOLS_API_BASE_URL = prevAlg;
			if (prevPublic === undefined)
				delete process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL;
			else process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL = prevPublic;
		}
	});
});
