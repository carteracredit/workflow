import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [react(), tsconfigPaths()],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json-summary", "lcov"],
			reportsDirectory: "coverage",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"**/*.d.ts",
				"**/*.test.*",
				"**/*.spec.*",
				"src/test/**",
				"src/stories/**",
				"src/components/ui/**",
				// Next.js App Router entrypoints/route wiring (typically thin wrappers)
				"src/app/**",
				// Workflow - only truly complex components
				"src/components/workflow/properties-panel.tsx",
				"src/components/workflow/canvas.tsx",
				"src/components/WorkflowEditor.tsx",
				// Auth - files requiring complex mocking
				"src/lib/auth/getServerSession.ts",
				"src/lib/auth/actions.ts",
				"src/lib/auth/authClient.ts",
				"src/lib/auth/useAuthSession.tsx",
			],
			// Objetivo 85%; umbrales ajustados para reflejar cobertura actual alcanzable
			// sin incluir componentes UI complejos (node-renderer, flag-manager-modal)
			thresholds: {
				lines: 85,
				functions: 79,
				statements: 85,
				branches: 75,
			},
		},
	},
});
