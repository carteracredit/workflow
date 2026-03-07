"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
	Plus,
	Search,
	Pencil,
	Trash2,
	Copy,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useWorkflows } from "@/lib/workflow-api/hooks";
import {
	createWorkflow,
	deleteWorkflow,
	updateWorkflow,
	cloneWorkflow,
} from "@/lib/workflow-api/workflows";
import { useWorkflowApiToken } from "@/hooks/useWorkflowApiToken";
import { slugify } from "@/lib/slugify";
import type { Workflow } from "@/lib/workflow-api/types";
import { ApiError, extractApiErrorMessage } from "@/lib/workflow-api/http";
import { SessionControls } from "@/components/SessionControls";

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

// ---------------------------------------------------------------------------
// WorkflowCardRow - mobile list item
// ---------------------------------------------------------------------------

interface WorkflowCardRowProps {
	workflow: Workflow;
	onEdit: (id: string) => void;
	onArchive: (wf: Workflow) => void;
	onDelete: (wf: Workflow) => void;
	onClone: (wf: Workflow) => void;
	deletingId: string | null;
	cloningId: string | null;
}

function WorkflowCardRow({
	workflow,
	onEdit,
	onArchive,
	onDelete,
	onClone,
	deletingId,
	cloningId,
}: WorkflowCardRowProps) {
	const isBusy = deletingId === workflow.id || cloningId === workflow.id;
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => onEdit(workflow.id)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onEdit(workflow.id);
				}
			}}
			className="flex cursor-pointer items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<div className="min-w-0 flex-1">
				<p className="font-medium truncate">{workflow.name}</p>
				<p className="text-sm text-muted-foreground truncate">
					{workflow.description || "Sin descripción"}
				</p>
				<div className="mt-2">
					<StatusBadge status={workflow.status} />
				</div>
			</div>
			<div onClick={(e) => e.stopPropagation()}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							disabled={isBusy}
						>
							{isBusy ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<MoreHorizontal className="h-4 w-4" />
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onEdit(workflow.id)}>
							<Pencil className="mr-2 h-4 w-4" />
							Editar
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onArchive(workflow)}>
							{workflow.status === "archived" ? (
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
						<DropdownMenuItem onClick={() => onClone(workflow)}>
							<Copy className="mr-2 h-4 w-4" />
							Clonar
						</DropdownMenuItem>
						{workflow.current_major_version === 0 &&
							workflow.status === "draft" && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onClick={() => onDelete(workflow)}
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Eliminar
									</DropdownMenuItem>
								</>
							)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function formatRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	// Use ceil so that timestamps slightly in the future (server clock skew)
	// round to 0 instead of producing negative values.
	const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
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
// WorkflowListSkeleton
// ---------------------------------------------------------------------------

function WorkflowListSkeleton() {
	return (
		<div
			className="min-h-screen bg-background"
			role="status"
			aria-live="polite"
			aria-label="Cargando workflows"
		>
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{/* Header skeleton */}
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3 min-w-0">
						<Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
						<div className="min-w-0 flex-1 space-y-1">
							<Skeleton className="h-8 w-32" />
							<Skeleton className="h-4 w-56" />
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Skeleton className="h-10 w-36" />
						<Skeleton className="h-9 w-9 rounded-md" />
					</div>
				</div>

				{/* Stats chips skeleton */}
				<div className="mb-5 flex min-h-[44px] flex-wrap justify-center gap-2 overflow-x-auto">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton
							key={i}
							className="h-10 w-24 shrink-0 rounded-lg sm:w-28"
						/>
					))}
				</div>

				{/* Search skeleton */}
				<div className="mb-4 w-full max-w-sm">
					<Skeleton className="h-10 w-full rounded-md" />
				</div>

				{/* Table skeleton - desktop */}
				<Card className="min-h-[320px] overflow-hidden">
					<div className="hidden md:block">
						<div className="border-b px-4 py-3">
							<div className="flex gap-4">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-4 w-32 hidden sm:block" />
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-16 hidden md:block" />
								<Skeleton className="h-4 w-20 hidden lg:block" />
								<Skeleton className="h-4 w-10 ml-auto" />
							</div>
						</div>
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
							>
								<Skeleton className="h-4 w-40 flex-1 min-w-0" />
								<Skeleton className="h-4 w-32 hidden sm:block flex-shrink-0" />
								<Skeleton className="h-6 w-20 flex-shrink-0 rounded-full" />
								<Skeleton className="h-4 w-8 hidden md:block flex-shrink-0" />
								<Skeleton className="h-4 w-12 hidden lg:block flex-shrink-0" />
								<Skeleton className="h-8 w-8 flex-shrink-0 rounded" />
							</div>
						))}
					</div>
					{/* Card list skeleton - mobile */}
					<div className="md:hidden space-y-3 p-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="rounded-lg border p-4 space-y-2">
								<Skeleton className="h-5 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
								<div className="flex justify-between items-center pt-2">
									<Skeleton className="h-6 w-20 rounded-full" />
									<Skeleton className="h-8 w-8 rounded" />
								</div>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Create Workflow Dialog
// ---------------------------------------------------------------------------

interface CreateWorkflowDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (id: string) => void;
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
					// No definition on creation — the editor initialises with a default
					// Start node when definition is null. That state gets persisted to
					// localStorage automatically and to the DB on first explicit Save.
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

type SearchScope = "all" | "name" | "description";
type VersionFilter = "all" | "unpublished" | number;

export function WorkflowList() {
	const router = useRouter();
	const { token } = useWorkflowApiToken();
	const [search, setSearch] = useState("");
	const [searchScope, setSearchScope] = useState<SearchScope>("all");
	const [versionFilter, setVersionFilter] = useState<VersionFilter>("all");
	const [activeTab, setActiveTab] = useState("all");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [cloningId, setCloningId] = useState<string | null>(null);

	const {
		workflows,
		data,
		isLoading,
		isTokenLoading,
		error,
		mutate,
		hasValidKey,
	} = useWorkflows();

	// Client-side filter
	const filtered = useMemo(() => {
		return workflows.filter((wf) => {
			const matchesSearch = (() => {
				if (!search) return true;
				const q = search.toLowerCase();
				if (searchScope === "name") return wf.name.toLowerCase().includes(q);
				if (searchScope === "description")
					return wf.description.toLowerCase().includes(q);
				return (
					wf.name.toLowerCase().includes(q) ||
					wf.description.toLowerCase().includes(q)
				);
			})();
			const matchesStatus = activeTab === "all" || wf.status === activeTab;
			const matchesVersion = (() => {
				if (versionFilter === "all") return true;
				if (versionFilter === "unpublished")
					return wf.current_major_version === 0;
				return wf.current_major_version === versionFilter;
			})();
			return matchesSearch && matchesStatus && matchesVersion;
		});
	}, [workflows, search, searchScope, activeTab, versionFilter]);

	// Stats
	const stats = useMemo(() => {
		return {
			total: workflows.length,
			published: workflows.filter((w) => w.status === "published").length,
			draft: workflows.filter((w) => w.status === "draft").length,
			archived: workflows.filter((w) => w.status === "archived").length,
		};
	}, [workflows]);

	// Unique versions for filter (excluding 0)
	const availableVersions = useMemo(() => {
		const versions = new Set(
			workflows.map((w) => w.current_major_version).filter((v) => v > 0),
		);
		return Array.from(versions).sort((a, b) => a - b);
	}, [workflows]);

	const handleCreated = (id: string) => {
		router.push(`/editor/${id}`);
	};

	const handleEdit = (id: string) => {
		router.push(`/editor/${id}`);
	};

	const handleArchive = async (wf: Workflow) => {
		if (!token) {
			toast.error("No autenticado");
			return;
		}
		const newStatus = wf.status === "archived" ? "draft" : "archived";
		try {
			// PUT requires all non-optional fields — send the full workflow object
			// with only status changed to avoid validation errors.
			await updateWorkflow(
				wf.id,
				{
					name: wf.name,
					slug: wf.slug,
					description: wf.description,
					status: newStatus,
					class_name: wf.class_name,
					current_major_version: wf.current_major_version,
					...(wf.github_repo_url != null && {
						github_repo_url: wf.github_repo_url,
					}),
				},
				{ jwt: token },
			);
			toast.success(
				newStatus === "archived"
					? `"${wf.name}" archivado`
					: `"${wf.name}" restaurado como borrador`,
			);
			mutate();
		} catch (err) {
			toast.error("Error al actualizar el estado del workflow", {
				description: extractApiErrorMessage(err),
			});
		}
	};

	const handleDelete = async (wf: Workflow) => {
		if (!token) {
			toast.error("No autenticado");
			return;
		}
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

	const handleClone = async (wf: Workflow) => {
		if (!token) {
			toast.error("No autenticado");
			return;
		}
		setCloningId(wf.id);
		try {
			const cloned = await cloneWorkflow(wf.id, { jwt: token });
			toast.success(`Copia de "${wf.name}" creada`);
			mutate();
			router.push(`/editor/${cloned.id}`);
		} catch (err) {
			toast.error("Error al clonar workflow", {
				description: extractApiErrorMessage(err),
			});
		} finally {
			setCloningId(null);
		}
	};

	// Skeleton until we have received a response (data defined) or error. Show empty
	// state only when loading is done and data is available (possibly empty array).
	const showSkeleton =
		!error && data === undefined && (hasValidKey || isTokenLoading);

	if (showSkeleton) {
		return <WorkflowListSkeleton />;
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-8 sm:px-6 lg:px-8">
				{/* Header - responsive: stack on small screens, wrap actions on narrow */}
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3 min-w-0 flex-shrink-0">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<WorkflowIcon className="h-5 w-5 text-primary" />
						</div>
						<div className="min-w-0">
							<h1 className="text-xl font-bold tracking-tight truncate sm:text-2xl">
								Workflows
							</h1>
							<p className="text-sm text-muted-foreground truncate">
								Gestiona y publica tus flujos de trabajo
							</p>
						</div>
					</div>
					<div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
						<Button
							onClick={() => setCreateDialogOpen(true)}
							className="shrink-0"
						>
							<Plus className="mr-2 h-4 w-4" />
							Nuevo Workflow
						</Button>
						<SessionControls className="flex-wrap justify-end" />
					</div>
				</div>

				{/* Stats chips - scroll on very narrow screens */}
				<div className="mb-5 flex min-h-[44px] flex-wrap justify-center gap-2 overflow-x-auto pb-1">
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

				{/* Search and filters */}
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
					<div className="relative w-full min-w-0 flex-1 sm:max-w-sm">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Buscar por nombre o descripción..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<Select
							value={searchScope}
							onValueChange={(v) => setSearchScope(v as SearchScope)}
						>
							<SelectTrigger
								className="h-9 w-full min-w-0 sm:w-[180px]"
								aria-label="Ámbito de búsqueda"
							>
								<SelectValue placeholder="Buscar en" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Nombre y descripción</SelectItem>
								<SelectItem value="name">Solo nombre</SelectItem>
								<SelectItem value="description">Solo descripción</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={
								versionFilter === "all"
									? "all"
									: versionFilter === "unpublished"
										? "unpublished"
										: String(versionFilter)
							}
							onValueChange={(v) =>
								setVersionFilter(
									v === "all"
										? "all"
										: v === "unpublished"
											? "unpublished"
											: Number(v),
								)
							}
						>
							<SelectTrigger
								className="h-9 w-full min-w-0 sm:w-[140px]"
								aria-label="Filtrar por versión"
							>
								<SelectValue placeholder="Versión" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todas</SelectItem>
								<SelectItem value="unpublished">Sin publicar</SelectItem>
								{availableVersions.map((v) => (
									<SelectItem key={v} value={String(v)}>
										v{v}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
							{filtered.length === 1
								? "1 resultado"
								: `${filtered.length} resultados`}
						</span>
					</div>
				</div>

				{/* List */}
				<Card className="min-h-[200px] overflow-hidden">
					{error ? (
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
								{search || activeTab !== "all" || versionFilter !== "all"
									? "No se encontraron workflows con esos filtros"
									: "No hay workflows todavía. ¡Crea el primero!"}
							</p>
							{!search && activeTab === "all" && versionFilter === "all" && (
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
						<>
							{/* Mobile card list */}
							<div className="md:hidden divide-y">
								{filtered.map((wf) => (
									<WorkflowCardRow
										key={wf.id}
										workflow={wf}
										onEdit={handleEdit}
										onArchive={handleArchive}
										onDelete={handleDelete}
										onClone={handleClone}
										deletingId={deletingId}
										cloningId={cloningId}
									/>
								))}
							</div>
							{/* Desktop table */}
							<div className="hidden md:block">
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
														<span className="text-xs text-muted-foreground">
															—
														</span>
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
																disabled={
																	deletingId === wf.id || cloningId === wf.id
																}
															>
																{deletingId === wf.id || cloningId === wf.id ? (
																	<Loader2 className="h-4 w-4 animate-spin" />
																) : (
																	<MoreHorizontal className="h-4 w-4" />
																)}
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onClick={() => handleEdit(wf.id)}
															>
																<Pencil className="mr-2 h-4 w-4" />
																Editar
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => handleArchive(wf)}
															>
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
															<DropdownMenuItem onClick={() => handleClone(wf)}>
																<Copy className="mr-2 h-4 w-4" />
																Clonar
															</DropdownMenuItem>
															{wf.current_major_version === 0 &&
																wf.status === "draft" && (
																	<>
																		<DropdownMenuSeparator />
																		<DropdownMenuItem
																			className="text-destructive focus:text-destructive"
																			onClick={() => handleDelete(wf)}
																		>
																			<Trash2 className="mr-2 h-4 w-4" />
																			Eliminar
																		</DropdownMenuItem>
																	</>
																)}
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</>
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
