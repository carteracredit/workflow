"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
	Plus,
	Search,
	Pencil,
	Trash2,
	MoreHorizontal,
	Loader2,
	AlertCircle,
	Workflow as WorkflowIcon,
	Layers,
	CheckCircle2,
	FileEdit,
	Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useWorkflows } from "@/lib/workflow-api/hooks";
import {
	createWorkflow,
	deleteWorkflow,
	updateWorkflow,
} from "@/lib/workflow-api/workflows";
import { useWorkflowApiToken } from "@/hooks/useWorkflowApiToken";
import { slugify } from "@/lib/slugify";
import type { Workflow } from "@/lib/workflow-api/types";
import { ApiError, extractApiErrorMessage } from "@/lib/workflow-api/http";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toClassName(name: string): string {
	return (
		name
			.replace(/[^a-zA-Z0-9\s]/g, "")
			.trim()
			.split(/\s+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join("") || "GeneratedWorkflow"
	);
}

type WorkflowStatus = "draft" | "published" | "archived";

const STATUS_CONFIG: Record<
	WorkflowStatus,
	{ label: string; variant: "secondary" | "success" | "outline" }
> = {
	draft: { label: "Borrador", variant: "secondary" },
	published: { label: "Publicado", variant: "success" },
	archived: { label: "Archivado", variant: "outline" },
};

function StatusBadge({ status }: { status: WorkflowStatus | string }) {
	const config = STATUS_CONFIG[status as WorkflowStatus] ?? {
		label: status,
		variant: "outline" as const,
	};
	return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	if (diffDays === 0) return "Hoy";
	if (diffDays === 1) return "Ayer";
	if (diffDays < 7) return `Hace ${diffDays} días`;
	if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
	return date.toLocaleDateString("es-MX", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

// ---------------------------------------------------------------------------
// Create Workflow Dialog
// ---------------------------------------------------------------------------

interface CreateWorkflowDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (id: number) => void;
	apiToken: string | null;
}

function CreateWorkflowDialog({
	open,
	onOpenChange,
	onCreated,
	apiToken,
}: CreateWorkflowDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const handleCreate = async () => {
		if (!name.trim()) {
			toast.error("El nombre es requerido");
			return;
		}
		if (!apiToken) {
			toast.error("No autenticado");
			return;
		}
		setIsCreating(true);
		try {
			const workflow = await createWorkflow(
				{
					name: name.trim(),
					slug: slugify(name.trim()),
					description: description.trim(),
					status: "draft",
					class_name: toClassName(name.trim()),
					current_major_version: 0,
					definition: JSON.stringify({
						nodes: [],
						edges: [],
						flags: [],
						zoom: 1,
						pan: { x: 0, y: 0 },
					}),
				},
				{ jwt: apiToken },
			);
			toast.success(`Workflow "${workflow.name}" creado`);
			setName("");
			setDescription("");
			onOpenChange(false);
			onCreated(workflow.id);
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			if (err instanceof ApiError && err.status === 409) {
				toast.error("Ya existe un workflow con ese nombre");
			} else {
				toast.error("Error al crear workflow", { description: msg });
			}
		} finally {
			setIsCreating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleCreate();
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Nuevo Workflow</DialogTitle>
					<DialogDescription>
						Crea un borrador nuevo. Podrás agregar nodos y publicarlo desde el
						editor.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label htmlFor="wf-name">Nombre *</Label>
						<Input
							id="wf-name"
							placeholder="Ej: Aprobación de Crédito"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="wf-desc">Descripción</Label>
						<Input
							id="wf-desc"
							placeholder="Descripción opcional del workflow"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
					</div>
				</div>
				<div className="flex justify-end gap-2 pt-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isCreating}
					>
						Cancelar
					</Button>
					<Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
						{isCreating ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creando...
							</>
						) : (
							<>
								<Plus className="mr-2 h-4 w-4" />
								Crear workflow
							</>
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Main WorkflowList component
// ---------------------------------------------------------------------------

export function WorkflowList() {
	const router = useRouter();
	const { token } = useWorkflowApiToken();
	const [search, setSearch] = useState("");
	const [activeTab, setActiveTab] = useState("all");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);

	const { workflows, isLoading, error, mutate } = useWorkflows();

	// Client-side filter
	const filtered = useMemo(() => {
		return workflows.filter((wf) => {
			const matchesSearch =
				!search ||
				wf.name.toLowerCase().includes(search.toLowerCase()) ||
				wf.description.toLowerCase().includes(search.toLowerCase());
			const matchesStatus = activeTab === "all" || wf.status === activeTab;
			return matchesSearch && matchesStatus;
		});
	}, [workflows, search, activeTab]);

	// Stats
	const stats = useMemo(() => {
		return {
			total: workflows.length,
			published: workflows.filter((w) => w.status === "published").length,
			draft: workflows.filter((w) => w.status === "draft").length,
			archived: workflows.filter((w) => w.status === "archived").length,
		};
	}, [workflows]);

	const handleCreated = (id: number) => {
		router.push(`/editor/${id}`);
	};

	const handleEdit = (id: number) => {
		router.push(`/editor/${id}`);
	};

	const handleArchive = async (wf: Workflow) => {
		if (!token) return;
		const newStatus = wf.status === "archived" ? "draft" : "archived";
		try {
			await updateWorkflow(wf.id, { status: newStatus }, { jwt: token });
			toast.success(
				newStatus === "archived"
					? `"${wf.name}" archivado`
					: `"${wf.name}" restaurado como borrador`,
			);
			mutate();
		} catch {
			toast.error("Error al actualizar el estado del workflow");
		}
	};

	const handleDelete = async (wf: Workflow) => {
		if (!token) return;
		if (!confirm(`¿Eliminar "${wf.name}"? Esta acción no se puede deshacer.`))
			return;
		setDeletingId(wf.id);
		try {
			await deleteWorkflow(wf.id, { jwt: token });
			toast.success(`"${wf.name}" eliminado`);
			mutate();
		} catch (err) {
			toast.error("Error al eliminar", {
				description: extractApiErrorMessage(err),
			});
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="mb-8 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<WorkflowIcon className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
							<p className="text-sm text-muted-foreground">
								Gestiona y publica tus flujos de trabajo
							</p>
						</div>
					</div>
					<Button onClick={() => setCreateDialogOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Nuevo Workflow
					</Button>
				</div>

				{/* Stats chips */}
				<div className="mb-5 flex flex-wrap justify-center gap-2">
					{[
						{
							label: "Total",
							value: stats.total,
							tab: "all",
							icon: <Layers className="h-3.5 w-3.5" />,
							iconBg: "bg-primary/10",
							iconColor: "text-primary",
							numColor: "text-foreground",
							activeBorder: "border-primary",
							activeBg: "bg-primary/10",
							activeLabel: "text-primary",
						},
						{
							label: "Publicados",
							value: stats.published,
							tab: "published",
							icon: <CheckCircle2 className="h-3.5 w-3.5" />,
							iconBg: "bg-emerald-500/10",
							iconColor: "text-emerald-500",
							numColor: "text-emerald-600 dark:text-emerald-400",
							activeBorder: "border-emerald-500",
							activeBg: "bg-emerald-500/10",
							activeLabel: "text-emerald-600 dark:text-emerald-400",
						},
						{
							label: "Borradores",
							value: stats.draft,
							tab: "draft",
							icon: <FileEdit className="h-3.5 w-3.5" />,
							iconBg: "bg-amber-500/10",
							iconColor: "text-amber-500",
							numColor: "text-amber-600 dark:text-amber-400",
							activeBorder: "border-amber-500",
							activeBg: "bg-amber-500/10",
							activeLabel: "text-amber-600 dark:text-amber-400",
						},
						{
							label: "Archivados",
							value: stats.archived,
							tab: "archived",
							icon: <Archive className="h-3.5 w-3.5" />,
							iconBg: "bg-muted",
							iconColor: "text-muted-foreground",
							numColor: "text-muted-foreground",
							activeBorder: "border-slate-400 dark:border-slate-500",
							activeBg: "bg-slate-500/10",
							activeLabel: "text-slate-600 dark:text-slate-400",
						},
					].map((stat) => {
						const isActive = activeTab === stat.tab;
						return (
							<button
								key={stat.label}
								onClick={() => setActiveTab(stat.tab)}
								className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-all hover:bg-accent ${
									isActive
										? `${stat.activeBorder} ${stat.activeBg} shadow-sm`
										: "border-border bg-card"
								}`}
							>
								<span
									className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${stat.iconBg} ${stat.iconColor}`}
								>
									{stat.icon}
								</span>
								<span className={`font-bold tabular-nums ${stat.numColor}`}>
									{stat.value}
								</span>
								<span
									className={`transition-colors ${isActive ? stat.activeLabel : "text-muted-foreground"}`}
								>
									{stat.label}
								</span>
							</button>
						);
					})}
				</div>

				{/* Search */}
				<div className="mb-4 relative max-w-sm">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Buscar por nombre o descripción..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Table */}
				<Card>
					{isLoading ? (
						<div className="flex items-center justify-center py-16">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : error ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
							<AlertCircle className="h-8 w-8 text-destructive" />
							<p className="text-sm">Error al cargar los workflows</p>
							<Button variant="outline" size="sm" onClick={() => mutate()}>
								Reintentar
							</Button>
						</div>
					) : filtered.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
							<WorkflowIcon className="h-10 w-10 opacity-30" />
							<p className="text-sm">
								{search || activeTab !== "all"
									? "No se encontraron workflows con esos filtros"
									: "No hay workflows todavía. ¡Crea el primero!"}
							</p>
							{!search && activeTab === "all" && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setCreateDialogOpen(true)}
								>
									<Plus className="mr-2 h-4 w-4" />
									Nuevo Workflow
								</Button>
							)}
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Nombre</TableHead>
									<TableHead className="hidden sm:table-cell">
										Descripción
									</TableHead>
									<TableHead>Estado</TableHead>
									<TableHead className="hidden md:table-cell">
										Versión
									</TableHead>
									<TableHead className="hidden lg:table-cell">
										Actualizado
									</TableHead>
									<TableHead className="w-[60px]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map((wf) => (
									<TableRow
										key={wf.id}
										className="cursor-pointer"
										onClick={() => handleEdit(wf.id)}
									>
										<TableCell className="font-medium">{wf.name}</TableCell>
										<TableCell className="hidden max-w-xs truncate text-muted-foreground sm:table-cell">
											{wf.description || (
												<span className="italic opacity-50">
													Sin descripción
												</span>
											)}
										</TableCell>
										<TableCell>
											<StatusBadge status={wf.status} />
										</TableCell>
										<TableCell className="hidden md:table-cell">
											{wf.current_major_version > 0 ? (
												<span className="font-mono text-xs text-muted-foreground">
													v{wf.current_major_version}
												</span>
											) : (
												<span className="text-xs text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="hidden text-muted-foreground lg:table-cell">
											{formatRelativeDate(wf.updated_at)}
										</TableCell>
										<TableCell
											onClick={(e) => e.stopPropagation()}
											className="text-right"
										>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														disabled={deletingId === wf.id}
													>
														{deletingId === wf.id ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<MoreHorizontal className="h-4 w-4" />
														)}
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem onClick={() => handleEdit(wf.id)}>
														<Pencil className="mr-2 h-4 w-4" />
														Editar
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => handleArchive(wf)}>
														{wf.status === "archived" ? (
															<>
																<WorkflowIcon className="mr-2 h-4 w-4" />
																Restaurar
															</>
														) : (
															<>
																<WorkflowIcon className="mr-2 h-4 w-4" />
																Archivar
															</>
														)}
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => handleDelete(wf)}
													>
														<Trash2 className="mr-2 h-4 w-4" />
														Eliminar
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</Card>
			</div>

			<CreateWorkflowDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onCreated={handleCreated}
				apiToken={token}
			/>
		</div>
	);
}
