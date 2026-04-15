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

		it("should have bilingual field placeholders for node properties", () => {
			expect(translations.en.propertiesPanel.nodeTitleEsPlaceholder).toBe(
				"Title in Spanish",
			);
			expect(translations.es.propertiesPanel.nodeTitleEsPlaceholder).toBe(
				"Título en español",
			);
			expect(translations.en.propertiesPanel.nodeDescEsPlaceholder).toBe(
				"Description in Spanish",
			);
			expect(translations.es.propertiesPanel.nodeDescEsPlaceholder).toBe(
				"Descripción en español",
			);
		});

		it("should have bilingual field placeholders for workflow metadata", () => {
			expect(translations.en.propertiesPanel.workflowNameEsPlaceholder).toBe(
				"Flow name in Spanish",
			);
			expect(translations.es.propertiesPanel.workflowNameEsPlaceholder).toBe(
				"Nombre del flujo en español",
			);
			expect(translations.en.propertiesPanel.workflowDescEsPlaceholder).toBe(
				"Description in Spanish",
			);
			expect(translations.es.propertiesPanel.workflowDescEsPlaceholder).toBe(
				"Descripción en español",
			);
		});

		it("should have bilingual field placeholders for edge labels", () => {
			expect(translations.en.propertiesPanel.edgeLabelEsPlaceholder).toBe(
				"Label in Spanish",
			);
			expect(translations.es.propertiesPanel.edgeLabelEsPlaceholder).toBe(
				"Etiqueta en español",
			);
		});

		it("should have language label keys in common section", () => {
			expect(translations.en.common.english).toBe("English");
			expect(translations.en.common.spanish).toBe("Spanish");
			expect(translations.es.common.english).toBe("Inglés");
			expect(translations.es.common.spanish).toBe("Español");
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
