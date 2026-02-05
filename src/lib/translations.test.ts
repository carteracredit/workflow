import { describe, it, expect, vi, afterEach } from "vitest";
import {
	translations,
	getLocaleForLanguage,
	detectBrowserLanguage,
} from "./translations";

describe("translations", () => {
	describe("translations object", () => {
		it("should have English translations", () => {
			expect(translations.en).toBeDefined();
			expect(translations.en.common.save).toBe("Save");
			expect(translations.en.common.cancel).toBe("Cancel");
		});

		it("should have Spanish translations", () => {
			expect(translations.es).toBeDefined();
			expect(translations.es.common.save).toBe("Guardar");
			expect(translations.es.common.cancel).toBe("Cancelar");
		});

		it("should have matching keys in both languages", () => {
			// Check some common keys exist in both
			const enKeys = Object.keys(translations.en.common);
			const esKeys = Object.keys(translations.es.common);
			expect(enKeys).toEqual(esKeys);
		});

		it("should have workflow-specific translations", () => {
			expect(translations.en.workflow).toBeDefined();
			expect(translations.en.workflow.title).toBe("Workflows");
			expect(translations.es.workflow.title).toBe("Flujos de Trabajo");
		});

		it("should have node type translations", () => {
			expect(translations.en.nodeTypes.start).toBe("Start");
			expect(translations.es.nodeTypes.start).toBe("Inicio");
		});
	});

	describe("getLocaleForLanguage", () => {
		it("should return es-ES for Spanish", () => {
			expect(getLocaleForLanguage("es")).toBe("es-ES");
		});

		it("should return en-US for English", () => {
			expect(getLocaleForLanguage("en")).toBe("en-US");
		});
	});

	describe("detectBrowserLanguage", () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("should return 'es' as default when navigator is undefined", () => {
			vi.stubGlobal("navigator", undefined);
			expect(detectBrowserLanguage()).toBe("es");
		});

		it("should return 'en' for English browser", () => {
			vi.stubGlobal("navigator", {
				language: "en-US",
			});
			expect(detectBrowserLanguage()).toBe("en");
		});

		it("should return 'es' for Spanish browser", () => {
			vi.stubGlobal("navigator", {
				language: "es-MX",
			});
			expect(detectBrowserLanguage()).toBe("es");
		});

		it("should return 'es' for unknown language", () => {
			vi.stubGlobal("navigator", {
				language: "fr-FR",
			});
			expect(detectBrowserLanguage()).toBe("es");
		});
	});
});
