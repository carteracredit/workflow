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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LanguageSwitcher, ThemeSwitcher } from "@algenium/blocks";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import { getAuthAppUrl } from "@/lib/auth/config";
import { logout } from "@/lib/auth/actions";
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
	Keyboard,
	ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WorkflowMetadata, WorkflowNode } from "@/lib/workflow/types";
import { Palette } from "@/components/workflow/palette";

const languages = [
	{ key: "en", label: "EN", nativeName: "English" },
	{ key: "es", label: "ES", nativeName: "Español" },
];

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
}

const STATUS_BADGE_CONFIG: Record<
	"draft" | "published" | "archived",
	{ label: string; variant: "secondary" | "success" | "outline" }
> = {
	draft: { label: "Borrador", variant: "secondary" },
	published: { label: "Publicado", variant: "success" },
	archived: { label: "Archivado", variant: "outline" },
};

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
}: TopBarProps) {
	const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

	const displayVersion = (() => {
		// Use the authoritative API version when available
		if (currentMajorVersion !== undefined && currentMajorVersion >= 1) {
			return `v${currentMajorVersion}`;
		}
		// Fall back to parsing metadata.version (legacy / unsaved workflows)
		const match = workflowMetadata.version.match(/(\d+)/);
		if (!match) return "v1";
		const parsed = Number.parseInt(match[1], 10);
		if (Number.isNaN(parsed) || parsed < 1) return "v1";
		return `v${parsed}`;
	})();

	return (
		<div className="relative z-50 border-b border-border bg-card/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/70">
			<div className="flex items-center gap-3">
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
						<span className="text-base font-semibold text-foreground">
							Workflow
						</span>
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
						<div className="flex items-center gap-1.5">
							<h1 className="truncate text-base font-semibold text-foreground">
								{workflowMetadata.name || "Your Workflow"}
							</h1>
							{workflowStatus && (
								<Badge
									variant={STATUS_BADGE_CONFIG[workflowStatus].variant}
									className="text-xs"
								>
									{STATUS_BADGE_CONFIG[workflowStatus].label}
								</Badge>
							)}
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

					<LanguageSwitcherWrapper />
					<ThemeSwitcherWrapper />
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

function LanguageSwitcherWrapper() {
	const { t, language, setLanguage } = useLanguage();

	return (
		<LanguageSwitcher
			languages={languages}
			currentLanguage={language}
			onLanguageChange={(key) => setLanguage(key as "en" | "es")}
			labels={{ language: t("languageToggle") }}
			showIcon
		/>
	);
}

function ThemeSwitcherWrapper() {
	const { t } = useLanguage();

	return (
		<ThemeSwitcher
			labels={{
				theme: t("themeToggle"),
				light: t("themeLight"),
				dark: t("themeDark"),
				system: t("themeSystem"),
			}}
		/>
	);
}

function UserMenu() {
	const { data: session } = useAuthSession();
	const { t } = useLanguage();

	const handleLogout = async () => {
		await logout();
	};

	if (!session) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-10 w-10 rounded-full">
					<Avatar className="h-10 w-10">
						<AvatarImage
							src={session.user.image || undefined}
							alt={session.user.name}
						/>
						<AvatarFallback>
							{session.user.name
								?.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				<div className="flex items-center gap-2 p-2">
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={session.user.image || undefined}
							alt={session.user.name}
						/>
						<AvatarFallback>
							{session.user.name
								?.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col space-y-0.5">
						<p className="text-sm font-medium">{session.user.name}</p>
						<p className="text-xs text-muted-foreground">
							{session.user.email}
						</p>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<a
						href={`${getAuthAppUrl()}/settings`}
						className="flex items-center gap-2 cursor-pointer"
					>
						<User className="h-4 w-4" />
						{t("userAccount")}
					</a>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleLogout}
					className="flex items-center gap-2 cursor-pointer text-destructive"
				>
					<LogOut className="h-4 w-4" />
					{t("userLogout")}
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
