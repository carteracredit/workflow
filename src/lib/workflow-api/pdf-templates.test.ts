import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	listPdfTemplates,
	getPdfTemplateFields,
	listPdfTemplateVersions,
} from "./pdf-templates";

const BASE_URL = "https://cases-svc.carteracredit.workers.dev";

const mockTemplateSummary = {
	id: "tpl-1",
	name: "UCC Financing Statement",
	description: "UCC-1 form",
	activeVersion: { id: "ver-1", version: 2, fileName: "ucc.pdf" },
};

const mockFieldsResult = {
	pdfTemplateId: "tpl-1",
	pdfTemplateVersionId: "ver-1",
	version: 2,
	fileName: "ucc.pdf",
	fields: [
		{ name: "debtor_name", type: "text" },
		{ name: "accept_terms", type: "checkbox" },
	],
};

function mockFetch(body: unknown, status = 200) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			statusText: status === 200 ? "OK" : "Error",
			headers: { get: () => "application/json" },
			json: () => Promise.resolve(body),
			text: () => Promise.resolve(""),
		}),
	);
}

describe("pdf-templates API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_CASES_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listPdfTemplates", () => {
		it("fetches templates from correct URL", async () => {
			mockFetch({ success: true, result: [mockTemplateSummary] });

			const result = await listPdfTemplates();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/pdf-templates`,
				expect.any(Object),
			);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("tpl-1");
			expect(result[0].activeVersion?.fileName).toBe("ucc.pdf");
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({ success: true, result: [] });

			await listPdfTemplates({ jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});

		it("uses custom NEXT_PUBLIC_CASES_SERVICE_URL when set", async () => {
			process.env.NEXT_PUBLIC_CASES_SERVICE_URL =
				"https://custom-cases.example";
			mockFetch({ success: true, result: [] });

			await listPdfTemplates();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				"https://custom-cases.example/pdf-templates",
				expect.any(Object),
			);
		});

		it("returns empty array when no templates exist", async () => {
			mockFetch({ success: true, result: [] });

			const result = await listPdfTemplates();

			expect(result).toEqual([]);
		});

		it("appends bypass_cache=true when bypassCache option is set", async () => {
			mockFetch({ success: true, result: [] });

			await listPdfTemplates({ bypassCache: true });

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).toContain("bypass_cache=true");
		});

		it("does not append bypass_cache when bypassCache is not set", async () => {
			mockFetch({ success: true, result: [] });

			await listPdfTemplates();

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).not.toContain("bypass_cache");
		});
	});

	describe("getPdfTemplateFields", () => {
		it("fetches template fields by ID", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			const result = await getPdfTemplateFields("tpl-1");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/pdf-templates/tpl-1/fields`,
				expect.any(Object),
			);
			expect(result.pdfTemplateId).toBe("tpl-1");
			expect(result.fields).toHaveLength(2);
			expect(result.fields[0].name).toBe("debtor_name");
			expect(result.fields[0].type).toBe("text");
		});

		it("URL-encodes pdfTemplateId with special characters", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			await getPdfTemplateFields("tpl abc/123");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/pdf-templates/tpl%20abc%2F123/fields`,
				expect.any(Object),
			);
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			await getPdfTemplateFields("tpl-1", { jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});

		it("throws on non-2xx response", async () => {
			mockFetch({ success: false, error: "Template not found" }, 404);

			await expect(getPdfTemplateFields("nonexistent")).rejects.toThrow();
		});

		it("appends bypass_cache=true when bypassCache option is set", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			await getPdfTemplateFields("tpl-1", { bypassCache: true });

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).toContain("bypass_cache=true");
		});

		it("does not append bypass_cache when bypassCache is not set", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			await getPdfTemplateFields("tpl-1");

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).not.toContain("bypass_cache");
		});

		it("appends versionId when given, to pin a specific version", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			await getPdfTemplateFields("tpl-1", { versionId: "ver-1" });

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).toContain("versionId=ver-1");
		});

		it("does not append versionId when not given", async () => {
			mockFetch({ success: true, result: mockFieldsResult });

			await getPdfTemplateFields("tpl-1");

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).not.toContain("versionId");
		});
	});

	describe("listPdfTemplateVersions", () => {
		const mockVersions = [
			{
				id: "ver-2",
				version: 2,
				fileName: "ucc-v2.pdf",
				createdAt: "2026-02-01T00:00:00.000Z",
				isActive: true,
			},
			{
				id: "ver-1",
				version: 1,
				fileName: "ucc-v1.pdf",
				createdAt: "2026-01-01T00:00:00.000Z",
				isActive: false,
			},
		];

		it("fetches version history by template ID", async () => {
			mockFetch({ success: true, result: mockVersions });

			const result = await listPdfTemplateVersions("tpl-1");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/pdf-templates/tpl-1/versions`,
				expect.any(Object),
			);
			expect(result).toHaveLength(2);
			expect(result[0].isActive).toBe(true);
		});

		it("URL-encodes pdfTemplateId with special characters", async () => {
			mockFetch({ success: true, result: mockVersions });

			await listPdfTemplateVersions("tpl abc/123");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/pdf-templates/tpl%20abc%2F123/versions`,
				expect.any(Object),
			);
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({ success: true, result: mockVersions });

			await listPdfTemplateVersions("tpl-1", { jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});

		it("returns empty array when there are no versions", async () => {
			mockFetch({ success: true, result: [] });

			const result = await listPdfTemplateVersions("tpl-1");

			expect(result).toEqual([]);
		});

		it("appends bypass_cache=true when bypassCache option is set", async () => {
			mockFetch({ success: true, result: mockVersions });

			await listPdfTemplateVersions("tpl-1", { bypassCache: true });

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).toContain("bypass_cache=true");
		});

		it("throws on non-2xx response", async () => {
			mockFetch({ success: false, error: "Template not found" }, 404);

			await expect(listPdfTemplateVersions("nonexistent")).rejects.toThrow();
		});
	});
});
