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
			expect(getNlsSectionLabel("es", "mode", "Mode")).toBe("Modo");
			expect(
				getNlsSectionLabel(
					"es",
					"leadIdentity",
					"Lead Identity (from form node)",
				),
			).toBe("Identidad del Lead (desde nodo formulario)");
		});

		it("returns English override for known section in en", () => {
			expect(getNlsSectionLabel("en", "mode", "Mode")).toBe("Mode");
			expect(
				getNlsSectionLabel(
					"en",
					"leadIdentity",
					"Lead Identity (from form node)",
				),
			).toBe("Lead Identity (from form node)");
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
			expect(getNlsOptionLabel("es", "case_attached", "Case Attached")).toBe(
				"Caso Asociado",
			);
			expect(getNlsOptionLabel("es", "lead", "Lead")).toBe("Lead");
			expect(getNlsOptionLabel("es", "soft", "Soft")).toBe("Suave");
			expect(getNlsOptionLabel("es", "hard", "Hard")).toBe("Fuerte");
		});

		it("returns English override for known options in en", () => {
			expect(getNlsOptionLabel("en", "case_attached", "Case Attached")).toBe(
				"Case Attached",
			);
			expect(getNlsOptionLabel("en", "soft", "Soft")).toBe("Soft");
		});

		it("returns fallback label for unknown option", () => {
			expect(getNlsOptionLabel("es", "unknown_opt", "Unknown")).toBe("Unknown");
			expect(getNlsOptionLabel("en", "unknown_opt", "Unknown")).toBe("Unknown");
		});
	});

	describe("getNlsFunctionDescription", () => {
		it("returns Spanish description for precalification in es", () => {
			const desc = getNlsFunctionDescription(
				"es",
				"precalification",
				"Fallback",
			);
			expect(desc).toContain("pipeline completo de precalificación");
		});

		it("returns English description for precalification in en", () => {
			const desc = getNlsFunctionDescription(
				"en",
				"precalification",
				"Fallback",
			);
			expect(desc).toContain("prequalification pipeline");
		});

		it("returns fallback for unknown function", () => {
			expect(
				getNlsFunctionDescription("es", "unknownFunc", "Fallback Desc"),
			).toBe("Fallback Desc");
		});
	});
});
