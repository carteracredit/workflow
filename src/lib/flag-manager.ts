import type { Flag, FlagOption } from "./workflow/types";

/**
 * Colores Tailwind disponibles (solo variante 500)
 */
export const TAILWIND_COLORS_500 = [
	"red-500",
	"orange-500",
	"amber-500",
	"yellow-500",
	"lime-500",
	"green-500",
	"emerald-500",
	"teal-500",
	"cyan-500",
	"sky-500",
	"blue-500",
	"indigo-500",
	"violet-500",
	"purple-500",
	"fuchsia-500",
	"pink-500",
	"rose-500",
	"slate-500",
	"gray-500",
	"zinc-500",
	"neutral-500",
	"stone-500",
] as const;

export type TailwindColor500 = (typeof TAILWIND_COLORS_500)[number];

/**
 * Genera un ID único para flags y opciones
 */
export function generateFlagId(): string {
	return `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateFlagOptionId(): string {
	return `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Valida que un flag tenga al menos una opción
 */
export function validateFlag(flag: Flag): { valid: boolean; error?: string } {
	if (!flag.name || flag.name.trim().length === 0) {
		return { valid: false, error: "El nombre del flag es requerido" };
	}

	if (!flag.options || flag.options.length === 0) {
		return { valid: false, error: "El flag debe tener al menos una opción" };
	}

	for (const option of flag.options) {
		if (!option.label || option.label.trim().length === 0) {
			return { valid: false, error: "Todas las opciones deben tener un label" };
		}
		if (
			!option.color ||
			!TAILWIND_COLORS_500.includes(option.color as TailwindColor500)
		) {
			return {
				valid: false,
				error: "Todas las opciones deben tener un color válido",
			};
		}
	}

	// Validar que no haya opciones duplicadas por label
	const labels = flag.options.map((o) => o.label.toLowerCase().trim());
	const uniqueLabels = new Set(labels);
	if (labels.length !== uniqueLabels.size) {
		return {
			valid: false,
			error: "No puede haber opciones con el mismo nombre",
		};
	}

	return { valid: true };
}

/**
 * Valida que no haya flags con nombres duplicados
 */
export function validateFlagsUnique(flags: Flag[]): {
	valid: boolean;
	error?: string;
} {
	const names = flags.map((f) => f.name.toLowerCase().trim());
	const uniqueNames = new Set(names);
	if (names.length !== uniqueNames.size) {
		return { valid: false, error: "No puede haber flags con el mismo nombre" };
	}
	return { valid: true };
}

/**
 * Mapeo de colores Tailwind 500 a valores RGB
 */
const TAILWIND_COLOR_MAP: Record<string, string> = {
	"red-500": "rgb(239, 68, 68)",
	"orange-500": "rgb(249, 115, 22)",
	"amber-500": "rgb(245, 158, 11)",
	"yellow-500": "rgb(234, 179, 8)",
	"lime-500": "rgb(132, 204, 22)",
	"green-500": "rgb(34, 197, 94)",
	"emerald-500": "rgb(16, 185, 129)",
	"teal-500": "rgb(20, 184, 166)",
	"cyan-500": "rgb(6, 182, 212)",
	"sky-500": "rgb(14, 165, 233)",
	"blue-500": "rgb(59, 130, 246)",
	"indigo-500": "rgb(99, 102, 241)",
	"violet-500": "rgb(139, 92, 246)",
	"purple-500": "rgb(168, 85, 247)",
	"fuchsia-500": "rgb(217, 70, 239)",
	"pink-500": "rgb(236, 72, 153)",
	"rose-500": "rgb(244, 63, 94)",
	"slate-500": "rgb(100, 116, 139)",
	"gray-500": "rgb(107, 114, 128)",
	"zinc-500": "rgb(113, 113, 122)",
	"neutral-500": "rgb(115, 115, 115)",
	"stone-500": "rgb(120, 113, 108)",
};

/**
 * Obtiene el valor RGB de un color Tailwind
 */
export function getColorValue(color: string): string {
	return TAILWIND_COLOR_MAP[color] || TAILWIND_COLOR_MAP["blue-500"];
}

/**
 * Obtiene un color aleatorio de la lista de colores disponibles
 */
export function getRandomColor(): TailwindColor500 {
	const randomIndex = Math.floor(Math.random() * TAILWIND_COLORS_500.length);
	return TAILWIND_COLORS_500[randomIndex];
}

/**
 * Crea un nuevo flag con valores por defecto
 */
export function createDefaultFlag(): Flag {
	return {
		id: generateFlagId(),
		name: "",
		options: [
			{
				id: generateFlagOptionId(),
				label: "Opción 1",
				color: getRandomColor(),
			},
		],
	};
}

/**
 * Crea una nueva opción de flag con valores por defecto
 */
export function createDefaultFlagOption(): FlagOption {
	return {
		id: generateFlagOptionId(),
		label: "",
		color: getRandomColor(),
	};
}
