"use client";

import { useState } from "react";
import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
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
} from "@/components/ui/dropdown-menu";
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
	Circle,
	ArrowRight,
	CheckCircle,
	AlertCircle,
	User,
	LogOut,
} from "lucide-react";
import type { WorkflowMetadata } from "@/lib/workflow/types";

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
	stats: {
		nodes: number;
		edges: number;
	};
	validationState: {
		status: "idle" | "valid" | "invalid";
		errorsCount: number;
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
	stats,
	validationState,
}: TopBarProps) {
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
			<div className="flex flex-wrap items-center gap-3">
				<div className="min-w-0 flex-1">
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

				<TopBarStats stats={stats} validationState={validationState} />

				<div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
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
							</MenubarContent>
						</MenubarMenu>
					</Menubar>

					<LanguageSelect />
					<ThemeSwitcher />
					<UserMenu />
				</div>
			</div>
		</div>
	);
}

interface TopBarStatsProps {
	stats: {
		nodes: number;
		edges: number;
	};
	validationState: {
		status: "idle" | "valid" | "invalid";
		errorsCount: number;
	};
}

function TopBarStats({ stats, validationState }: TopBarStatsProps) {
	const statusLabel =
		validationState.status === "valid"
			? "Sin errores"
			: validationState.status === "invalid"
				? `${validationState.errorsCount} pendientes`
				: "Pendiente";

	const StatusIcon =
		validationState.status === "valid"
			? CheckCircle
			: validationState.status === "invalid"
				? AlertCircle
				: AlertCircle;

	return (
		<div className="order-last w-full overflow-x-auto md:order-none md:flex-1">
			<div
				className="flex items-center justify-center gap-3 text-[11px] font-medium text-muted-foreground"
				role="status"
				aria-label="Resumen del flujo"
			>
				<StatChip icon={Circle} label="Nodos" value={stats.nodes} />
				<StatChip icon={ArrowRight} label="Transiciones" value={stats.edges} />
				<StatChip icon={StatusIcon} label="Validación" value={statusLabel} />
			</div>
		</div>
	);
}

interface StatChipProps {
	icon: ElementType;
	value: string | number;
	label: string;
}

function StatChip({ icon: Icon, value, label }: StatChipProps) {
	return (
		<div className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs text-foreground">
			<Icon className="h-3.5 w-3.5 text-muted-foreground" />
			<span className="font-semibold text-foreground">{value}</span>
			<span className="text-muted-foreground">{label}</span>
		</div>
	);
}

function LanguageSelect() {
	const [language, setLanguage] = useState<"es" | "en">("es");

	return (
		<Select
			value={language}
			onValueChange={(value) => setLanguage(value as "es" | "en")}
		>
			<SelectTrigger className="h-9 w-[90px] rounded-md border-border bg-muted/50 text-xs font-medium">
				<SelectValue placeholder="Idioma" />
			</SelectTrigger>
			<SelectContent align="end">
				<SelectItem value="es">ES</SelectItem>
				<SelectItem value="en">EN</SelectItem>
			</SelectContent>
		</Select>
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
