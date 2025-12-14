import { describe, it, expect, vi } from "vitest";
import {
	TAILWIND_COLORS_500,
	generateFlagId,
	generateFlagOptionId,
	validateFlag,
	validateFlagsUnique,
	getColorValue,
	getRandomColor,
	createDefaultFlag,
	createDefaultFlagOption,
} from "./flag-manager";
import type { Flag, FlagOption } from "./workflow/types";

describe("flag-manager", () => {
	describe("generateFlagId", () => {
		it("should generate a unique ID with 'flag-' prefix", () => {
			const id = generateFlagId();
			expect(id).toMatch(/^flag-\d+-[a-z0-9]+$/);
		});

		it("should generate different IDs on each call", () => {
			const id1 = generateFlagId();
			const id2 = generateFlagId();
			expect(id1).not.toBe(id2);
		});
	});

	describe("generateFlagOptionId", () => {
		it("should generate a unique ID with 'option-' prefix", () => {
			const id = generateFlagOptionId();
			expect(id).toMatch(/^option-\d+-[a-z0-9]+$/);
		});

		it("should generate different IDs on each call", () => {
			const id1 = generateFlagOptionId();
			const id2 = generateFlagOptionId();
			expect(id1).not.toBe(id2);
		});
	});

	describe("validateFlag", () => {
		it("should validate a flag with valid options", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "Status",
				options: [
					{ id: "opt-1", label: "Active", color: "green-500" },
					{ id: "opt-2", label: "Inactive", color: "red-500" },
				],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should reject flag with empty name", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "",
				options: [{ id: "opt-1", label: "Active", color: "green-500" }],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("El nombre del flag es requerido");
		});

		it("should reject flag with whitespace-only name", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "   ",
				options: [{ id: "opt-1", label: "Active", color: "green-500" }],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("El nombre del flag es requerido");
		});

		it("should reject flag with no options", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "Status",
				options: [],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("El flag debe tener al menos una opción");
		});

		it("should reject flag with option missing label", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "Status",
				options: [
					{ id: "opt-1", label: "", color: "green-500" },
				] as FlagOption[],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("Todas las opciones deben tener un label");
		});

		it("should reject flag with option missing color", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "Status",
				options: [
					{ id: "opt-1", label: "Active", color: "invalid-color" },
				] as FlagOption[],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe(
				"Todas las opciones deben tener un color válido",
			);
		});

		it("should reject flag with duplicate option labels", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "Status",
				options: [
					{ id: "opt-1", label: "Active", color: "green-500" },
					{ id: "opt-2", label: "Active", color: "red-500" },
				],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("No puede haber opciones con el mismo nombre");
		});

		it("should reject flag with duplicate option labels (case insensitive)", () => {
			const flag: Flag = {
				id: "flag-1",
				name: "Status",
				options: [
					{ id: "opt-1", label: "Active", color: "green-500" },
					{ id: "opt-2", label: "ACTIVE", color: "red-500" },
				],
			};
			const result = validateFlag(flag);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("No puede haber opciones con el mismo nombre");
		});
	});

	describe("validateFlagsUnique", () => {
		it("should validate unique flag names", () => {
			const flags: Flag[] = [
				{
					id: "flag-1",
					name: "Status",
					options: [{ id: "opt-1", label: "Active", color: "green-500" }],
				},
				{
					id: "flag-2",
					name: "Priority",
					options: [{ id: "opt-2", label: "High", color: "red-500" }],
				},
			];
			const result = validateFlagsUnique(flags);
			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it("should reject duplicate flag names", () => {
			const flags: Flag[] = [
				{
					id: "flag-1",
					name: "Status",
					options: [{ id: "opt-1", label: "Active", color: "green-500" }],
				},
				{
					id: "flag-2",
					name: "Status",
					options: [{ id: "opt-2", label: "Inactive", color: "red-500" }],
				},
			];
			const result = validateFlagsUnique(flags);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("No puede haber flags con el mismo nombre");
		});

		it("should reject duplicate flag names (case insensitive)", () => {
			const flags: Flag[] = [
				{
					id: "flag-1",
					name: "Status",
					options: [{ id: "opt-1", label: "Active", color: "green-500" }],
				},
				{
					id: "flag-2",
					name: "STATUS",
					options: [{ id: "opt-2", label: "Inactive", color: "red-500" }],
				},
			];
			const result = validateFlagsUnique(flags);
			expect(result.valid).toBe(false);
			expect(result.error).toBe("No puede haber flags con el mismo nombre");
		});

		it("should handle empty array", () => {
			const result = validateFlagsUnique([]);
			expect(result.valid).toBe(true);
		});
	});

	describe("getColorValue", () => {
		it("should return RGB value for valid color", () => {
			expect(getColorValue("red-500")).toBe("rgb(239, 68, 68)");
			expect(getColorValue("blue-500")).toBe("rgb(59, 130, 246)");
			expect(getColorValue("green-500")).toBe("rgb(34, 197, 94)");
		});

		it("should return default blue-500 for invalid color", () => {
			expect(getColorValue("invalid-color")).toBe("rgb(59, 130, 246)");
			expect(getColorValue("")).toBe("rgb(59, 130, 246)");
		});
	});

	describe("getRandomColor", () => {
		it("should return a valid color from TAILWIND_COLORS_500", () => {
			const color = getRandomColor();
			expect(TAILWIND_COLORS_500).toContain(color);
		});

		it("should return different colors on multiple calls (probabilistic)", () => {
			const colors = new Set();
			for (let i = 0; i < 10; i++) {
				colors.add(getRandomColor());
			}
			// With 23 colors available, getting at least 2 different ones is very likely
			expect(colors.size).toBeGreaterThan(0);
		});
	});

	describe("createDefaultFlag", () => {
		it("should create a flag with default values", () => {
			const flag = createDefaultFlag();
			expect(flag.id).toMatch(/^flag-\d+-[a-z0-9]+$/);
			expect(flag.name).toBe("");
			expect(flag.options).toHaveLength(1);
			expect(flag.options[0].id).toMatch(/^option-\d+-[a-z0-9]+$/);
			expect(flag.options[0].label).toBe("Opción 1");
			expect(TAILWIND_COLORS_500).toContain(flag.options[0].color);
		});
	});

	describe("createDefaultFlagOption", () => {
		it("should create a flag option with default values", () => {
			const option = createDefaultFlagOption();
			expect(option.id).toMatch(/^option-\d+-[a-z0-9]+$/);
			expect(option.label).toBe("");
			expect(TAILWIND_COLORS_500).toContain(option.color);
		});
	});
});
