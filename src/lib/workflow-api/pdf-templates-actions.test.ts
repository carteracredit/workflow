import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth/getJwt", () => ({
	getJwt: vi.fn(),
}));

vi.mock("./pdf-templates", () => ({
	listPdfTemplates: vi.fn(),
	getPdfTemplateFields: vi.fn(),
	listPdfTemplateVersions: vi.fn(),
}));

import { getJwt } from "@/lib/auth/getJwt";
import {
	listPdfTemplates,
	getPdfTemplateFields,
	listPdfTemplateVersions,
} from "./pdf-templates";
import type {
	PdfTemplateFieldsResult,
	PdfTemplateVersionSummary,
} from "./pdf-templates";
import {
	listPdfTemplatesAction,
	getPdfTemplateFieldsAction,
	listPdfTemplateVersionsAction,
} from "./pdf-templates-actions";

const mockTemplateSummary = {
	id: "tpl-1",
	name: "UCC Financing Statement",
	description: null,
	activeVersion: { id: "ver-1", version: 1, fileName: "ucc.pdf" },
};

const mockFieldsResult: PdfTemplateFieldsResult = {
	pdfTemplateId: "tpl-1",
	pdfTemplateVersionId: "ver-1",
	version: 1,
	fileName: "ucc.pdf",
	fields: [{ name: "debtor_name", type: "text" }],
};

const mockVersions: PdfTemplateVersionSummary[] = [
	{
		id: "ver-1",
		version: 1,
		fileName: "ucc.pdf",
		createdAt: "2026-01-01T00:00:00.000Z",
		isActive: true,
	},
];

describe("pdf-templates server actions", () => {
	beforeEach(() => {
		vi.mocked(getJwt).mockResolvedValue("mock-jwt-token");
		vi.mocked(listPdfTemplates).mockResolvedValue([mockTemplateSummary]);
		vi.mocked(getPdfTemplateFields).mockResolvedValue(mockFieldsResult);
		vi.mocked(listPdfTemplateVersions).mockResolvedValue(mockVersions);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listPdfTemplatesAction", () => {
		it("calls listPdfTemplates with the JWT from getJwt", async () => {
			const result = await listPdfTemplatesAction();

			expect(getJwt).toHaveBeenCalled();
			expect(listPdfTemplates).toHaveBeenCalledWith({
				jwt: "mock-jwt-token",
			});
			expect(result).toEqual([mockTemplateSummary]);
		});

		it("passes undefined jwt when getJwt returns null", async () => {
			vi.mocked(getJwt).mockResolvedValue(null);

			await listPdfTemplatesAction();

			expect(listPdfTemplates).toHaveBeenCalledWith({ jwt: undefined });
		});

		it("propagates errors from listPdfTemplates", async () => {
			vi.mocked(listPdfTemplates).mockRejectedValue(
				new Error("cases-svc unavailable"),
			);

			await expect(listPdfTemplatesAction()).rejects.toThrow(
				"cases-svc unavailable",
			);
		});

		it("passes bypassCache: true when provided", async () => {
			await listPdfTemplatesAction({ bypassCache: true });

			expect(listPdfTemplates).toHaveBeenCalledWith(
				expect.objectContaining({ bypassCache: true }),
			);
		});
	});

	describe("getPdfTemplateFieldsAction", () => {
		it("calls getPdfTemplateFields with the JWT from getJwt", async () => {
			const result = await getPdfTemplateFieldsAction("tpl-1");

			expect(getJwt).toHaveBeenCalled();
			expect(getPdfTemplateFields).toHaveBeenCalledWith("tpl-1", {
				jwt: "mock-jwt-token",
			});
			expect(result.pdfTemplateId).toBe("tpl-1");
			expect(result.fields).toHaveLength(1);
		});

		it("passes undefined jwt when getJwt returns null", async () => {
			vi.mocked(getJwt).mockResolvedValue(null);

			await getPdfTemplateFieldsAction("tpl-1");

			expect(getPdfTemplateFields).toHaveBeenCalledWith("tpl-1", {
				jwt: undefined,
			});
		});

		it("forwards the pdfTemplateId argument correctly", async () => {
			await getPdfTemplateFieldsAction("another-template-id");

			expect(getPdfTemplateFields).toHaveBeenCalledWith(
				"another-template-id",
				expect.any(Object),
			);
		});

		it("propagates errors from getPdfTemplateFields", async () => {
			vi.mocked(getPdfTemplateFields).mockRejectedValue(
				new Error("Template not found"),
			);

			await expect(getPdfTemplateFieldsAction("bad-id")).rejects.toThrow(
				"Template not found",
			);
		});

		it("passes bypassCache: true when provided", async () => {
			await getPdfTemplateFieldsAction("tpl-1", { bypassCache: true });

			expect(getPdfTemplateFields).toHaveBeenCalledWith(
				"tpl-1",
				expect.objectContaining({ bypassCache: true }),
			);
		});

		it("passes versionId when provided, to pin a specific version", async () => {
			await getPdfTemplateFieldsAction("tpl-1", { versionId: "ver-2" });

			expect(getPdfTemplateFields).toHaveBeenCalledWith(
				"tpl-1",
				expect.objectContaining({ versionId: "ver-2" }),
			);
		});
	});

	describe("listPdfTemplateVersionsAction", () => {
		it("calls listPdfTemplateVersions with the JWT from getJwt", async () => {
			const result = await listPdfTemplateVersionsAction("tpl-1");

			expect(getJwt).toHaveBeenCalled();
			expect(listPdfTemplateVersions).toHaveBeenCalledWith("tpl-1", {
				jwt: "mock-jwt-token",
				bypassCache: undefined,
			});
			expect(result).toEqual(mockVersions);
		});

		it("passes undefined jwt when getJwt returns null", async () => {
			vi.mocked(getJwt).mockResolvedValue(null);

			await listPdfTemplateVersionsAction("tpl-1");

			expect(listPdfTemplateVersions).toHaveBeenCalledWith("tpl-1", {
				jwt: undefined,
				bypassCache: undefined,
			});
		});

		it("propagates errors from listPdfTemplateVersions", async () => {
			vi.mocked(listPdfTemplateVersions).mockRejectedValue(
				new Error("Template not found"),
			);

			await expect(listPdfTemplateVersionsAction("bad-id")).rejects.toThrow(
				"Template not found",
			);
		});

		it("passes bypassCache: true when provided", async () => {
			await listPdfTemplateVersionsAction("tpl-1", { bypassCache: true });

			expect(listPdfTemplateVersions).toHaveBeenCalledWith(
				"tpl-1",
				expect.objectContaining({ bypassCache: true }),
			);
		});
	});
});
