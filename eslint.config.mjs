import nextPlugin from "@next/eslint-plugin-next";

/**
 * ESLint v9 flat config.
 *
 * Note: Next.js 16 deprecated `next lint`, so we lint via `eslint` directly.
 * We use the Next plugin's flat configs instead of FlatCompat to avoid
 * circular config validation issues.
 */
export default [
	// Next.js core rules (incl. core-web-vitals)
	nextPlugin.configs["core-web-vitals"],
	// Basic ignores
	{
		ignores: [
			".next/**",
			"node_modules/**",
			"out/**",
			"dist/**",
			"coverage/**",
			"storybook-static/**",
		],
	},
];
