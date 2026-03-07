import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	render,
	screen,
	waitFor,
	fireEvent,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowList } from "./WorkflowList";
import { ApiError } from "@/lib/workflow-api/http";
import type { Workflow } from "@/lib/workflow-api/types";

// ---------------------------------------------------------------------------
// Module mocks

vi.mock("@/components/SessionControls", () => ({
	SessionControls: () => null,
}));
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
}));

const mockUseWorkflows = vi.fn();
vi.mock("@/lib/workflow-api/hooks", () => ({
	useWorkflows: (...args: unknown[]) => mockUseWorkflows(...args),
}));

const mockCreateWorkflow = vi.fn();
const mockDeleteWorkflow = vi.fn();
const mockUpdateWorkflow = vi.fn();
const mockCloneWorkflow = vi.fn();
vi.mock("@/lib/workflow-api/workflows", () => ({
	createWorkflow: (...args: unknown[]) => mockCreateWorkflow(...args),
	deleteWorkflow: (...args: unknown[]) => mockDeleteWorkflow(...args),
	updateWorkflow: (...args: unknown[]) => mockUpdateWorkflow(...args),
	cloneWorkflow: (...args: unknown[]) => mockCloneWorkflow(...args),
}));

const mockUseApiToken = vi.fn();
vi.mock("@/hooks/useWorkflowApiToken", () => ({
	useWorkflowApiToken: () => mockUseApiToken(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
	Toaster: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

function makeHooksReturn(
	workflows: Workflow[],
	opts: { isLoading?: boolean; error?: Error } = {},
) {
	mockUseWorkflows.mockReturnValue({
		workflows,
		isLoading: opts.isLoading ?? false,
		error: opts.error,
		mutate: mockMutate,
	});
}

function withToken(token: string | null = "test-jwt") {
	mockUseApiToken.mockReturnValue({
		token,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	});
}

const TODAY = new Date().toISOString();

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
	return {
		id: "wf-uuid-default",
		name: "Aprobación de Crédito",
		slug: "aprobacion-de-credito",
		description: "Flujo principal de aprobación",
		class_name: "AprobacionDeCredito",
		current_major_version: 1,
		status: "published",
		definition: null,
		published_code_checksum: null,
		github_repo_url: null,
		created_at: TODAY,
		updated_at: TODAY,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	withToken();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// -------------------------------------------------------------------------
// Loading / Error / Empty states
// -------------------------------------------------------------------------

describe("WorkflowList – estados de carga y error", () => {
	it("muestra skeleton mientras carga", () => {
		makeHooksReturn([], { isLoading: true });
		render(<WorkflowList />);
		expect(
			screen.getByRole("status", { name: "Cargando workflows" }),
		).toBeInTheDocument();
		expect(
			document.querySelector('[data-slot="skeleton"]'),
		).toBeInTheDocument();
	});

	it("muestra mensaje de error y botón reintentar cuando falla la carga", () => {
		makeHooksReturn([], { error: new Error("network error") });
		render(<WorkflowList />);
		expect(
			screen.getByText("Error al cargar los workflows"),
		).toBeInTheDocument();
		expect(screen.getByText("Reintentar")).toBeInTheDocument();
	});

	it("botón Reintentar llama a mutate()", async () => {
		makeHooksReturn([], { error: new Error("network error") });
		render(<WorkflowList />);
		fireEvent.click(screen.getByText("Reintentar"));
		expect(mockMutate).toHaveBeenCalledTimes(1);
	});

	it("muestra estado vacío cuando no hay workflows", () => {
		makeHooksReturn([]);
		render(<WorkflowList />);
		expect(
			screen.getByText("No hay workflows todavía. ¡Crea el primero!"),
		).toBeInTheDocument();
	});

	it("estado vacío incluye botón de creación rápida", () => {
		makeHooksReturn([]);
		render(<WorkflowList />);
		// There are two "Nuevo Workflow" buttons: header and empty-state
		const buttons = screen.getAllByText("Nuevo Workflow");
		expect(buttons.length).toBeGreaterThanOrEqual(1);
	});
});

// -------------------------------------------------------------------------
// Rendering with data
// -------------------------------------------------------------------------

describe("WorkflowList – renderización con datos", () => {
	it("muestra el nombre de los workflows en la tabla", () => {
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-001", name: "Alpha", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", name: "Beta", status: "draft" }),
		]);
		render(<WorkflowList />);
		// Content appears in both mobile card list and desktop table
		expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Beta").length).toBeGreaterThanOrEqual(1);
	});

	it("muestra el badge de estado correcto", () => {
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-001", name: "Alpha", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", name: "Beta", status: "draft" }),
			makeWorkflow({ id: "wf-uuid-003", name: "Gamma", status: "archived" }),
		]);
		render(<WorkflowList />);
		expect(screen.getAllByText("Publicado").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Borrador").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Archivado").length).toBeGreaterThanOrEqual(1);
	});

	it("muestra la versión del workflow en la tabla", () => {
		makeHooksReturn([makeWorkflow({ current_major_version: 3 })]);
		render(<WorkflowList />);
		expect(screen.getByText("v3")).toBeInTheDocument();
	});

	it("muestra guión cuando la versión es 0", () => {
		makeHooksReturn([
			makeWorkflow({ current_major_version: 0, status: "draft" }),
		]);
		render(<WorkflowList />);
		expect(screen.getByText("—")).toBeInTheDocument();
	});

	it("muestra descripción del workflow", () => {
		makeHooksReturn([makeWorkflow({ description: "Mi descripción especial" })]);
		render(<WorkflowList />);
		expect(
			screen.getAllByText("Mi descripción especial").length,
		).toBeGreaterThanOrEqual(1);
	});

	it("muestra 'Sin descripción' cuando el workflow no tiene descripción", () => {
		makeHooksReturn([makeWorkflow({ description: "" })]);
		render(<WorkflowList />);
		expect(
			screen.getAllByText("Sin descripción").length,
		).toBeGreaterThanOrEqual(1);
	});
});

// -------------------------------------------------------------------------
// Stats cards
// -------------------------------------------------------------------------

describe("WorkflowList – chips de estadísticas", () => {
	it("muestra conteos correctos por estado en los chips", () => {
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-001", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", status: "published" }),
			makeWorkflow({ id: "wf-uuid-003", status: "draft" }),
			makeWorkflow({ id: "wf-uuid-004", status: "archived" }),
		]);
		render(<WorkflowList />);

		// Stat numbers are rendered with tabular-nums class inside chip buttons
		const statNumbers = Array.from(
			document.querySelectorAll(".tabular-nums"),
		).map((el) => el.textContent);

		// Total = 4, Published = 2, Draft = 1, Archived = 1
		expect(statNumbers).toContain("4");
		expect(statNumbers).toContain("2");
		expect(statNumbers).toContain("1");
	});

	it("muestra las etiquetas de los chips de estadísticas", () => {
		makeHooksReturn([]);
		render(<WorkflowList />);
		expect(screen.getByText("Total")).toBeInTheDocument();
		expect(screen.getByText("Publicados")).toBeInTheDocument();
		expect(screen.getByText("Borradores")).toBeInTheDocument();
		expect(screen.getByText("Archivados")).toBeInTheDocument();
	});

	it("los chips son clicables y actúan como filtro de estado", () => {
		const workflows: Workflow[] = [
			makeWorkflow({ id: "wf-uuid-001", name: "Pub", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", name: "Draft", status: "draft" }),
		];
		makeHooksReturn(workflows);
		render(<WorkflowList />);

		fireEvent.click(screen.getByRole("button", { name: /Borradores/ }));

		expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText("Pub")).not.toBeInTheDocument();
	});

	it("chip Total muestra todos los workflows", () => {
		const workflows: Workflow[] = [
			makeWorkflow({ id: "wf-uuid-001", name: "Pub", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", name: "Draft", status: "draft" }),
		];
		makeHooksReturn(workflows);
		render(<WorkflowList />);

		fireEvent.click(screen.getByRole("button", { name: /Borradores/ }));
		fireEvent.click(screen.getByRole("button", { name: /Total/ }));

		expect(screen.getAllByText("Pub").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
	});
});

// -------------------------------------------------------------------------
// Search filtering
// -------------------------------------------------------------------------

describe("WorkflowList – búsqueda y filtrado", () => {
	const WORKFLOWS: Workflow[] = [
		makeWorkflow({
			id: "wf-uuid-001",
			name: "Crédito Personal",
			description: "Para personas",
		}),
		makeWorkflow({
			id: "wf-uuid-002",
			name: "Hipoteca",
			description: "Inmuebles",
		}),
		makeWorkflow({
			id: "wf-uuid-003",
			name: "Garantía",
			description: "Proceso de crédito",
		}),
	];

	it("filtra workflows por nombre", async () => {
		makeHooksReturn(WORKFLOWS);
		render(<WorkflowList />);

		const input = screen.getByPlaceholderText(
			"Buscar por nombre o descripción...",
		);
		await userEvent.type(input, "hipoteca");

		expect(screen.getAllByText("Hipoteca").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText("Crédito Personal")).not.toBeInTheDocument();
	});

	it("filtra workflows por descripción", async () => {
		makeHooksReturn(WORKFLOWS);
		render(<WorkflowList />);

		const input = screen.getByPlaceholderText(
			"Buscar por nombre o descripción...",
		);
		await userEvent.type(input, "inmuebles");

		expect(screen.getAllByText("Hipoteca").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText("Crédito Personal")).not.toBeInTheDocument();
	});

	it("muestra mensaje de filtros vacíos cuando búsqueda no tiene resultados", async () => {
		makeHooksReturn(WORKFLOWS);
		render(<WorkflowList />);

		const input = screen.getByPlaceholderText(
			"Buscar por nombre o descripción...",
		);
		await userEvent.type(input, "zzz");

		expect(
			screen.getByText("No se encontraron workflows con esos filtros"),
		).toBeInTheDocument();
	});

	it("filtra por estado al hacer clic en chip de estado", async () => {
		const workflows: Workflow[] = [
			makeWorkflow({ id: "wf-uuid-001", name: "Pub", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", name: "Draft", status: "draft" }),
		];
		makeHooksReturn(workflows);
		render(<WorkflowList />);

		fireEvent.click(screen.getByRole("button", { name: /Borradores/ }));

		expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText("Pub")).not.toBeInTheDocument();
	});

	it("chip Total vuelve a mostrar todos los workflows", async () => {
		const workflows: Workflow[] = [
			makeWorkflow({ id: "wf-uuid-001", name: "Pub", status: "published" }),
			makeWorkflow({ id: "wf-uuid-002", name: "Draft", status: "draft" }),
		];
		makeHooksReturn(workflows);
		render(<WorkflowList />);

		fireEvent.click(screen.getByRole("button", { name: /Borradores/ }));
		fireEvent.click(screen.getByRole("button", { name: /Total/ }));

		expect(screen.getAllByText("Pub").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
	});

	it("muestra conteo de resultados", () => {
		makeHooksReturn([
			makeWorkflow({ id: "1", name: "A" }),
			makeWorkflow({ id: "2", name: "B" }),
		]);
		render(<WorkflowList />);
		expect(screen.getByText("2 resultados")).toBeInTheDocument();
	});

	it("muestra '1 resultado' cuando hay un solo workflow filtrado", async () => {
		makeHooksReturn(WORKFLOWS);
		render(<WorkflowList />);
		const input = screen.getByPlaceholderText(
			"Buscar por nombre o descripción...",
		);
		await userEvent.type(input, "hipoteca");
		expect(screen.getByText("1 resultado")).toBeInTheDocument();
	});

	it("renderiza los selects de ámbito y versión", () => {
		makeHooksReturn([
			makeWorkflow({ id: "1", name: "A", current_major_version: 1 }),
		]);
		render(<WorkflowList />);
		expect(
			screen.getByRole("combobox", { name: /Ámbito de búsqueda/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: /Filtrar por versión/i }),
		).toBeInTheDocument();
	});
});

// -------------------------------------------------------------------------
// Navigation
// -------------------------------------------------------------------------

describe("WorkflowList – navegación", () => {
	it("navega al editor cuando se hace clic en una fila", async () => {
		makeHooksReturn([makeWorkflow({ id: "wf-uuid-042", name: "Click Me" })]);
		render(<WorkflowList />);

		// Click first occurrence (appears in both mobile card and desktop table)
		fireEvent.click(screen.getAllByText("Click Me")[0]);

		expect(mockPush).toHaveBeenCalledWith("/editor/wf-uuid-042");
	});
});

// -------------------------------------------------------------------------
// Create Workflow Dialog
// -------------------------------------------------------------------------

describe("WorkflowList – diálogo de creación", () => {
	it("abre el diálogo al hacer clic en Nuevo Workflow", async () => {
		makeHooksReturn([]);
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);

		expect(
			await screen.findByText(
				"Crea un borrador nuevo. Podrás agregar nodos y publicarlo desde el editor.",
			),
		).toBeInTheDocument();
	});

	it("cierra el diálogo al hacer clic en Cancelar", async () => {
		makeHooksReturn([]);
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		await screen.findByText("Cancelar");
		fireEvent.click(screen.getByText("Cancelar"));

		await waitFor(() => {
			expect(
				screen.queryByText(
					"Crea un borrador nuevo. Podrás agregar nodos y publicarlo desde el editor.",
				),
			).not.toBeInTheDocument();
		});
	});

	it("crea el workflow y navega al editor", async () => {
		makeHooksReturn([]);
		mockCreateWorkflow.mockResolvedValue({
			id: "wf-uuid-099",
			name: "Nuevo WF",
		});
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const input = await screen.findByPlaceholderText(
			"Ej: Aprobación de Crédito",
		);
		await userEvent.type(input, "Nuevo WF");
		fireEvent.click(screen.getByText("Crear workflow"));

		await waitFor(() => {
			expect(mockCreateWorkflow).toHaveBeenCalledWith(
				expect.objectContaining({ name: "Nuevo WF", status: "draft" }),
				{ jwt: "test-jwt" },
			);
		});
		// definition must NOT be sent at creation time — the editor initialises
		// with a default Start node when definition is null, preventing it from
		// being overwritten by an empty nodes array from the API.
		const payload = mockCreateWorkflow.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(payload).not.toHaveProperty("definition");
		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/editor/wf-uuid-099");
		});
	});

	it("incluye la descripción cuando se proporciona", async () => {
		makeHooksReturn([]);
		mockCreateWorkflow.mockResolvedValue({
			id: "wf-uuid-010",
			name: "WF con desc",
		});
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const nameInput = await screen.findByPlaceholderText(
			"Ej: Aprobación de Crédito",
		);
		const descInput = screen.getByPlaceholderText(
			"Descripción opcional del workflow",
		);

		await userEvent.type(nameInput, "WF con desc");
		await userEvent.type(descInput, "Una descripción");
		fireEvent.click(screen.getByText("Crear workflow"));

		await waitFor(() => {
			expect(mockCreateWorkflow).toHaveBeenCalledWith(
				expect.objectContaining({ description: "Una descripción" }),
				{ jwt: "test-jwt" },
			);
		});
	});

	it("muestra error 'No autenticado' cuando no hay token", async () => {
		const { toast } = await import("sonner");
		withToken(null);
		makeHooksReturn([]);
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const input = await screen.findByPlaceholderText(
			"Ej: Aprobación de Crédito",
		);
		await userEvent.type(input, "Test");

		// Force-click the button even though token is null (button is enabled)
		const createBtn = screen.getByText("Crear workflow");
		fireEvent.click(createBtn);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("No autenticado");
		});
	});

	it("muestra error específico cuando el slug ya existe (409)", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([]);
		mockCreateWorkflow.mockRejectedValue(
			new ApiError("Conflict", { status: 409, body: null }),
		);
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const input = await screen.findByPlaceholderText(
			"Ej: Aprobación de Crédito",
		);
		await userEvent.type(input, "Existing");
		fireEvent.click(screen.getByText("Crear workflow"));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Ya existe un workflow con ese nombre",
			);
		});
	});

	it("muestra error genérico cuando falla la creación", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([]);
		mockCreateWorkflow.mockRejectedValue(new Error("Server error"));
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const input = await screen.findByPlaceholderText(
			"Ej: Aprobación de Crédito",
		);
		await userEvent.type(input, "Fail WF");
		fireEvent.click(screen.getByText("Crear workflow"));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Error al crear workflow",
				expect.any(Object),
			);
		});
	});

	it("crea workflow al presionar Enter en el campo de nombre", async () => {
		makeHooksReturn([]);
		mockCreateWorkflow.mockResolvedValue({ id: 55, name: "Enter WF" });
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const input = await screen.findByPlaceholderText(
			"Ej: Aprobación de Crédito",
		);
		await userEvent.type(input, "Enter WF{Enter}");

		await waitFor(() => {
			expect(mockCreateWorkflow).toHaveBeenCalled();
		});
	});

	it("muestra error cuando se intenta crear sin nombre", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([]);
		render(<WorkflowList />);

		fireEvent.click(screen.getAllByText("Nuevo Workflow")[0]);
		const descInput = await screen.findByPlaceholderText(
			"Descripción opcional del workflow",
		);
		descInput.focus();
		await userEvent.keyboard("{Enter}");

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("El nombre es requerido");
		});
		expect(mockCreateWorkflow).not.toHaveBeenCalled();
	});
});

// -------------------------------------------------------------------------
// Archive / Restore actions
// -------------------------------------------------------------------------

describe("WorkflowList – archivar y restaurar", () => {
	async function openDropdown(workflowName: string) {
		const user = userEvent.setup();
		const nameEl = screen.getAllByText(workflowName)[0];
		const row =
			nameEl.closest("tr") ?? nameEl.closest("div[class*='cursor-pointer']");
		if (!row) throw new Error(`Could not find row for ${workflowName}`);
		const trigger = within(row).getByRole("button");
		await user.click(trigger);
	}

	it("archiva un workflow publicado", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-001", name: "WF1", status: "published" }),
		]);
		mockUpdateWorkflow.mockResolvedValue({});
		render(<WorkflowList />);

		await openDropdown("WF1");
		const archiveBtn = await screen.findByText("Archivar");
		fireEvent.click(archiveBtn);

		await waitFor(() => {
			expect(mockUpdateWorkflow).toHaveBeenCalledWith(
				"wf-uuid-001",
				expect.objectContaining({ status: "archived", name: "WF1" }),
				{ jwt: "test-jwt" },
			);
		});
		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith('"WF1" archivado');
		});
		expect(mockMutate).toHaveBeenCalled();
	});

	it("restaura un workflow archivado a borrador", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-002", name: "WF2", status: "archived" }),
		]);
		mockUpdateWorkflow.mockResolvedValue({});
		render(<WorkflowList />);

		await openDropdown("WF2");
		const restoreBtn = await screen.findByText("Restaurar");
		fireEvent.click(restoreBtn);

		await waitFor(() => {
			expect(mockUpdateWorkflow).toHaveBeenCalledWith(
				"wf-uuid-002",
				expect.objectContaining({ status: "draft", name: "WF2" }),
				{ jwt: "test-jwt" },
			);
		});
		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith(
				'"WF2" restaurado como borrador',
			);
		});
	});

	it("muestra error toast cuando falla la actualización de estado", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-001", name: "WF1", status: "published" }),
		]);
		mockUpdateWorkflow.mockRejectedValue(new Error("error"));
		render(<WorkflowList />);

		await openDropdown("WF1");
		const archiveBtn = await screen.findByText("Archivar");
		fireEvent.click(archiveBtn);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Error al actualizar el estado del workflow",
				expect.any(Object),
			);
		});
	});
});

// -------------------------------------------------------------------------
// Delete action
// -------------------------------------------------------------------------

describe("WorkflowList – eliminar", () => {
	async function openDropdown(workflowName: string) {
		const user = userEvent.setup();
		const nameEl = screen.getAllByText(workflowName)[0];
		const row =
			nameEl.closest("tr") ?? nameEl.closest("div[class*='cursor-pointer']");
		if (!row) throw new Error(`Could not find row for ${workflowName}`);
		const trigger = within(row).getByRole("button");
		await user.click(trigger);
	}

	it("no elimina si el usuario cancela el confirm", async () => {
		vi.spyOn(window, "confirm").mockReturnValue(false);
		makeHooksReturn([
			makeWorkflow({
				id: "wf-uuid-001",
				name: "WFDel",
				status: "draft",
				current_major_version: 0,
			}),
		]);
		render(<WorkflowList />);

		await openDropdown("WFDel");
		const deleteBtn = await screen.findByText("Eliminar");
		fireEvent.click(deleteBtn);

		expect(mockDeleteWorkflow).not.toHaveBeenCalled();
	});

	it("elimina el workflow cuando el usuario confirma", async () => {
		const { toast } = await import("sonner");
		vi.spyOn(window, "confirm").mockReturnValue(true);
		makeHooksReturn([
			makeWorkflow({
				id: "wf-uuid-007",
				name: "WFDel2",
				status: "draft",
				current_major_version: 0,
			}),
		]);
		mockDeleteWorkflow.mockResolvedValue({});
		render(<WorkflowList />);

		await openDropdown("WFDel2");
		const deleteBtn = await screen.findByText("Eliminar");
		fireEvent.click(deleteBtn);

		await waitFor(() => {
			expect(mockDeleteWorkflow).toHaveBeenCalledWith("wf-uuid-007", {
				jwt: "test-jwt",
			});
		});
		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith('"WFDel2" eliminado');
		});
		expect(mockMutate).toHaveBeenCalled();
	});

	it("muestra error toast cuando falla la eliminación", async () => {
		const { toast } = await import("sonner");
		vi.spyOn(window, "confirm").mockReturnValue(true);
		makeHooksReturn([
			makeWorkflow({
				id: "wf-uuid-008",
				name: "WFDelErr",
				status: "draft",
				current_major_version: 0,
			}),
		]);
		mockDeleteWorkflow.mockRejectedValue(new Error("delete failed"));
		render(<WorkflowList />);

		await openDropdown("WFDelErr");
		const deleteBtn = await screen.findByText("Eliminar");
		fireEvent.click(deleteBtn);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Error al eliminar",
				expect.any(Object),
			);
		});
	});
});

// -------------------------------------------------------------------------
// Edit via dropdown
// -------------------------------------------------------------------------

describe("WorkflowList – editar desde dropdown", () => {
	it("navega al editor desde la opción Editar del dropdown", async () => {
		const user = userEvent.setup();
		makeHooksReturn([makeWorkflow({ id: "wf-uuid-033", name: "WFEdit" })]);
		render(<WorkflowList />);

		const nameEl = screen.getAllByText("WFEdit")[0];
		const row =
			nameEl.closest("tr") ?? nameEl.closest("div[class*='cursor-pointer']");
		if (!row) throw new Error("Could not find row for WFEdit");
		const trigger = within(row).getByRole("button");
		await user.click(trigger);

		const editBtn = await screen.findByText("Editar");
		fireEvent.click(editBtn);

		expect(mockPush).toHaveBeenCalledWith("/editor/wf-uuid-033");
	});
});

// -------------------------------------------------------------------------
// Clone via dropdown
// -------------------------------------------------------------------------

describe("WorkflowList – clonar", () => {
	async function openDropdown(workflowName: string) {
		const user = userEvent.setup();
		const nameEl = screen.getAllByText(workflowName)[0];
		const row =
			nameEl.closest("tr") ?? nameEl.closest("div[class*='cursor-pointer']");
		if (!row) throw new Error(`Could not find row for ${workflowName}`);
		const trigger = within(row).getByRole("button");
		await user.click(trigger);
	}

	it("el botón Clonar siempre está disponible en el dropdown", async () => {
		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-040", name: "WFClone", status: "published" }),
		]);
		render(<WorkflowList />);

		await openDropdown("WFClone");
		const cloneBtn = await screen.findByText("Clonar");
		expect(cloneBtn).toBeDefined();
	});

	it("llama a cloneWorkflow y redirige al editor del nuevo workflow", async () => {
		const { toast } = await import("sonner");
		const clonedWf = makeWorkflow({
			id: "cloned-uuid-001",
			name: "Copy of WFClone",
		});
		mockCloneWorkflow.mockResolvedValue(clonedWf);

		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-041", name: "WFClone2", status: "draft" }),
		]);
		render(<WorkflowList />);

		await openDropdown("WFClone2");
		const cloneBtn = await screen.findByText("Clonar");
		fireEvent.click(cloneBtn);

		await waitFor(() => {
			expect(mockCloneWorkflow).toHaveBeenCalledWith("wf-uuid-041", {
				jwt: "test-jwt",
			});
		});
		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith('Copia de "WFClone2" creada');
		});
		expect(mockPush).toHaveBeenCalledWith("/editor/cloned-uuid-001");
	});

	it("muestra error toast cuando falla el clon", async () => {
		const { toast } = await import("sonner");
		mockCloneWorkflow.mockRejectedValue(new Error("clone failed"));

		makeHooksReturn([
			makeWorkflow({ id: "wf-uuid-042", name: "WFCloneErr", status: "draft" }),
		]);
		render(<WorkflowList />);

		await openDropdown("WFCloneErr");
		const cloneBtn = await screen.findByText("Clonar");
		fireEvent.click(cloneBtn);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Error al clonar workflow",
				expect.any(Object),
			);
		});
	});
});
