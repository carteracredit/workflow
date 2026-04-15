import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PreviewModal } from "./preview-modal";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";

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
		useLanguage: () => ({
			language: "es",
			setLanguage: vi.fn(),
			t: tFn,
			getFieldLabel: (label: string, labelEs?: string) => labelEs || label,
			getFieldPlaceholder: (ph?: string, phEs?: string) => phEs || ph,
		}),
	};
});

const startNode: WorkflowNode = {
	id: "start-1",
	type: "Start",
	title: "Inicio",
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
	staleTimeout: null,
};

const endNode: WorkflowNode = {
	id: "end-1",
	type: "End",
	title: "Fin",
	description: "",
	roles: [],
	config: {},
	position: { x: 200, y: 0 },
	groupId: null,
	staleTimeout: null,
};

describe("PreviewModal", () => {
	it("renders title and simulation section", () => {
		render(<PreviewModal nodes={[startNode]} edges={[]} onClose={vi.fn()} />);
		expect(screen.getByText("Vista Previa del Flujo")).toBeInTheDocument();
		expect(screen.getByText("Simulación de Ejecución")).toBeInTheDocument();
	});

	it("shows error when no Start node", () => {
		render(<PreviewModal nodes={[endNode]} edges={[]} onClose={vi.fn()} />);
		expect(
			screen.getByText(/No se encontró nodo de inicio/i),
		).toBeInTheDocument();
	});

	it("shows start message and processing steps when flow is valid", () => {
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start-1", to: "end-1", label: null },
		];
		render(
			<PreviewModal
				nodes={[startNode, endNode]}
				edges={edges}
				onClose={vi.fn()}
			/>,
		);
		expect(
			screen.getAllByText(/Iniciando flujo desde: Inicio/i).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(
				(_, el) => el?.textContent?.includes("Procesando: Inicio") ?? false,
			).length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText(/Flujo terminado: FIN/i).length).toBeGreaterThan(
			0,
		);
	});

	it("shows warning when no next edge from Start", () => {
		render(<PreviewModal nodes={[startNode]} edges={[]} onClose={vi.fn()} />);
		expect(
			screen.getAllByText(/No hay siguiente nodo conectado/i).length,
		).toBeGreaterThan(0);
	});

	it("shows Reject message when flow ends at Reject", () => {
		const rejectNode: WorkflowNode = {
			...endNode,
			id: "reject-1",
			type: "Reject",
			title: "Rechazado",
		};
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start-1", to: "reject-1", label: null },
		];
		render(
			<PreviewModal
				nodes={[startNode, rejectNode]}
				edges={edges}
				onClose={vi.fn()}
			/>,
		);
		expect(screen.getByText(/Flujo terminado: RECHAZADO/i)).toBeInTheDocument();
	});

	it("calls onClose when Cerrar is clicked", async () => {
		const onClose = vi.fn();
		render(<PreviewModal nodes={[startNode]} edges={[]} onClose={onClose} />);
		const dialog = screen.getByRole("dialog");
		const cerrarBtn = within(dialog).getByRole("button", { name: "Cerrar" });
		fireEvent.click(cerrarBtn);
		expect(onClose).toHaveBeenCalled();
	});
});
