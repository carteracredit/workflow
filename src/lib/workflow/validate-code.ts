/**
 * Utilities for validating user-supplied TypeScript code in workflow nodes
 * (Transform, Decision) before it gets embedded into the generated Cloudflare
 * Worker. Uses Prettier's standalone TypeScript parser – the same one used by
 * format-code.ts – so no extra dependencies are needed.
 *
 * On top of Prettier's syntax check we run a set of semantic rules that match
 * what ESBuild (used internally by Wrangler) rejects at build time even though
 * the TypeScript compiler/Prettier considers the code syntactically valid.
 */

export interface CodeValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validates TypeScript code written for a Transform node.
 *
 * The code is wrapped in the same async-function context it will occupy once
 * deployed:
 *
 *   await step.do("...", async () => {
 *     <USER CODE>
 *   });
 *
 * so that syntax errors like bare JSON objects (`{"key":"value"}`) are caught
 * at edit time instead of failing the Cloudflare wrangler build.
 */
export async function validateTransformCode(
	code: string,
): Promise<CodeValidationResult> {
	if (!code || code.trim().length === 0) {
		return {
			valid: false,
			error: "El código no puede estar vacío",
		};
	}

	// Run semantic checks first (fast, synchronous)
	const semantic = runSemanticChecks(code);
	if (!semantic.valid) return semantic;

	const wrapped = `async function __validate() {\n${code}\n}`;
	return parseTypeScript(wrapped);
}

/**
 * Validates a JavaScript/TypeScript expression used as a Decision condition.
 *
 * The expression is wrapped in an `if` statement so that the parser can check
 * it as a complete syntactic unit:
 *
 *   if (<CONDITION>) {}
 */
export async function validateConditionExpression(
	condition: string,
): Promise<CodeValidationResult> {
	if (!condition || condition.trim().length === 0) {
		return {
			valid: false,
			error: "La condición no puede estar vacía",
		};
	}

	const wrapped = `if (${condition}) {}`;
	return parseTypeScript(wrapped);
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic checks – patterns that Prettier accepts but ESBuild/Wrangler rejects
// ─────────────────────────────────────────────────────────────────────────────

interface SemanticRule {
	/** Regex applied to individual lines (trimmed) */
	pattern: RegExp;
	/** Human-readable error in Spanish */
	message: string;
}

/**
 * Rules that match patterns ESBuild rejects at build time.
 * Applied line by line so we can include the offending line number.
 */
const SEMANTIC_RULES: SemanticRule[] = [
	{
		// `const x;` or `const x: Type;`  — const without initializer
		// ESBuild error: "The constant 'X' must be initialized"
		// We match `const` declarations that end in `;` but do NOT contain `=`
		// which would indicate an assignment/initializer.
		pattern: /^const\s+(?:[^=]+);$/,
		message:
			"Las constantes deben tener un valor asignado (ej. `const x = 0;` en lugar de `const x;`)",
	},
];

/**
 * Runs synchronous semantic checks against the raw user code.
 * Returns on the first error found.
 */
function runSemanticChecks(code: string): CodeValidationResult {
	const lines = code.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();

		// Skip blank lines and comments
		if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) {
			continue;
		}

		for (const rule of SEMANTIC_RULES) {
			if (rule.pattern.test(trimmed)) {
				const lineNum = i + 1;
				return {
					valid: false,
					error: `Línea ${lineNum}: ${rule.message}`,
				};
			}
		}
	}

	return { valid: true };
}

/**
 * Internal helper: tries to format the given TypeScript snippet with Prettier.
 * Prettier throws a SyntaxError when the input is not valid TypeScript, which
 * is exactly the signal we need.
 */
async function parseTypeScript(source: string): Promise<CodeValidationResult> {
	try {
		const [prettier, { default: pluginTypeScript }, { default: pluginEstree }] =
			await Promise.all([
				import("prettier/standalone"),
				import("prettier/plugins/typescript"),
				import("prettier/plugins/estree"),
			]);

		await prettier.format(source, {
			parser: "typescript",
			useTabs: true,
			singleQuote: false,
			semi: true,
			trailingComma: "all",
			printWidth: 80,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			plugins: [pluginEstree as any, pluginTypeScript as any],
		});

		return { valid: true };
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Error de sintaxis desconocido";
		return {
			valid: false,
			error: sanitizeParserError(message),
		};
	}
}

/**
 * Strips internal Prettier/Babel noise from error messages and returns a
 * clean, user-friendly string in Spanish.
 */
function sanitizeParserError(raw: string): string {
	// Prettier wraps parse errors with "xxx (N:M)\n..." – extract the core part
	const match = raw.match(/^(.+?)\s*\(\d+:\d+\)/);
	const core = match ? match[1].trim() : raw.split("\n")[0].trim();

	// Common TypeScript/Babel parser messages → Spanish equivalents
	const known: Array<[RegExp, string]> = [
		[/unexpected token/i, "Token inesperado en el código"],
		[
			/expected\s+"?;?"?\s+but found/i,
			"Se esperaba ';' pero se encontró otro token",
		],
		[/unterminated string/i, "Cadena de texto sin cerrar"],
		[
			/unexpected end of input/i,
			"Fin de código inesperado (falta cerrar algo)",
		],
		[/missing semicolon/i, "Falta punto y coma"],
		[
			/identifier directly after number/i,
			"Identificador inválido después de un número",
		],
	];

	for (const [pattern, spanish] of known) {
		if (pattern.test(core)) {
			return spanish;
		}
	}

	return core || "Error de sintaxis en el código TypeScript";
}
