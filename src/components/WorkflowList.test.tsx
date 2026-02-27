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
vi.mock("@/lib/workflow-api/workflows", () => ({
	createWorkflow: (...args: unknown[]) => mockCreateWorkflow(...args),
	deleteWorkflow: (...args: unknown[]) => mockDeleteWorkflow(...args),
	updateWorkflow: (...args: unknown[]) => mockUpdateWorkflow(...args),
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
		id: 1,
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
	it("muestra spinner mientras carga", () => {
		makeHooksReturn([], { isLoading: true });
		render(<WorkflowList />);
		// The spinning loader icon should be in the DOM (has animate-spin class)
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
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
			makeWorkflow({ id: 1, name: "Alpha", status: "published" }),
			makeWorkflow({ id: 2, name: "Beta", status: "draft" }),
		]);
		render(<WorkflowList />);
		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.getByText("Beta")).toBeInTheDocument();
	});

	it("muestra el badge de estado correcto", () => {
		makeHooksReturn([
			makeWorkflow({ id: 1, name: "Alpha", status: "published" }),
			makeWorkflow({ id: 2, name: "Beta", status: "draft" }),
			makeWorkflow({ id: 3, name: "Gamma", status: "archived" }),
		]);
		render(<WorkflowList />);
		expect(screen.getByText("Publicado")).toBeInTheDocument();
		expect(screen.getByText("Borrador")).toBeInTheDocument();
		expect(screen.getByText("Archivado")).toBeInTheDocument();
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
		expect(screen.getByText("Mi descripción especial")).toBeInTheDocument();
	});

	it("muestra 'Sin descripción' cuando el workflow no tiene descripción", () => {
		makeHooksReturn([makeWorkflow({ description: "" })]);
		render(<WorkflowList />);
		expect(screen.getByText("Sin descripción")).toBeInTheDocument();
	});
});

// -------------------------------------------------------------------------
// Stats cards
// -------------------------------------------------------------------------

describe("WorkflowList – tarjetas de estadísticas", () => {
	it("muestra conteos correctos por estado", () => {
		makeHooksReturn([
			makeWorkflow({ id: 1, status: "published" }),
			makeWorkflow({ id: 2, status: "published" }),
			makeWorkflow({ id: 3, status: "draft" }),
			makeWorkflow({ id: 4, status: "archived" }),
		]);
		render(<WorkflowList />);

		// Stats numbers are rendered with specific classes inside card-content slots
		const statNumbers = Array.from(
			document.querySelectorAll(".text-2xl.font-bold"),
		).map((el) => el.textContent);

		// Total = 4, Published = 2, Draft = 1, Archived = 1
		expect(statNumbers).toContain("4");
		expect(statNumbers).toContain("2");
		expect(statNumbers).toContain("1");
	});

	it("muestra los encabezados de tarjetas de estadísticas", () => {
		makeHooksReturn([]);
		render(<WorkflowList />);
		// "Total" only appears once; the others also appear in the status tabs but
		// we use getAllByText to avoid the "multiple elements" error
		expect(screen.getByText("Total")).toBeInTheDocument();
		expect(screen.getAllByText("Publicados").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Borradores").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Archivados").length).toBeGreaterThanOrEqual(1);
	});
});

// -------------------------------------------------------------------------
// Search filtering
// -------------------------------------------------------------------------

describe("WorkflowList – búsqueda y filtrado", () => {
	const WORKFLOWS: Workflow[] = [
		makeWorkflow({
			id: 1,
			name: "Crédito Personal",
			description: "Para personas",
		}),
		makeWorkflow({ id: 2, name: "Hipoteca", description: "Inmuebles" }),
		makeWorkflow({
			id: 3,
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

		expect(screen.getByText("Hipoteca")).toBeInTheDocument();
		expect(screen.queryByText("Crédito Personal")).not.toBeInTheDocument();
	});

	it("filtra workflows por descripción", async () => {
		makeHooksReturn(WORKFLOWS);
		render(<WorkflowList />);

		const input = screen.getByPlaceholderText(
			"Buscar por nombre o descripción...",
		);
		await userEvent.type(input, "inmuebles");

		expect(screen.getByText("Hipoteca")).toBeInTheDocument();
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

	it("filtra por estado al hacer clic en tab", async () => {
		const workflows: Workflow[] = [
			makeWorkflow({ id: 1, name: "Pub", status: "published" }),
			makeWorkflow({ id: 2, name: "Draft", status: "draft" }),
		];
		makeHooksReturn(workflows);
		render(<WorkflowList />);

		// The tab buttons are <button> elements; stat card labels are <div>s
		fireEvent.click(screen.getByRole("button", { name: "Borradores" }));

		expect(screen.getByText("Draft")).toBeInTheDocument();
		expect(screen.queryByText("Pub")).not.toBeInTheDocument();
	});

	it("muestra todos los workflows al seleccionar tab Todos", async () => {
		const workflows: Workflow[] = [
			makeWorkflow({ id: 1, name: "Pub", status: "published" }),
			makeWorkflow({ id: 2, name: "Draft", status: "draft" }),
		];
		makeHooksReturn(workflows);
		render(<WorkflowList />);

		fireEvent.click(screen.getByRole("button", { name: "Borradores" }));
		fireEvent.click(screen.getByRole("button", { name: "Todos" }));

		expect(screen.getByText("Pub")).toBeInTheDocument();
		expect(screen.getByText("Draft")).toBeInTheDocument();
	});
});

// -------------------------------------------------------------------------
// Navigation
// -------------------------------------------------------------------------

describe("WorkflowList – navegación", () => {
	it("navega al editor cuando se hace clic en una fila", async () => {
		makeHooksReturn([makeWorkflow({ id: 42, name: "Click Me" })]);
		render(<WorkflowList />);

		fireEvent.click(screen.getByText("Click Me"));

		expect(mockPush).toHaveBeenCalledWith("/editor/42");
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
		mockCreateWorkflow.mockResolvedValue({ id: 99, name: "Nuevo WF" });
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
		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/editor/99");
		});
	});

	it("incluye la descripción cuando se proporciona", async () => {
		makeHooksReturn([]);
		mockCreateWorkflow.mockResolvedValue({ id: 10, name: "WF con desc" });
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
});

// -------------------------------------------------------------------------
// Archive / Restore actions
// -------------------------------------------------------------------------

describe("WorkflowList – archivar y restaurar", () => {
	async function openDropdown(workflowName: string) {
		const user = userEvent.setup();
		const row = screen.getByText(workflowName).closest("tr")!;
		const trigger = within(row).getByRole("button");
		await user.click(trigger);
	}

	it("archiva un workflow publicado", async () => {
		const { toast } = await import("sonner");
		makeHooksReturn([
			makeWorkflow({ id: 1, name: "WF1", status: "published" }),
		]);
		mockUpdateWorkflow.mockResolvedValue({});
		render(<WorkflowList />);

		await openDropdown("WF1");
		const archiveBtn = await screen.findByText("Archivar");
		fireEvent.click(archiveBtn);

		await waitFor(() => {
			expect(mockUpdateWorkflow).toHaveBeenCalledWith(
				1,
				{ status: "archived" },
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
		makeHooksReturn([makeWorkflow({ id: 2, name: "WF2", status: "archived" })]);
		mockUpdateWorkflow.mockResolvedValue({});
		render(<WorkflowList />);

		await openDropdown("WF2");
		const restoreBtn = await screen.findByText("Restaurar");
		fireEvent.click(restoreBtn);

		await waitFor(() => {
			expect(mockUpdateWorkflow).toHaveBeenCalledWith(
				2,
				{ status: "draft" },
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
			makeWorkflow({ id: 1, name: "WF1", status: "published" }),
		]);
		mockUpdateWorkflow.mockRejectedValue(new Error("error"));
		render(<WorkflowList />);

		await openDropdown("WF1");
		const archiveBtn = await screen.findByText("Archivar");
		fireEvent.click(archiveBtn);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Error al actualizar el estado del workflow",
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
		const row = screen.getByText(workflowName).closest("tr")!;
		const trigger = within(row).getByRole("button");
		await user.click(trigger);
	}

	it("no elimina si el usuario cancela el confirm", async () => {
		vi.spyOn(window, "confirm").mockReturnValue(false);
		makeHooksReturn([makeWorkflow({ id: 1, name: "WFDel", status: "draft" })]);
		render(<WorkflowList />);

		await openDropdown("WFDel");
		const deleteBtn = await screen.findByText("Eliminar");
		fireEvent.click(deleteBtn);

		expect(mockDeleteWorkflow).not.toHaveBeenCalled();
	});

	it("elimina el workflow cuando el usuario confirma", async () => {
		const { toast } = await import("sonner");
		vi.spyOn(window, "confirm").mockReturnValue(true);
		makeHooksReturn([makeWorkflow({ id: 7, name: "WFDel2", status: "draft" })]);
		mockDeleteWorkflow.mockResolvedValue({});
		render(<WorkflowList />);

		await openDropdown("WFDel2");
		const deleteBtn = await screen.findByText("Eliminar");
		fireEvent.click(deleteBtn);

		await waitFor(() => {
			expect(mockDeleteWorkflow).toHaveBeenCalledWith(7, { jwt: "test-jwt" });
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
			makeWorkflow({ id: 8, name: "WFDelErr", status: "draft" }),
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
		makeHooksReturn([makeWorkflow({ id: 33, name: "WFEdit" })]);
		render(<WorkflowList />);

		const row = screen.getByText("WFEdit").closest("tr")!;
		const trigger = within(row).getByRole("button");
		await user.click(trigger);

		const editBtn = await screen.findByText("Editar");
		fireEvent.click(editBtn);

		expect(mockPush).toHaveBeenCalledWith("/editor/33");
	});
});
