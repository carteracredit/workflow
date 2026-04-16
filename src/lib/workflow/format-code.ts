/**
 * Formats generated TypeScript code using Prettier so the deployed file
 * matches the workflow-template's .prettierrc.json config and passes
 * `prettier --check` / `eslint` in CI without manual intervention.
 *
 * Uses Prettier's standalone browser-compatible build to avoid any
 * Node.js-only APIs.
 */

// These options mirror workflow-template/.prettierrc.json exactly.
const PRETTIER_OPTIONS = {
	parser: "typescript",
	useTabs: true,
	singleQuote: false,
	semi: true,
	trailingComma: "all" as const,
	printWidth: 80,
};

/**
 * Format a TypeScript source string with Prettier.
 * Returns the formatted code, or the original if formatting fails.
 */
export async function formatGeneratedCode(code: string): Promise<string> {
	try {
		const [prettier, { default: pluginTypeScript }, { default: pluginEstree }] =
			await Promise.all([
				import("prettier/standalone"),
				import("prettier/plugins/typescript"),
				import("prettier/plugins/estree"),
			]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return await prettier.format(code, {
			...PRETTIER_OPTIONS,
			plugins: [pluginEstree as any, pluginTypeScript as any],
		});
	} catch (err) {
		// If formatting fails (e.g. the code has syntax errors), return as-is
		// so the underlying validation step can surface the real problem.
		console.warn("[formatGeneratedCode] Prettier failed, using raw code:", err);
		return code;
	}
}
