"use client";

import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarSub,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarTrigger,
} from "@/components/ui/menubar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { SessionControls } from "@/components/SessionControls";
import {
	Save,
	Upload,
	Download,
	HelpCircle,
	FolderOpen,
	Rocket,
	RefreshCw,
	Trash2,
	Flag,
	Settings,
	MoreVertical,
	Bell,
	Pencil,
	Keyboard,
	ArrowLeft,
	Loader2,
} from "lucide-react";
import type { WorkflowMetadata, WorkflowNode } from "@/lib/workflow/types";
import { Palette } from "@/components/workflow/palette";

type ShortcutDefinition = {
	label: string;
	mac: string[];
	win: string[];
	altWin?: string[];
	description?: string;
	category?: string;
};

const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
	// Barra superior - Acciones principales
	{
		label: "Guardar workflow",
		mac: ["⌘", "S"],
		win: ["Ctrl", "S"],
		category: "Barra superior",
	},
	{
		label: "Reiniciar flujo",
		mac: ["⌘", "⇧", "R"],
		win: ["Ctrl", "⇧", "R"],
		category: "Barra superior",
	},
	{
		label: "Validar",
		mac: ["⌘", "⇧", "V"],
		win: ["Ctrl", "⇧", "V"],
		category: "Barra superior",
	},
	{
		label: "Preview",
		mac: ["⌘", "P"],
		win: ["Ctrl", "P"],
		category: "Barra superior",
	},
	// Barra inferior - Herramientas de canvas
	{
		label: "Herramienta de pan (mano)",
		mac: ["Space"],
		win: ["Space"],
		category: "Barra inferior",
	},
	{
		label: "Herramienta de selección",
		mac: ["V"],
		win: ["V"],
		category: "Barra inferior",
	},
	{
		label: "Deshacer",
		mac: ["⌘", "Z"],
		win: ["Ctrl", "Z"],
		category: "Barra inferior",
	},
	{
		label: "Rehacer",
		mac: ["⌘", "Y"],
		win: ["Ctrl", "Y"],
		category: "Barra inferior",
	},
	{
		label: "Copiar selección",
		mac: ["⌘", "C"],
		win: ["Ctrl", "C"],
		category: "Barra inferior",
	},
	{
		label: "Pegar selección",
		mac: ["⌘", "V"],
		win: ["Ctrl", "V"],
		category: "Barra inferior",
	},
	{
		label: "Acercar (Zoom +)",
		mac: ["2"],
		win: ["2"],
		category: "Barra inferior",
	},
	{
		label: "Alejar (Zoom -)",
		mac: ["1"],
		win: ["1"],
		category: "Barra inferior",
	},
	{
		label: "Ajustar a la vista",
		mac: ["F"],
		win: ["F"],
		category: "Barra inferior",
	},
	// Herramientas - Acciones adicionales
	{
		label: "Publicar",
		mac: ["⌘", "⇧", "P"],
		win: ["Ctrl", "⇧", "P"],
		category: "Herramientas",
	},
	{
		label: "Exportar JSON",
		mac: ["⌘", "E"],
		win: ["Ctrl", "E"],
		category: "Herramientas",
	},
	{
		label: "Importar JSON",
		mac: ["⌘", "I"],
		win: ["Ctrl", "I"],
		category: "Herramientas",
	},
	{
		label: "Gestionar Flags",
		mac: ["⌘", "⇧", "F"],
		win: ["Ctrl", "⇧", "F"],
		category: "Herramientas",
	},
	{
		label: "Propiedades del flujo",
		mac: ["⌘", ","],
		win: ["Ctrl", ","],
		category: "Herramientas",
	},
];

interface TopBarProps {
	onNew: () => void;
	onSave: () => void | Promise<void>;
	onPublish: () => void;
	onExportJSON: () => void;
	onImportJSON: () => void;
	onLoadExample: (key: "basic" | "api" | "manual") => void;
	onManageFlags: () => void;
	onToggleWorkflowProperties: () => void;
	workflowMetadata: WorkflowMetadata;
	/** If provided, show a back-to-list button */
	onBack?: () => void;
	/** Current workflow lifecycle status (draft / published / archived) */
	workflowStatus?: "draft" | "published" | "archived";
	/** Authoritative major version from the API — overrides metadata.version display */
	currentMajorVersion?: number;
	paletteProps?: {
		onAddNode: (node: WorkflowNode) => void;
		zoom: number;
		pan: { x: number; y: number };
	};
	/** Whether a save operation is in progress */
	isSaving?: boolean;
}

export function TopBar({
	onNew,
	onSave,
	onPublish,
	onExportJSON,
	onImportJSON,
	onLoadExample,
	onManageFlags,
	onToggleWorkflowProperties,
	workflowMetadata,
	onBack,
	workflowStatus,
	currentMajorVersion,
	paletteProps,
	isSaving,
}: TopBarProps) {
	const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

	const displayVersion = (() => {
		// Show version badge only when the workflow has been published at least once
		if (currentMajorVersion !== undefined && currentMajorVersion >= 1) {
			return `v${currentMajorVersion}`;
		}
		return null;
	})();

	return (
		<div className="relative z-50 border-b border-border bg-card/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/70">
			<div className="flex items-center gap-3 min-w-0">
				{onBack && (
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 flex-shrink-0"
						onClick={onBack}
						title="Volver a la lista"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
				)}
				<div className="min-w-0 flex-shrink-0">
					<div className="flex flex-wrap items-center gap-2">
						<img
							src="/app-icon.svg"
							alt="workflow"
							className="h-6"
							style={{ width: "auto" }}
						/>
						<div className="flex items-center gap-1.5">
							<h1 className="truncate text-base font-semibold text-foreground">
								{workflowMetadata.name || "Your Workflow"}
							</h1>
							<Button
								variant="ghost"
								size="icon"
								className="h-5 w-5"
								onClick={onToggleWorkflowProperties}
								title="Editar nombre del workflow"
							>
								<Pencil className="h-3 w-3" />
							</Button>
						</div>
						{displayVersion && (
							<span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-foreground/70">
								{displayVersion}
							</span>
						)}
					</div>
				</div>

				{paletteProps && (
					<div className="relative flex min-w-0 flex-1 items-center">
						{/* Left fade edge */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-card/80 to-transparent"
						/>
						{/*
						 * Two-element centering pattern that avoids the
						 * "justify-center + overflow-x: auto" left-scroll bug:
						 *
						 *  outer  — flex-1, justify-center → centers the inner div
						 *           when the palette fits; never scrolls itself
						 *  inner  — max-w-full, overflow-x-auto → constrained to the
						 *           available width so it can scroll left-to-right
						 *           when the palette is too wide; no justify-center
						 *           so nothing overflows to the left
						 */}
						<div className="flex min-w-0 flex-1 items-center justify-center">
							<div className="max-w-full overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<Palette
									onAddNode={paletteProps.onAddNode}
									zoom={paletteProps.zoom}
									pan={paletteProps.pan}
									className="flex-nowrap flex-shrink-0"
								/>
							</div>
						</div>
						{/* Right fade edge */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-card/80 to-transparent"
						/>
					</div>
				)}

				<div className="flex flex-shrink-0 items-center justify-end gap-1 sm:gap-2">
					<Button
						variant="ghost"
						size="sm"
						title="Notificaciones"
						className="rounded-md bg-muted/50"
					>
						<Bell className="h-4 w-4 text-muted-foreground" />
					</Button>

					<Button
						variant="outline"
						size="sm"
						onClick={onSave}
						disabled={isSaving}
						title="Guardar (Ctrl/Cmd+S)"
						className="gap-2 rounded-md px-3"
					>
						{isSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						<span className="text-sm font-semibold">
							{isSaving ? "Guardando..." : "Guardar"}
						</span>
					</Button>

					{workflowStatus === "published" ? (
						<Button
							variant="outline"
							size="sm"
							onClick={onPublish}
							title="Publicar nueva versión"
							className="gap-2 rounded-md border-primary/40 px-3 text-primary hover:border-primary hover:bg-primary/10 hover:text-primary"
						>
							<RefreshCw className="h-4 w-4" />
							<span className="text-sm font-semibold">Actualizar</span>
						</Button>
					) : (
						<Button
							variant="default"
							size="sm"
							onClick={onPublish}
							title="Publicar flujo"
							className="gap-2 rounded-md px-3"
						>
							<Rocket className="h-4 w-4" />
							<span className="text-sm font-semibold">Publicar</span>
						</Button>
					)}

					<Menubar className="border-none bg-transparent">
						<MenubarMenu>
							<MenubarTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									title="Más opciones"
									className="rounded-md bg-muted/50"
								>
									<MoreVertical className="h-4 w-4 text-muted-foreground" />
								</Button>
							</MenubarTrigger>
							<MenubarContent align="end">
								<MenubarItem onClick={onNew}>
									<Trash2 className="mr-2 h-4 w-4" />
									Reiniciar flujo
								</MenubarItem>
								<MenubarSub>
									<MenubarSubTrigger>
										<FolderOpen className="mr-2 h-4 w-4" />
										Cargar ejemplo
									</MenubarSubTrigger>
									<MenubarSubContent>
										<MenubarItem onClick={() => onLoadExample("basic")}>
											Flujo Básico
										</MenubarItem>
										<MenubarItem onClick={() => onLoadExample("api")}>
											Flujo con API
										</MenubarItem>
										<MenubarItem onClick={() => onLoadExample("manual")}>
											Revisión Humana
										</MenubarItem>
									</MenubarSubContent>
								</MenubarSub>
								<MenubarItem onClick={onManageFlags}>
									<Flag className="mr-2 h-4 w-4" />
									Gestionar Flags
								</MenubarItem>
								<MenubarItem onClick={onExportJSON}>
									<Download className="mr-2 h-4 w-4" />
									Exportar JSON
								</MenubarItem>
								<MenubarItem onClick={onImportJSON}>
									<Upload className="mr-2 h-4 w-4" />
									Importar JSON
								</MenubarItem>
								<MenubarItem onClick={onToggleWorkflowProperties}>
									<Settings className="mr-2 h-4 w-4" />
									Propiedades del flujo
								</MenubarItem>
								<MenubarItem>
									<HelpCircle className="mr-2 h-4 w-4" />
									Ayuda
								</MenubarItem>
								<MenubarSeparator />
								<MenubarItem
									onSelect={(e) => {
										e.preventDefault();
										setShortcutsModalOpen(true);
									}}
								>
									<Keyboard className="mr-2 h-4 w-4" />
									Atajos de teclado
								</MenubarItem>
							</MenubarContent>
						</MenubarMenu>
					</Menubar>

					<SessionControls />
				</div>
			</div>
			<KeyboardShortcutsModal
				open={shortcutsModalOpen}
				onOpenChange={setShortcutsModalOpen}
			/>
		</div>
	);
}

export function KeyboardShortcutsModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const normalizeKeys = (keys: string[]) =>
		keys.map((k) => (k === "Shift" ? "⇧" : k));

	const renderShortcutRow = (shortcut: ShortcutDefinition) => {
		const macNormalized = normalizeKeys(shortcut.mac);
		const winNormalized = normalizeKeys(shortcut.win);
		const areIdentical =
			JSON.stringify(macNormalized) === JSON.stringify(winNormalized);
		const macRest = macNormalized.slice(1);
		const canMerge =
			!areIdentical &&
			macNormalized[0] === "⌘" &&
			winNormalized[0] === "Ctrl" &&
			JSON.stringify(macRest) === JSON.stringify(winNormalized.slice(1));

		return (
			<div
				key={shortcut.label}
				className="flex items-center justify-between gap-6 py-1.5"
			>
				<span className="text-sm text-foreground/90 flex-shrink-0 min-w-[160px]">
					{shortcut.label}
				</span>
				<div className="flex items-center gap-1.5 flex-shrink-0">
					{areIdentical ? (
						<ShortcutKeys keys={macNormalized} />
					) : canMerge ? (
						<>
							<kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-md border border-border/40 bg-muted/80 text-xs font-semibold text-foreground shadow-sm">
								⌘
							</kbd>
							<span className="text-xs text-muted-foreground/60 mx-1">/</span>
							<span className="text-xs font-medium text-foreground/90">
								Ctrl
							</span>
							{macRest.length > 0 && (
								<>
									<span className="text-xs text-muted-foreground/60 mx-1">
										+
									</span>
									<ShortcutKeys keys={macRest} />
								</>
							)}
						</>
					) : (
						<>
							<ShortcutKeys keys={macNormalized} />
							<span className="text-xs text-muted-foreground/50 mx-1">/</span>
							<ShortcutKeys keys={winNormalized} />
						</>
					)}
				</div>
			</div>
		);
	};

	const barraSuperior = KEYBOARD_SHORTCUTS.filter(
		(shortcut) => shortcut.category === "Barra superior",
	);
	const barraInferior = KEYBOARD_SHORTCUTS.filter(
		(shortcut) => shortcut.category === "Barra inferior",
	);
	const herramientas = KEYBOARD_SHORTCUTS.filter(
		(shortcut) => shortcut.category === "Herramientas",
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-[1400px] sm:!max-w-[1400px] w-[90vw] h-auto max-h-none flex flex-col p-0 gap-0">
				<DialogHeader className="px-8 pt-5 pb-4 border-b flex-shrink-0">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<Keyboard className="h-5 w-5" />
						Atajos de teclado
					</DialogTitle>
				</DialogHeader>

				<div className="px-10 py-6">
					<div className="grid grid-cols-3 gap-x-12 gap-y-0">
						{/* Columna 1: Barra Superior */}
						<div className="flex flex-col gap-1.5">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
								BARRA SUPERIOR
							</h3>
							{barraSuperior.map(renderShortcutRow)}
						</div>

						{/* Columna 2: Barra Inferior */}
						<div className="flex flex-col gap-1.5">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
								BARRA INFERIOR
							</h3>
							{barraInferior.map(renderShortcutRow)}
						</div>

						{/* Columna 3: Herramientas */}
						<div className="flex flex-col gap-1.5">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
								HERRAMIENTAS
							</h3>
							{herramientas.map(renderShortcutRow)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ShortcutKeys({ keys }: { keys: string[] }) {
	return (
		<div className="flex items-center gap-1">
			{keys.map((key, index) => (
				<Fragment key={`${key}-${index}`}>
					<kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-md border border-border/40 bg-muted/80 text-xs font-semibold text-foreground shadow-sm">
						{key}
					</kbd>
					{index < keys.length - 1 && (
						<span className="text-xs text-muted-foreground/60 mx-0.5">+</span>
					)}
				</Fragment>
			))}
		</div>
	);
}
