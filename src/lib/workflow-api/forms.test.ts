import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listForms, getForm } from "./forms";

const BASE_URL = "https://workflow-svc.carteracredit.workers.dev";

const mockFormVersion = {
	id: "v1",
	version: 1,
	createdAt: "2026-01-01T00:00:00.000Z",
	createdBy: "admin",
	changelog: "Initial",
	fields: [{ id: "f1", type: "text", label: "Name", required: true }],
	schema: { input: {}, output: { name: "string" } },
};

const mockForm = {
	id: "form-uuid-001",
	name: "Customer Onboarding",
	description: "Collect customer info",
	status: "published" as const,
	currentVersion: 1,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	tags: ["onboarding"],
	versions: [mockFormVersion],
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

describe("forms API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listForms", () => {
		it("fetches forms from correct URL", async () => {
			mockFetch({ success: true, result: [mockForm] });

			const result = await listForms();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/forms`,
				expect.any(Object),
			);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("form-uuid-001");
		});

		it("passes search query as URL param", async () => {
			mockFetch({ success: true, result: [] });

			await listForms({ search: "onboarding" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/forms?search=onboarding`,
				expect.any(Object),
			);
		});

		it("passes status filter as URL param", async () => {
			mockFetch({ success: true, result: [] });

			await listForms({ status: "published" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/forms?status=published`,
				expect.any(Object),
			);
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({ success: true, result: [] });

			await listForms({ jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});

		it("uses custom NEXT_PUBLIC_WORKFLOW_SERVICE_URL when set", async () => {
			process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL = "https://custom.example";
			mockFetch({ success: true, result: [] });

			await listForms();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				"https://custom.example/forms",
				expect.any(Object),
			);
		});
	});

	describe("getForm", () => {
		it("fetches a form by ID", async () => {
			mockFetch({ success: true, result: mockForm });

			const result = await getForm("form-uuid-001");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/forms/form-uuid-001`,
				expect.any(Object),
			);
			expect(result.id).toBe("form-uuid-001");
			expect(result.name).toBe("Customer Onboarding");
		});

		it("passes JWT as Authorization header", async () => {
			mockFetch({ success: true, result: mockForm });

			await getForm("form-uuid-001", { jwt: "test-token" });

			const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-token",
			);
		});
	});
});
