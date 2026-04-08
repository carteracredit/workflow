import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	render,
	screen,
	fireEvent,
	waitFor,
	within,
} from "@testing-library/react";
import { VariablesPanel } from "./variables-panel";
import type { WorkflowVariable } from "@/lib/workflow-api/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
	Toaster: () => null,
}));

const mockListVariables = vi.fn();
const mockCreateVariable = vi.fn();
const mockUpdateVariable = vi.fn();
const mockDeleteVariable = vi.fn();
const mockRotateSecret = vi.fn();
const mockSyncAllVariables = vi.fn();

vi.mock("@/lib/workflow-api/variables", () => ({
	listVariables: (...args: unknown[]) => mockListVariables(...args),
	createVariable: (...args: unknown[]) => mockCreateVariable(...args),
	updateVariable: (...args: unknown[]) => mockUpdateVariable(...args),
	deleteVariable: (...args: unknown[]) => mockDeleteVariable(...args),
	rotateSecret: (...args: unknown[]) => mockRotateSecret(...args),
	syncAllVariables: (...args: unknown[]) => mockSyncAllVariables(...args),
}));

vi.mock("@/lib/workflow-api/http", () => ({
	extractApiErrorMessage: (err: unknown) =>
		err instanceof Error ? err.message : String(err),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKFLOW_ID = "wf-00000001";

const mockVariable: WorkflowVariable = {
	id: "var-001",
	workflow_id: WORKFLOW_ID,
	name: "API_BASE_URL",
	value: "https://api.example.com",
	is_secret: false,
	environment: "all",
	description: "Base URL",
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

const mockSecret: WorkflowVariable = {
	id: "var-002",
	workflow_id: WORKFLOW_ID,
	name: "API_SECRET_KEY",
	value: null,
	is_secret: true,
	environment: "all",
	description: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
	workflowId: WORKFLOW_ID,
	jwt: "test-token",
	onClose: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VariablesPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockListVariables.mockResolvedValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -----------------------------------------------------------------------
	// Initial render
	// -----------------------------------------------------------------------

	it("renders the panel title", async () => {
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => {
			expect(
				screen.getByText("Variables y Secretos de Entorno"),
			).toBeInTheDocument();
		});
	});

	it("shows loading spinner while fetching", () => {
		mockListVariables.mockReturnValue(new Promise(() => {}));
		render(<VariablesPanel {...defaultProps} />);
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("shows empty state when no variables exist", async () => {
		mockListVariables.mockResolvedValue([]);
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => {
			expect(
				screen.getByText("No hay variables definidas"),
			).toBeInTheDocument();
		});
	});

	it("shows draft banner", async () => {
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => {
			expect(
				screen.getByText(
					"Los cambios en variables y secretos se aplicarán al publicar la próxima versión.",
				),
			).toBeInTheDocument();
		});
	});

	// -----------------------------------------------------------------------
	// Variable list
	// -----------------------------------------------------------------------

	it("renders list of variables after load", async () => {
		mockListVariables.mockResolvedValue([mockVariable, mockSecret]);
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("API_BASE_URL")).toBeInTheDocument();
			expect(screen.getByText("API_SECRET_KEY")).toBeInTheDocument();
		});
	});

	it("shows masked placeholder for secrets", async () => {
		mockListVariables.mockResolvedValue([mockSecret]);
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("••••••••")).toBeInTheDocument();
		});
	});

	it("shows variable value for non-secrets", async () => {
		mockListVariables.mockResolvedValue([mockVariable]);
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("https://api.example.com")).toBeInTheDocument();
		});
	});

	// -----------------------------------------------------------------------
	// Create variable
	// -----------------------------------------------------------------------

	it("shows create form when 'Agregar Variable' is clicked", async () => {
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() =>
			expect(
				screen.queryByText("No hay variables definidas"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Agregar Variable"));

		await waitFor(() => {
			expect(screen.getByPlaceholderText("API_BASE_URL")).toBeInTheDocument();
		});
	});

	it("shows create form with secret toggle when 'Agregar Secreto' is clicked", async () => {
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() =>
			expect(
				screen.queryByText("No hay variables definidas"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Agregar Secreto"));

		await waitFor(() => {
			expect(screen.getByText("Crear Secreto")).toBeInTheDocument();
		});
	});

	it("creates a new variable and adds it to the list", async () => {
		mockCreateVariable.mockResolvedValue(mockVariable);
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() =>
			expect(
				screen.queryByText("No hay variables definidas"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Agregar Variable"));
		await waitFor(() => screen.getByPlaceholderText("API_BASE_URL"));

		// Name
		fireEvent.change(screen.getByPlaceholderText("API_BASE_URL"), {
			target: { value: "API_BASE_URL" },
		});
		// Value (Spanish placeholder for non-secret)
		fireEvent.change(screen.getByPlaceholderText("https://api.ejemplo.com"), {
			target: { value: "https://api.example.com" },
		});

		fireEvent.click(screen.getByText("Guardar"));

		await waitFor(() => {
			expect(mockCreateVariable).toHaveBeenCalledWith(
				WORKFLOW_ID,
				expect.objectContaining({
					name: "API_BASE_URL",
					value: "https://api.example.com",
					is_secret: false,
				}),
				expect.objectContaining({ jwt: "test-token" }),
			);
		});
	});

	it("cancels form on Cancel click", async () => {
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() =>
			expect(
				screen.queryByText("No hay variables definidas"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Agregar Variable"));
		await waitFor(() => screen.getByPlaceholderText("API_BASE_URL"));

		// There are two "Cancelar" possible; get the one inside the form
		const cancelBtns = screen.getAllByText("Cancelar");
		fireEvent.click(cancelBtns[0]);

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText("API_BASE_URL"),
			).not.toBeInTheDocument();
		});
	});

	// -----------------------------------------------------------------------
	// Edit variable
	// -----------------------------------------------------------------------

	it("opens edit form with existing variable data (name is pre-filled and disabled)", async () => {
		mockListVariables.mockResolvedValue([mockVariable]);
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => screen.getByText("API_BASE_URL"));

		const row = screen.getByText("API_BASE_URL").closest("tr")!;
		const editBtn = within(row)
			.getAllByRole("button")
			.find((b) => b.getAttribute("title") === "Editar");
		expect(editBtn).toBeDefined();
		fireEvent.click(editBtn!);

		await waitFor(() => {
			const nameInput = screen.getByDisplayValue(
				"API_BASE_URL",
			) as HTMLInputElement;
			expect(nameInput.disabled).toBe(true);
		});
	});

	it("calls updateVariable when editing and saving", async () => {
		const updated = { ...mockVariable, value: "https://new.example.com" };
		mockListVariables.mockResolvedValue([mockVariable]);
		mockUpdateVariable.mockResolvedValue(updated);
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => screen.getByText("API_BASE_URL"));

		const row = screen.getByText("API_BASE_URL").closest("tr")!;
		const editBtn = within(row)
			.getAllByRole("button")
			.find((b) => b.getAttribute("title") === "Editar");
		fireEvent.click(editBtn!);

		await waitFor(() => screen.getByDisplayValue("API_BASE_URL"));

		const valueInput = screen.getByDisplayValue("https://api.example.com");
		fireEvent.change(valueInput, {
			target: { value: "https://new.example.com" },
		});

		fireEvent.click(screen.getByText("Guardar"));

		await waitFor(() => {
			expect(mockUpdateVariable).toHaveBeenCalledWith(
				WORKFLOW_ID,
				"var-001",
				expect.objectContaining({ value: "https://new.example.com" }),
				expect.objectContaining({ jwt: "test-token" }),
			);
		});
	});

	// -----------------------------------------------------------------------
	// Delete variable
	// -----------------------------------------------------------------------

	it("calls deleteVariable when delete is confirmed", async () => {
		mockListVariables.mockResolvedValue([mockVariable]);
		mockDeleteVariable.mockResolvedValue(undefined);
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		const row = screen.getByText("API_BASE_URL").closest("tr")!;
		const deleteBtn = within(row)
			.getAllByRole("button")
			.find((b) => b.getAttribute("title") === "Eliminar");
		expect(deleteBtn).toBeDefined();
		fireEvent.click(deleteBtn!);

		await waitFor(() => {
			expect(mockDeleteVariable).toHaveBeenCalledWith(
				WORKFLOW_ID,
				"var-001",
				expect.objectContaining({ jwt: "test-token" }),
			);
		});
		confirmSpy.mockRestore();
	});

	it("does NOT call deleteVariable when delete is cancelled", async () => {
		mockListVariables.mockResolvedValue([mockVariable]);
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		const row = screen.getByText("API_BASE_URL").closest("tr")!;
		const deleteBtn = within(row)
			.getAllByRole("button")
			.find((b) => b.getAttribute("title") === "Eliminar");
		fireEvent.click(deleteBtn!);

		expect(mockDeleteVariable).not.toHaveBeenCalled();
		confirmSpy.mockRestore();
	});

	// -----------------------------------------------------------------------
	// Rotate secret
	// -----------------------------------------------------------------------

	it("shows rotate form when rotate icon is clicked", async () => {
		mockListVariables.mockResolvedValue([mockSecret]);
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => screen.getByText("API_SECRET_KEY"));

		const row = screen.getByText("API_SECRET_KEY").closest("tr")!;
		const rotateBtn = within(row)
			.getAllByRole("button")
			.find(
				(b) => b.getAttribute("title") === "Rotar Secreto en Workers Activos",
			);
		expect(rotateBtn).toBeDefined();
		fireEvent.click(rotateBtn!);

		await waitFor(() => {
			// heading inside the rotate panel
			expect(
				screen.getByText("Rotar Secreto en Workers Activos"),
			).toBeInTheDocument();
		});
	});

	it("calls rotateSecret when confirmed with a new value", async () => {
		mockListVariables.mockResolvedValue([mockSecret]);
		mockRotateSecret.mockResolvedValue({
			secret: "API_SECRET_KEY",
			synced: ["worker-v1"],
			failed: [],
		});
		render(<VariablesPanel {...defaultProps} />);

		await waitFor(() => screen.getByText("API_SECRET_KEY"));

		const row = screen.getByText("API_SECRET_KEY").closest("tr")!;
		const rotateBtn = within(row)
			.getAllByRole("button")
			.find(
				(b) => b.getAttribute("title") === "Rotar Secreto en Workers Activos",
			);
		fireEvent.click(rotateBtn!);

		await waitFor(() => screen.getByText("Rotar Secreto en Workers Activos"));

		// find the password input inside the rotate panel
		const secretInput = screen
			.getByText("Nuevo Valor del Secreto")
			.closest("div")!
			.querySelector("input")!;
		fireEvent.change(secretInput, { target: { value: "new-secret-value" } });

		fireEvent.click(screen.getByText("Rotar Secreto"));

		await waitFor(() => {
			expect(mockRotateSecret).toHaveBeenCalledWith(
				WORKFLOW_ID,
				{ name: "API_SECRET_KEY", value: "new-secret-value" },
				expect.objectContaining({ jwt: "test-token" }),
			);
		});
	});

	// -----------------------------------------------------------------------
	// Close
	// -----------------------------------------------------------------------

	it("calls onClose when the close button is clicked", async () => {
		const onClose = vi.fn();
		render(<VariablesPanel {...defaultProps} onClose={onClose} />);
		await waitFor(() =>
			expect(
				screen.queryByText("No hay variables definidas"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Cerrar"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	// -----------------------------------------------------------------------
	// Error handling
	// -----------------------------------------------------------------------

	it("shows toast error when createVariable fails", async () => {
		const { toast } = await import("sonner");
		mockCreateVariable.mockRejectedValue(
			new Error("Conflict: name already exists"),
		);
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() =>
			expect(
				screen.queryByText("No hay variables definidas"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Agregar Variable"));
		await waitFor(() => screen.getByPlaceholderText("API_BASE_URL"));

		fireEvent.change(screen.getByPlaceholderText("API_BASE_URL"), {
			target: { value: "API_BASE_URL" },
		});
		fireEvent.click(screen.getByText("Guardar"));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
	});

	it("shows toast error when deleteVariable fails", async () => {
		const { toast } = await import("sonner");
		mockListVariables.mockResolvedValue([mockVariable]);
		mockDeleteVariable.mockRejectedValue(new Error("Server error"));
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		const row = screen.getByText("API_BASE_URL").closest("tr")!;
		const deleteBtn = within(row)
			.getAllByRole("button")
			.find((b) => b.getAttribute("title") === "Eliminar");
		fireEvent.click(deleteBtn!);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
		confirmSpy.mockRestore();
	});

	// -----------------------------------------------------------------------
	// Sync to Cloudflare
	// -----------------------------------------------------------------------

	it("renders the Sync to Cloudflare button", async () => {
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() =>
			expect(
				screen.getByText("Sincronizar con Cloudflare"),
			).toBeInTheDocument(),
		);
	});

	it("opens the sync panel when Sync button is clicked", async () => {
		mockListVariables.mockResolvedValue([mockVariable]);
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));

		await waitFor(() => {
			expect(
				screen.getByText("Sincronizar Variables con Cloudflare"),
			).toBeInTheDocument();
		});
	});

	it("shows secret value inputs for each secret when sync panel opens", async () => {
		mockListVariables.mockResolvedValue([mockVariable, mockSecret]);
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));

		// After opening the sync panel, API_SECRET_KEY appears both in the variables
		// table and as a label in the sync panel secret inputs section.
		await waitFor(() => {
			const allOccurrences = screen.getAllByText("API_SECRET_KEY");
			expect(allOccurrences.length).toBeGreaterThanOrEqual(2);
		});
	});

	it("closes the sync panel when Cancel is clicked", async () => {
		mockListVariables.mockResolvedValue([mockVariable]);
		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));
		await waitFor(() =>
			expect(
				screen.getByText("Sincronizar Variables con Cloudflare"),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Cancelar"));
		await waitFor(() =>
			expect(
				screen.queryByText("Sincronizar Variables con Cloudflare"),
			).not.toBeInTheDocument(),
		);
	});

	it("calls syncAllVariables and shows success toast on sync", async () => {
		const { toast } = await import("sonner");
		mockListVariables.mockResolvedValue([mockVariable]);
		mockSyncAllVariables.mockResolvedValue({
			synced: ["workflow-test-dev-v1"],
			failed: [],
			variableCount: 1,
		});

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));
		await waitFor(() => screen.getByText("Sincronizar Ahora"));
		fireEvent.click(screen.getByText("Sincronizar Ahora"));

		await waitFor(() => {
			expect(mockSyncAllVariables).toHaveBeenCalledWith(
				WORKFLOW_ID,
				{ secretValues: {} },
				{ jwt: "test-token" },
			);
			expect(toast.success).toHaveBeenCalled();
		});
	});

	it("shows info toast when no deployments found", async () => {
		const { toast } = await import("sonner");
		mockListVariables.mockResolvedValue([mockVariable]);
		mockSyncAllVariables.mockResolvedValue({
			synced: [],
			failed: [],
			variableCount: 0,
		});

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));
		await waitFor(() => screen.getByText("Sincronizar Ahora"));
		fireEvent.click(screen.getByText("Sincronizar Ahora"));

		await waitFor(() => {
			expect(toast.info).toHaveBeenCalled();
		});
	});

	it("shows error toast when sync fails", async () => {
		const { toast } = await import("sonner");
		mockListVariables.mockResolvedValue([mockVariable]);
		mockSyncAllVariables.mockRejectedValue(new Error("Cloudflare API error"));

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));
		await waitFor(() => screen.getByText("Sincronizar Ahora"));
		fireEvent.click(screen.getByText("Sincronizar Ahora"));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
	});

	it("shows error toast when sync has failed workers", async () => {
		const { toast } = await import("sonner");
		mockListVariables.mockResolvedValue([mockVariable]);
		mockSyncAllVariables.mockResolvedValue({
			synced: [],
			failed: ["workflow-test-dev-v1"],
			variableCount: 1,
		});

		render(<VariablesPanel {...defaultProps} />);
		await waitFor(() => screen.getByText("API_BASE_URL"));

		fireEvent.click(screen.getByText("Sincronizar con Cloudflare"));
		await waitFor(() => screen.getByText("Sincronizar Ahora"));
		fireEvent.click(screen.getByText("Sincronizar Ahora"));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
	});
});
