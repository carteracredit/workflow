import { describe, it, expect } from "vitest";
import {
	getNlsSectionLabel,
	getNlsFieldLabel,
	getNlsOptionLabel,
	getNlsFunctionDescription,
} from "./nls-labels";

describe("nls-labels", () => {
	describe("getNlsSectionLabel", () => {
		it("returns Spanish override for known section in es", () => {
			expect(getNlsSectionLabel("es", "actorType", "Actor Type")).toBe(
				"Tipo de Actor",
			);
			expect(
				getNlsSectionLabel(
					"es",
					"coapplicantIdentity",
					"Coapplicant Identity (from form node)",
				),
			).toBe("Identidad del Cosolicitante (desde nodo formulario)");
			expect(getNlsSectionLabel("es", "matchData", "Match Data")).toBe(
				"Datos de Búsqueda",
			);
		});

		it("returns English override for known section in en", () => {
			expect(getNlsSectionLabel("en", "actorType", "Actor Type")).toBe(
				"Actor Type",
			);
			expect(
				getNlsSectionLabel(
					"en",
					"coapplicantIdentity",
					"Coapplicant Identity (from form node)",
				),
			).toBe("Coapplicant Identity (from form node)");
		});

		it("returns fallback label for unknown section", () => {
			expect(getNlsSectionLabel("es", "unknown", "Unknown Section")).toBe(
				"Unknown Section",
			);
			expect(getNlsSectionLabel("en", "unknown", "Unknown Section")).toBe(
				"Unknown Section",
			);
		});
	});

	describe("getNlsFieldLabel", () => {
		it("returns Spanish override for known field in es", () => {
			expect(getNlsFieldLabel("es", "firstName", "First Name")).toBe("Nombre");
			expect(getNlsFieldLabel("es", "addressCity", "City")).toBe("Ciudad");
			expect(getNlsFieldLabel("es", "actorType", "Actor Type")).toBe(
				"Tipo de Actor",
			);
			expect(getNlsFieldLabel("es", "taxIdNumber", "Tax ID")).toBe("SSN/ITIN");
			expect(getNlsFieldLabel("es", "phone", "Phone")).toBe("Teléfono");
		});

		it("returns English override for known field in en", () => {
			expect(getNlsFieldLabel("en", "firstName", "First Name")).toBe(
				"First Name",
			);
			expect(getNlsFieldLabel("en", "addressCity", "City")).toBe("City");
		});

		it("returns fallback label for unknown field", () => {
			expect(getNlsFieldLabel("es", "unknownField", "Some Label")).toBe(
				"Some Label",
			);
			expect(getNlsFieldLabel("en", "unknownField", "Some Label")).toBe(
				"Some Label",
			);
		});
	});

	describe("getNlsOptionLabel", () => {
		it("returns Spanish override for known options in es", () => {
			expect(getNlsOptionLabel("es", "applicant", "Applicant")).toBe(
				"Solicitante",
			);
			expect(getNlsOptionLabel("es", "coapplicant", "Coapplicant")).toBe(
				"Cosolicitante",
			);
			expect(getNlsOptionLabel("es", "soft", "Soft")).toBe("Suave");
			expect(getNlsOptionLabel("es", "hard", "Hard")).toBe("Fuerte");
		});

		it("returns English override for known options in en", () => {
			expect(getNlsOptionLabel("en", "applicant", "Applicant")).toBe(
				"Applicant",
			);
			expect(getNlsOptionLabel("en", "soft", "Soft")).toBe("Soft");
		});

		it("returns fallback label for unknown option", () => {
			expect(getNlsOptionLabel("es", "unknown_opt", "Unknown")).toBe("Unknown");
			expect(getNlsOptionLabel("en", "unknown_opt", "Unknown")).toBe("Unknown");
		});
	});

	describe("getNlsFunctionDescription", () => {
		it("returns Spanish description for prequalification in es", () => {
			const desc = getNlsFunctionDescription(
				"es",
				"prequalification",
				"Fallback",
			);
			expect(desc).toContain("pipeline completo de precalificación");
		});

		it("returns English description for prequalification in en", () => {
			const desc = getNlsFunctionDescription(
				"en",
				"prequalification",
				"Fallback",
			);
			expect(desc).toContain("prequalification pipeline");
		});

		it("returns Spanish description for findPrequalificationMatches in es", () => {
			const desc = getNlsFunctionDescription(
				"es",
				"findPrequalificationMatches",
				"Fallback",
			);
			expect(desc).toContain("registros de precalificación");
		});

		it("returns fallback for unknown function", () => {
			expect(
				getNlsFunctionDescription("es", "unknownFunc", "Fallback Desc"),
			).toBe("Fallback Desc");
		});
	});
});
