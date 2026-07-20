import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listSignatureTemplates, getSignatureTemplate } from "./signatures";

const BASE_URL = "https://cases-svc.carteracredit.workers.dev";

const mockTemplateSummary = {
	templateId: "tpl-abc123",
	title: "Contrato de crédito",
	signerRoles: [
		{ name: "Client", order: 0 },
		{ name: "Seller", order: 1 },
	],
	updatedAt: 1745000000,
};

const mockTemplateDetail = {
	templateId: "tpl-abc123",
	title: "Contrato de crédito",
	signerRoles: [
		{ name: "Client", order: 0 },
		{ name: "Seller", order: 1 },
	],
	ccRoles: [],
	customFields: [
		{
			name: "Monto del crédito",
			apiId: "monto_credito",
			type: "text",
			required: true,
			label: "Monto",
		},
		{
			name: "Fecha",
			apiId: "fecha_firma",
			type: "date",
			required: false,
			label: null,
		},
	],
	updatedAt: 1745000000,
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

describe("signatures API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_CASES_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listSignatureTemplates", () => {
		it("fetches templates from correct URL", async () => {
			mockFetch({
				success: true,
				result: {
					templates: [mockTemplateSummary],
					page: 1,
					numPages: 1,
					numResults: 1,
				},
			});

			const result = await listSignatureTemplates();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/signatures/templates`,
				expect.any(Object),
			);
			expect(result).toHaveLength(1);
			expect(result[0].templateId).toBe("tpl-abc123");
			expect(result[0].title).toBe("Contrato de crédito");
		});

		it("passes pagination params as URL params", async () => {
			mockFetch({
				success: true,
				result: { templates: [], page: 2, numPages: 3, numResults: 50 },
			});

			await listSignatureTemplates({ page: 2, pageSize: 10 });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/signatures/templates?page=2&page_size=10`,
				expect.any(Object),
			);
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({
				success: true,
				result: { templates: [], page: 1, numPages: 1, numResults: 0 },
			});

			await listSignatureTemplates({ jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});

		it("uses custom NEXT_PUBLIC_CASES_SERVICE_URL when set", async () => {
			process.env.NEXT_PUBLIC_CASES_SERVICE_URL =
				"https://custom-cases.example";
			mockFetch({
				success: true,
				result: { templates: [], page: 1, numPages: 1, numResults: 0 },
			});

			await listSignatureTemplates();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				"https://custom-cases.example/signatures/templates",
				expect.any(Object),
			);
		});

		it("returns empty array when no templates exist", async () => {
			mockFetch({
				success: true,
				result: { templates: [], page: 1, numPages: 0, numResults: 0 },
			});

			const result = await listSignatureTemplates();

			expect(result).toEqual([]);
		});

		it("appends bypass_cache=true when bypassCache option is set", async () => {
			mockFetch({
				success: true,
				result: { templates: [], page: 1, numPages: 0, numResults: 0 },
			});

			await listSignatureTemplates({ bypassCache: true });

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).toContain("bypass_cache=true");
		});

		it("does not append bypass_cache when bypassCache is not set", async () => {
			mockFetch({
				success: true,
				result: { templates: [], page: 1, numPages: 0, numResults: 0 },
			});

			await listSignatureTemplates();

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).not.toContain("bypass_cache");
		});
	});

	describe("getSignatureTemplate", () => {
		it("fetches template detail by ID", async () => {
			mockFetch({ success: true, result: mockTemplateDetail });

			const result = await getSignatureTemplate("tpl-abc123");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/signatures/templates/tpl-abc123`,
				expect.any(Object),
			);
			expect(result.templateId).toBe("tpl-abc123");
			expect(result.title).toBe("Contrato de crédito");
		});

		it("includes signer roles and custom fields in result", async () => {
			mockFetch({ success: true, result: mockTemplateDetail });

			const result = await getSignatureTemplate("tpl-abc123");

			expect(result.signerRoles).toHaveLength(2);
			expect(result.signerRoles[0].name).toBe("Client");
			expect(result.customFields).toHaveLength(2);
			expect(result.customFields[0].apiId).toBe("monto_credito");
			expect(result.customFields[0].required).toBe(true);
		});

		it("URL-encodes templateId with special characters", async () => {
			mockFetch({ success: true, result: mockTemplateDetail });

			await getSignatureTemplate("tpl abc/123");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/signatures/templates/tpl%20abc%2F123`,
				expect.any(Object),
			);
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({ success: true, result: mockTemplateDetail });

			await getSignatureTemplate("tpl-abc123", { jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});

		it("throws on non-2xx response", async () => {
			mockFetch({ success: false, error: "Template not found" }, 404);

			await expect(getSignatureTemplate("nonexistent")).rejects.toThrow();
		});

		it("appends bypass_cache=true when bypassCache option is set", async () => {
			mockFetch({ success: true, result: mockTemplateDetail });

			await getSignatureTemplate("tpl-abc123", { bypassCache: true });

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).toContain("bypass_cache=true");
		});

		it("does not append bypass_cache when bypassCache is not set", async () => {
			mockFetch({ success: true, result: mockTemplateDetail });

			await getSignatureTemplate("tpl-abc123");

			const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect(url).not.toContain("bypass_cache");
		});
	});
});
