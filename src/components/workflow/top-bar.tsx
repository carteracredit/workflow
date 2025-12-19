"use client";

import { useState, Fragment, type ReactNode } from "react";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import {
	Save,
	Upload,
	Download,
	HelpCircle,
	FolderOpen,
	Rocket,
	Trash2,
	Flag,
	Settings,
	MoreVertical,
	Bell,
	Pencil,
	ChevronRight,
	User,
	LogOut,
	Check,
	Keyboard,
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
	onSave: () => void;
	onPublish: () => void;
	onExportJSON: () => void;
	onImportJSON: () => void;
	onLoadExample: (key: "basic" | "api" | "manual") => void;
	onManageFlags: () => void;
	onToggleWorkflowProperties: () => void;
	workflowMetadata: WorkflowMetadata;
	paletteProps?: {
		onAddNode: (node: WorkflowNode) => void;
		zoom: number;
		pan: { x: number; y: number };
	};
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
	paletteProps,
}: TopBarProps) {
	const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

	const displayVersion = (() => {
		const match = workflowMetadata.version.match(/(\d+)/);
		if (!match) return "v1";
		const parsed = Number.parseInt(match[1], 10);
		if (Number.isNaN(parsed) || parsed < 1) return "v1";
		const clamped = Math.min(parsed, 3);
		return `v${clamped}`;
	})();

	return (
		<div className="relative z-50 border-b border-border bg-card/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/70">
			<div className="flex items-center gap-3">
				<div className="min-w-0 flex-shrink-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-base font-semibold text-foreground">
							Cartera
						</span>
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
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
						{workflowMetadata.version && (
							<span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-foreground/70">
								{displayVersion}
							</span>
						)}
					</div>
				</div>

				{paletteProps && (
					<div className="flex flex-1 items-center justify-center">
						<Palette
							onAddNode={paletteProps.onAddNode}
							zoom={paletteProps.zoom}
							pan={paletteProps.pan}
							className="flex-nowrap"
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
						variant="default"
						size="sm"
						onClick={onPublish}
						title="Publicar flujo"
						className="gap-2 rounded-md px-3"
					>
						<Rocket className="h-4 w-4" />
						<span className="text-sm font-semibold">Publicar</span>
					</Button>

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
								<MenubarItem onClick={onSave}>
									<Save className="mr-2 h-4 w-4" />
									Guardar
								</MenubarItem>
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

					<LanguageSelect />
					<ThemeSwitcher />
					<UserMenu />
				</div>
			</div>
			<KeyboardShortcutsModal
				open={shortcutsModalOpen}
				onOpenChange={setShortcutsModalOpen}
			/>
		</div>
	);
}

function LanguageSelect() {
	const [language, setLanguage] = useState<"es" | "en">("es");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-9 w-auto min-w-[40px] rounded-md border-purple-400/50 bg-background px-2 text-xs font-medium text-foreground hover:bg-accent hover:border-purple-400/70"
				>
					{language.toUpperCase()}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-auto min-w-[44px] p-0.5">
				<DropdownMenuRadioGroup
					value={language}
					onValueChange={(value) => setLanguage(value as "es" | "en")}
				>
					<DropdownMenuRadioItem
						value="en"
						className="cursor-pointer justify-center px-3 py-1.5 text-xs rounded-sm pl-3 pr-3 [&>span:first-child]:hidden data-[state=checked]:bg-accent/80 data-[state=checked]:text-foreground"
					>
						EN
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem
						value="es"
						className="cursor-pointer justify-center px-3 py-1.5 text-xs rounded-sm pl-3 pr-3 [&>span:first-child]:hidden data-[state=checked]:bg-accent/80 data-[state=checked]:text-foreground"
					>
						ES
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function UserMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 rounded-full border border-border/60 bg-muted/40"
					title="Menú de usuario"
				>
					<Avatar className="h-7 w-7">
						<AvatarImage src="https://api.dicebear.com/7.x/thumbs/svg?seed=cartera" />
						<AvatarFallback>CA</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<User className="mr-2 h-4 w-4" />
					Perfil
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Settings className="mr-2 h-4 w-4" />
					Preferencias
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<LogOut className="mr-2 h-4 w-4" />
					Cerrar sesión
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
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
