import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowEditor } from "./WorkflowEditor";

// Mock heavy dependencies so the test can load WorkflowEditor
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/hooks/useWorkflowApiToken", () => ({
	useWorkflowApiToken: () => ({ token: null }),
}));
vi.mock("@/lib/workflow-api/workflows", () => ({
	getWorkflow: vi.fn(),
	createWorkflow: vi.fn(),
	updateWorkflow: vi.fn(),
}));
vi.mock("@/lib/workflow-api/flags", () => ({
	listFlags: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/SessionControls", () => ({
	SessionControls: () => null,
}));
vi.mock("@/components/LanguageProvider", async () => {
	const { translations } = await import("@/lib/translations");
	const tFn = (key: string) => {
		const parts = key.split(".");
		let val: unknown = translations.es;
		for (const part of parts) {
			if (val && typeof val === "object") {
				val = (val as Record<string, unknown>)[part];
			} else {
				return key;
			}
		}
		return typeof val === "string" ? val : key;
	};
	return {
		useLanguage: () => ({ language: "es", setLanguage: vi.fn(), t: tFn }),
		LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
	};
});

describe("WorkflowEditor responsive behavior", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows small screen overlay when window width is less than 768px", async () => {
		// Set window width to mobile size
		vi.stubGlobal("innerWidth", 375);
		window.dispatchEvent(new Event("resize"));

		render(<WorkflowEditor />);

		// The small screen overlay should be visible
		expect(
			await screen.findByText("Pantalla demasiado pequeña"),
		).toBeInTheDocument();

		vi.unstubAllGlobals();
	});
});
