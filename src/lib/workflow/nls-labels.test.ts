import { describe, it, expect } from "vitest";
import { getNlsSectionLabel, getNlsFieldLabel } from "./nls-labels";

describe("nls-labels", () => {
	describe("getNlsSectionLabel", () => {
		it("returns Spanish override for known section in es", () => {
			expect(getNlsSectionLabel("es", "mode", "Mode")).toBe("Modo");
			expect(getNlsSectionLabel("es", "leadIdentity", "Lead Identity")).toBe(
				"Identidad del Lead",
			);
		});

		it("returns English override for known section in en", () => {
			expect(getNlsSectionLabel("en", "mode", "Mode")).toBe("Mode");
			expect(getNlsSectionLabel("en", "leadIdentity", "Lead Identity")).toBe(
				"Lead Identity",
			);
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
});
