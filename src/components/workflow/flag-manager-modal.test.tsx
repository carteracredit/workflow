import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FlagManagerModal } from "./flag-manager-modal";
import type { Flag } from "@/lib/workflow/types";

// Mock the flags API client
vi.mock("@/lib/workflow-api/flags", () => ({
	createFlag: vi.fn(),
	updateFlag: vi.fn(),
	deleteFlag: vi.fn(),
}));

import { createFlag, deleteFlag } from "@/lib/workflow-api/flags";

const MOCK_WORKFLOW_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_TOKEN = "mock-jwt-token";

const defaultProps = {
	workflowId: MOCK_WORKFLOW_ID,
	apiToken: MOCK_TOKEN,
};

describe("FlagManagerModal", () => {
	beforeEach(() => {
		vi.spyOn(window, "confirm").mockReturnValue(true);
		vi.mocked(createFlag).mockResolvedValue({
			id: "new-flag-id",
			workflow_id: MOCK_WORKFLOW_ID,
			name: "Prioridad",
			sort_order: 0,
			created_at: "2026-01-01",
			updated_at: "2026-01-01",
			options: [
				{ id: "opt-1", label: "Alta", color: "red-500", sort_order: 0 },
			],
			currentState: null,
		});
		vi.mocked(deleteFlag).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders title and Crear Flag when no flags", () => {
		render(
			<FlagManagerModal
				{...defaultProps}
				flags={[]}
				onClose={vi.fn()}
				onUpdateFlags={vi.fn()}
			/>,
		);
		expect(screen.getByText("Gestionar Flags")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Crear Flag/i }),
		).toBeInTheDocument();
		expect(screen.getByText("No hay flags definidos")).toBeInTheDocument();
	});

	it("renders list of flags when provided", () => {
		const flags: Flag[] = [
			{
				id: "f1",
				name: "Estado",
				options: [{ id: "o1", label: "Activo", color: "green-500" }],
			},
		];
		render(
			<FlagManagerModal
				{...defaultProps}
				flags={flags}
				onClose={vi.fn()}
				onUpdateFlags={vi.fn()}
			/>,
		);
		expect(screen.getByText("Estado")).toBeInTheDocument();
		expect(screen.getByText("1 opción")).toBeInTheDocument();
	});

	it("opens create form when Crear Flag is clicked", async () => {
		render(
			<FlagManagerModal
				{...defaultProps}
				flags={[]}
				onClose={vi.fn()}
				onUpdateFlags={vi.fn()}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		const crearBtn = within(dialog).getByRole("button", { name: "Crear Flag" });
		fireEvent.click(crearBtn);
		expect(screen.getByLabelText(/Nombre del Flag/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
	});

	it("shows validation error when saving flag with empty name", async () => {
		render(
			<FlagManagerModal
				{...defaultProps}
				flags={[]}
				onClose={vi.fn()}
				onUpdateFlags={vi.fn()}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "Crear Flag" }));
		fireEvent.click(screen.getByRole("button", { name: "Crear" }));
		expect(
			screen.getByText(/El nombre del flag es requerido/i),
		).toBeInTheDocument();
	});

	it("calls onClose when Cerrar is clicked", async () => {
		const onClose = vi.fn();
		render(
			<FlagManagerModal
				{...defaultProps}
				flags={[]}
				onClose={onClose}
				onUpdateFlags={vi.fn()}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		const cerrarBtn = within(dialog).getByRole("button", { name: "Cerrar" });
		fireEvent.click(cerrarBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it("cancel in edit form closes form without saving", async () => {
		render(
			<FlagManagerModal
				{...defaultProps}
				flags={[]}
				onClose={vi.fn()}
				onUpdateFlags={vi.fn()}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "Crear Flag" }));
		expect(
			screen.getByRole("button", { name: "Cancelar" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
		expect(screen.queryByLabelText(/Nombre del Flag/i)).not.toBeInTheDocument();
	});
});
