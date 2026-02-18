import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FlagManagerModal } from "./flag-manager-modal";
import type { Flag } from "@/lib/workflow/types";

describe("FlagManagerModal", () => {
	beforeEach(() => {
		vi.spyOn(window, "confirm").mockReturnValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders title and Crear Flag when no flags", () => {
		render(
			<FlagManagerModal flags={[]} onClose={vi.fn()} onUpdateFlags={vi.fn()} />,
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
			<FlagManagerModal flags={[]} onClose={vi.fn()} onUpdateFlags={vi.fn()} />,
		);
		const dialog = screen.getByRole("dialog");
		const crearBtn = within(dialog).getByRole("button", { name: "Crear Flag" });
		fireEvent.click(crearBtn);
		expect(screen.getByLabelText(/Nombre del Flag/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
	});

	it("calls onUpdateFlags when creating a valid flag", async () => {
		const onUpdateFlags = vi.fn();
		render(
			<FlagManagerModal
				flags={[]}
				onClose={vi.fn()}
				onUpdateFlags={onUpdateFlags}
			/>,
		);
		const dialog = screen.getByRole("dialog");
		fireEvent.click(within(dialog).getByRole("button", { name: "Crear Flag" }));
		const nameInput = screen.getByLabelText(/Nombre del Flag/i);
		fireEvent.change(nameInput, { target: { value: "Prioridad" } });
		fireEvent.click(screen.getByRole("button", { name: "Crear" }));
		expect(onUpdateFlags).toHaveBeenCalledTimes(1);
		const [newFlags] = onUpdateFlags.mock.calls[0];
		expect(newFlags).toHaveLength(1);
		expect(newFlags[0].name).toBe("Prioridad");
		expect(newFlags[0].options.length).toBeGreaterThanOrEqual(1);
	});

	it("shows validation error when saving flag with empty name", async () => {
		render(
			<FlagManagerModal flags={[]} onClose={vi.fn()} onUpdateFlags={vi.fn()} />,
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
			<FlagManagerModal flags={[]} onClose={onClose} onUpdateFlags={vi.fn()} />,
		);
		const dialog = screen.getByRole("dialog");
		const cerrarBtn = within(dialog).getByRole("button", { name: "Cerrar" });
		fireEvent.click(cerrarBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it("cancel in edit form closes form without saving", async () => {
		render(
			<FlagManagerModal flags={[]} onClose={vi.fn()} onUpdateFlags={vi.fn()} />,
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
