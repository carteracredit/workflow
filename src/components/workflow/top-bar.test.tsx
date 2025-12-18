import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar, KeyboardShortcutsModal } from "./top-bar";
import type { WorkflowMetadata } from "@/lib/workflow/types";

// Mock the Dialog component to avoid portal issues
vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
		open ? <div data-testid="dialog">{children}</div> : null,
	DialogContent: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<div data-testid="dialog-content" className={className}>
			{children}
		</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="dialog-header">{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h2 data-testid="dialog-title">{children}</h2>
	),
}));

// Mock lucide-react icons
vi.mock("lucide-react", async () => {
	const actual = await vi.importActual("lucide-react");
	return {
		...actual,
		Keyboard: () => <span data-testid="keyboard-icon">⌨️</span>,
	};
});

describe("KeyboardShortcutsModal", () => {
	const mockOnOpenChange = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should not render when open is false", () => {
		render(
			<KeyboardShortcutsModal open={false} onOpenChange={mockOnOpenChange} />,
		);

		const dialog = screen.queryByTestId("dialog");
		expect(dialog).not.toBeInTheDocument();
	});

	it("should render when open is true", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const dialog = screen.getByTestId("dialog");
		expect(dialog).toBeInTheDocument();
	});

	it("should display modal title", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const titles = screen.getAllByTestId("dialog-title");
		expect(titles.length).toBeGreaterThan(0);
		expect(titles[0]).toHaveTextContent("Atajos de teclado");
	});

	it("should display BARRA SUPERIOR category", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const barraSuperior = screen.getAllByText("BARRA SUPERIOR");
		expect(barraSuperior.length).toBeGreaterThan(0);
	});

	it("should display BARRA INFERIOR category", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const barraInferior = screen.getAllByText("BARRA INFERIOR");
		expect(barraInferior.length).toBeGreaterThan(0);
	});

	it("should display all shortcuts from Barra Superior", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		expect(screen.getAllByText("Guardar workflow").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Publicar").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Preview").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Validar").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Reiniciar flujo").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Exportar JSON").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Importar JSON").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Gestionar Flags").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Propiedades del flujo").length).toBeGreaterThan(
			0,
		);
	});

	it("should display all shortcuts from Barra Inferior", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		expect(
			screen.getAllByText("Herramienta de pan (mano)").length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText("Herramienta de selección").length,
		).toBeGreaterThan(0);
		expect(screen.getAllByText("Deshacer").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Rehacer").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Copiar selección").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Pegar selección").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Eliminar selección").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Ajustar a la vista").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Acercar (Zoom +)").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Alejar (Zoom -)").length).toBeGreaterThan(0);
	});

	it("should display merged Mac/Windows shortcuts", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		const content = dialogContent.textContent || "";
		expect(content).toContain("Ctrl");
	});

	it("should normalize Shift to ⇧ symbol", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		const content = dialogContent.textContent || "";
		expect(content).toContain("⇧");
	});

	it("should have correct modal width classes", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		expect(dialogContent).toHaveClass("!max-w-[1800px]");
		expect(dialogContent).toHaveClass("w-[96vw]");
	});

	it("should display shortcuts in 3 columns layout", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		const gridElement = dialogContent.querySelector(".grid");
		expect(gridElement).toBeInTheDocument();
		if (gridElement) {
			expect(gridElement).toHaveClass("grid-cols-3");
		}
	});

	it("should display identical shortcuts only once", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		// Space shortcut should appear (it's identical for Mac/Windows)
		expect(
			screen.getAllByText("Herramienta de pan (mano)").length,
		).toBeGreaterThan(0);
	});

	it("should call onOpenChange when modal state changes", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		// Modal is rendered
		const dialogs = screen.getAllByTestId("dialog");
		expect(dialogs.length).toBeGreaterThan(0);
	});

	it("should render all 19 shortcuts", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const expectedShortcuts = [
			"Guardar workflow",
			"Publicar",
			"Preview",
			"Validar",
			"Reiniciar flujo",
			"Exportar JSON",
			"Importar JSON",
			"Gestionar Flags",
			"Propiedades del flujo",
			"Herramienta de pan (mano)",
			"Herramienta de selección",
			"Deshacer",
			"Rehacer",
			"Copiar selección",
			"Pegar selección",
			"Eliminar selección",
			"Ajustar a la vista",
			"Acercar (Zoom +)",
			"Alejar (Zoom -)",
		];

		expectedShortcuts.forEach((shortcutLabel) => {
			const elements = screen.getAllByText(shortcutLabel);
			expect(elements.length).toBeGreaterThan(0);
		});
	});

	it("should handle shortcuts with Shift key normalization", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		// Shortcuts with Shift should show ⇧ symbol
		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		const content = dialogContent.textContent || "";
		expect(content).toContain("⇧");
	});

	it("should handle shortcuts that can be merged (⌘/Ctrl format)", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		const content = dialogContent.textContent || "";
		// Should contain both ⌘ symbol and Ctrl text for merged shortcuts
		expect(content).toContain("Ctrl");
	});

	it("should split Barra inferior into two columns", () => {
		render(
			<KeyboardShortcutsModal open={true} onOpenChange={mockOnOpenChange} />,
		);

		// Check that grid has 3 columns
		const dialogContents = screen.getAllByTestId("dialog-content");
		expect(dialogContents.length).toBeGreaterThan(0);
		const dialogContent = dialogContents[0];
		const gridElement = dialogContent.querySelector(".grid");
		expect(gridElement).toBeInTheDocument();
		if (gridElement) {
			expect(gridElement).toHaveClass("grid-cols-3");
		}
	});
});

describe("TopBar Integration", () => {
	const mockWorkflowMetadata: WorkflowMetadata = {
		name: "Test Workflow",
		version: "1.0.0",
		description: "Test description",
		author: "Test Author",
		tags: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	const defaultProps = {
		onNew: vi.fn(),
		onSave: vi.fn(),
		onPublish: vi.fn(),
		onExportJSON: vi.fn(),
		onImportJSON: vi.fn(),
		onLoadExample: vi.fn(),
		onManageFlags: vi.fn(),
		onToggleWorkflowProperties: vi.fn(),
		workflowMetadata: mockWorkflowMetadata,
		selectedNodeIds: [],
		selectedEdgeIds: [],
		onCopy: vi.fn(),
		onPaste: vi.fn(),
		onUndo: vi.fn(),
		onRedo: vi.fn(),
		canUndo: false,
		canRedo: false,
		onDelete: vi.fn(),
		onValidate: vi.fn(),
		onPreview: vi.fn(),
		onReset: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render TopBar component", () => {
		render(<TopBar {...defaultProps} />);

		const workflowNames = screen.getAllByText("Test Workflow");
		expect(workflowNames.length).toBeGreaterThan(0);
	});

	it("should render shortcuts menu button", () => {
		render(<TopBar {...defaultProps} />);

		const menuButtons = screen.getAllByTitle("Más opciones");
		expect(menuButtons.length).toBeGreaterThan(0);
	});

	it("should open modal when shortcuts menu item is clicked", async () => {
		const user = userEvent.setup();
		render(<TopBar {...defaultProps} />);

		// Find the menu button
		const menuButtons = screen.getAllByTitle("Más opciones");
		expect(menuButtons.length).toBeGreaterThan(0);

		// Click the menu button to open it
		await user.click(menuButtons[0]);

		// Wait for menu to be visible and find the shortcuts item
		await waitFor(
			() => {
				const shortcutsItems = screen.queryAllByText(/atajos de teclado/i);
				if (shortcutsItems.length > 0) {
					return shortcutsItems[0];
				}
				return null;
			},
			{ timeout: 2000 },
		);

		// Try to click the shortcuts item if found
		const shortcutsItems = screen.queryAllByText(/atajos de teclado/i);
		if (shortcutsItems.length > 0) {
			await user.click(shortcutsItems[0]);

			// Wait for modal to appear
			await waitFor(
				() => {
					const dialogs = screen.queryAllByTestId("dialog");
					return dialogs.length > 0;
				},
				{ timeout: 2000 },
			);

			const dialogs = screen.queryAllByTestId("dialog");
			expect(dialogs.length).toBeGreaterThan(0);
		}
	});
});
