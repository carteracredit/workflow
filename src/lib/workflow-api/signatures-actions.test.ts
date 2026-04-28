import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth/getJwt", () => ({
	getJwt: vi.fn(),
}));

vi.mock("./signatures", () => ({
	listSignatureTemplates: vi.fn(),
	getSignatureTemplate: vi.fn(),
}));

import { getJwt } from "@/lib/auth/getJwt";
import { listSignatureTemplates, getSignatureTemplate } from "./signatures";
import {
	listSignatureTemplatesAction,
	getSignatureTemplateAction,
} from "./signatures-actions";

const mockTemplateSummary = {
	templateId: "tpl-abc123",
	title: "Contrato de crédito",
	signerRoles: [{ name: "Client", order: 0 }],
	updatedAt: 1745000000,
};

const mockTemplateDetail = {
	templateId: "tpl-abc123",
	title: "Contrato de crédito",
	signerRoles: [{ name: "Client", order: 0 }],
	ccRoles: [],
	customFields: [
		{
			name: "Monto",
			apiId: "monto",
			type: "text",
			required: true,
			label: null,
		},
	],
	updatedAt: 1745000000,
};

describe("signatures server actions", () => {
	beforeEach(() => {
		vi.mocked(getJwt).mockResolvedValue("mock-jwt-token");
		vi.mocked(listSignatureTemplates).mockResolvedValue([mockTemplateSummary]);
		vi.mocked(getSignatureTemplate).mockResolvedValue(mockTemplateDetail);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listSignatureTemplatesAction", () => {
		it("calls listSignatureTemplates with the JWT from getJwt", async () => {
			const result = await listSignatureTemplatesAction();

			expect(getJwt).toHaveBeenCalled();
			expect(listSignatureTemplates).toHaveBeenCalledWith({
				jwt: "mock-jwt-token",
			});
			expect(result).toEqual([mockTemplateSummary]);
		});

		it("passes undefined jwt when getJwt returns null", async () => {
			vi.mocked(getJwt).mockResolvedValue(null);

			await listSignatureTemplatesAction();

			expect(listSignatureTemplates).toHaveBeenCalledWith({
				jwt: undefined,
			});
		});

		it("propagates errors from listSignatureTemplates", async () => {
			vi.mocked(listSignatureTemplates).mockRejectedValue(
				new Error("cases-svc unavailable"),
			);

			await expect(listSignatureTemplatesAction()).rejects.toThrow(
				"cases-svc unavailable",
			);
		});

		it("passes bypassCache: true when provided", async () => {
			await listSignatureTemplatesAction({ bypassCache: true });

			expect(listSignatureTemplates).toHaveBeenCalledWith(
				expect.objectContaining({ bypassCache: true }),
			);
		});
	});

	describe("getSignatureTemplateAction", () => {
		it("calls getSignatureTemplate with the JWT from getJwt", async () => {
			const result = await getSignatureTemplateAction("tpl-abc123");

			expect(getJwt).toHaveBeenCalled();
			expect(getSignatureTemplate).toHaveBeenCalledWith("tpl-abc123", {
				jwt: "mock-jwt-token",
			});
			expect(result.templateId).toBe("tpl-abc123");
			expect(result.customFields).toHaveLength(1);
		});

		it("passes undefined jwt when getJwt returns null", async () => {
			vi.mocked(getJwt).mockResolvedValue(null);

			await getSignatureTemplateAction("tpl-abc123");

			expect(getSignatureTemplate).toHaveBeenCalledWith("tpl-abc123", {
				jwt: undefined,
			});
		});

		it("forwards the templateId argument correctly", async () => {
			await getSignatureTemplateAction("another-template-id");

			expect(getSignatureTemplate).toHaveBeenCalledWith(
				"another-template-id",
				expect.any(Object),
			);
		});

		it("propagates errors from getSignatureTemplate", async () => {
			vi.mocked(getSignatureTemplate).mockRejectedValue(
				new Error("Template not found"),
			);

			await expect(getSignatureTemplateAction("bad-id")).rejects.toThrow(
				"Template not found",
			);
		});

		it("passes bypassCache: true when provided", async () => {
			await getSignatureTemplateAction("tpl-abc123", { bypassCache: true });

			expect(getSignatureTemplate).toHaveBeenCalledWith(
				"tpl-abc123",
				expect.objectContaining({ bypassCache: true }),
			);
		});
	});
});
