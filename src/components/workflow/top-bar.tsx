"use client";

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
		<div className="relative z-50 flex h-16 flex-wrap items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70">
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

			<div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
				{/* Notificaciones (placeholder) */}
				<div className="relative">
					<Button
						variant="ghost"
						size="sm"
						title="Notificaciones"
						className="rounded-md"
						style={{
							backgroundColor: "#2C2C2C",
						}}
					>
						<Bell className="h-4 w-4" style={{ color: "#8A98B4" }} />
					</Button>
				</div>

				{/* Publish */}
				<div className="relative">
					<Button
						variant="default"
						size="sm"
						onClick={onPublish}
						title="Publicar flujo"
					>
						<Rocket className="h-4 w-4" />
					</Button>
				</div>

				{/* Menú de opciones con Menubar */}
				<Menubar className="border-none bg-transparent">
					<MenubarMenu>
						<MenubarTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								title="Más opciones"
								className="rounded-md !bg-[#2C2C2C] hover:!bg-[#2C2C2C] data-[state=open]:!bg-[#2C2C2C]"
							>
								<MoreVertical
									className="h-4 w-4"
									style={{ color: "#8A98B4" }}
								/>
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

				<ThemeSwitcher />
			</div>
		</div>
	);
}
