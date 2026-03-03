import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listFlags, createFlag, updateFlag, deleteFlag } from "./flags";
import type { WorkflowFlag } from "./types";

const BASE_URL = "https://workflow-svc.carteracredit.workers.dev";
const WORKFLOW_ID = "00000000-0000-0000-0000-000000000001";
const FLAG_ID = "00000000-0000-0000-0001-000000000001";

const mockFlag: WorkflowFlag = {
	id: FLAG_ID,
	workflow_id: WORKFLOW_ID,
	name: "Estado",
	sort_order: 0,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
	options: [
		{ id: "opt-1", label: "Aprobado", color: "green-500", sort_order: 0 },
		{ id: "opt-2", label: "Rechazado", color: "red-500", sort_order: 1 },
	],
	currentState: {
		optionId: "opt-1",
		updatedAt: "2026-01-01T00:00:00.000Z",
		updatedByInstanceId: null,
	},
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

describe("flags API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listFlags", () => {
		it("fetches flags from correct URL", async () => {
			mockFetch({ success: true, result: [mockFlag] });

			const result = await listFlags(WORKFLOW_ID, { jwt: "test-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/flags`,
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
				}),
			);
			expect(result).toEqual([mockFlag]);
		});
	});

	describe("createFlag", () => {
		it("POSTs a new flag to the correct URL", async () => {
			mockFetch({ success: true, result: mockFlag }, 201);

			const payload = {
				id: FLAG_ID,
				name: "Estado",
				options: [{ id: "opt-1", label: "Aprobado", color: "green-500" }],
			};
			const result = await createFlag(WORKFLOW_ID, payload, {
				jwt: "test-token",
			});

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/flags`,
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"content-type": "application/json",
					}),
					body: JSON.stringify(payload),
				}),
			);
			expect(result).toEqual(mockFlag);
		});
	});

	describe("updateFlag", () => {
		it("PUTs an updated flag to the correct URL", async () => {
			mockFetch({ success: true, result: mockFlag });

			const payload = {
				name: "Estado Actualizado",
				options: [{ id: "opt-1", label: "Aprobado", color: "blue-500" }],
			};
			const result = await updateFlag(WORKFLOW_ID, FLAG_ID, payload, {
				jwt: "test-token",
			});

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/flags/${FLAG_ID}`,
				expect.objectContaining({
					method: "PUT",
					body: JSON.stringify(payload),
				}),
			);
			expect(result).toEqual(mockFlag);
		});
	});

	describe("deleteFlag", () => {
		it("DELETEs a flag at the correct URL", async () => {
			mockFetch({ success: true, result: { deleted: true } });

			await deleteFlag(WORKFLOW_ID, FLAG_ID, { jwt: "test-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/flags/${FLAG_ID}`,
				expect.objectContaining({
					method: "DELETE",
				}),
			);
		});
	});
});
