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
	ChevronLeft,
	ChevronRight,
	Download,
	Upload,
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
	getWorkflow,
} from "@/lib/workflow-api/workflows";
import { JSONModal } from "@/components/workflow/json-modal";
import { useLanguage } from "@/components/LanguageProvider";
import { getLocaleForLanguage } from "@/lib/translations";
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
	{ labelKey: string; variant: "secondary" | "success" | "outline" }
> = {
	draft: { labelKey: "status.draft", variant: "secondary" },
	published: { labelKey: "status.published", variant: "success" },
	archived: { labelKey: "status.archived", variant: "outline" },
};

function StatusBadge({ status }: { status: WorkflowStatus | string }) {
	const { t } = useLanguage();
	const config = STATUS_CONFIG[status as WorkflowStatus];
	if (!config) {
		return <Badge variant="outline">{status}</Badge>;
	}
	if (status === "draft") {
		return (
			<Badge
				variant="outline"
				className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
			>
				{t(config.labelKey)}
			</Badge>
		);
	}
	return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>;
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
	onExport: (wf: Workflow) => void;
	deletingId: string | null;
	cloningId: string | null;
}

function getDefinitionMetadata(wf: Workflow): {
	nameEs?: string;
	descriptionEs?: string;
} {
	const def = wf.definition as Record<string, unknown> | null | undefined;
	if (!def || typeof def !== "object") return {};
	const meta = def.metadata as
		| { nameEs?: string; descriptionEs?: string }
		| undefined;
	return meta ?? {};
}

function WorkflowCardRow({
	workflow,
	onEdit,
	onArchive,
	onDelete,
	onClone,
	onExport,
	deletingId,
	cloningId,
}: WorkflowCardRowProps) {
	const isBusy = deletingId === workflow.id || cloningId === workflow.id;
	const { t, getFieldLabel } = useLanguage();
	const meta = getDefinitionMetadata(workflow);
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
				<p className="font-medium truncate">
					{getFieldLabel(workflow.name, meta.nameEs)}
				</p>
				<p className="text-sm text-muted-foreground truncate">
					{getFieldLabel(workflow.description || "", meta.descriptionEs) ||
						t("workflowList.noDescriptionPlaceholder")}
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
							{t("workflowList.rowActionEdit")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onArchive(workflow)}>
							{workflow.status === "archived" ? (
								<>
									<WorkflowIcon className="mr-2 h-4 w-4" />
									{t("workflowList.rowActionRestore")}
								</>
							) : (
								<>
									<WorkflowIcon className="mr-2 h-4 w-4" />
									{t("workflowList.rowActionArchive")}
								</>
							)}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => onClone(workflow)}>
							<Copy className="mr-2 h-4 w-4" />
							{t("workflowList.rowActionClone")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onExport(workflow)}>
							<Download className="mr-2 h-4 w-4" />
							{t("workflowList.rowActionExportJson")}
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
										{t("workflowList.rowActionDelete")}
									</DropdownMenuItem>
								</>
							)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function formatRelativeDate(
	dateStr: string,
	t: (key: string) => string,
	locale: string,
): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	// Use ceil so that timestamps slightly in the future (server clock skew)
	// round to 0 instead of producing negative values.
	const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
	if (diffDays === 0) return t("dates.today");
	if (diffDays === 1) return t("dates.yesterday");
	if (diffDays < 7) return t("dates.daysAgo").replace("{n}", String(diffDays));
	if (diffDays < 30)
		return t("dates.weeksAgo").replace("{n}", String(Math.floor(diffDays / 7)));
	return date.toLocaleDateString(locale, {
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
}

function CreateWorkflowDialog({
	open,
	onOpenChange,
	onCreated,
}: CreateWorkflowDialogProps) {
	const [name, setName] = useState("");
	const [nameEs, setNameEs] = useState("");
	const [description, setDescription] = useState("");
	const [descriptionEs, setDescriptionEs] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const { t } = useLanguage();

	const handleCreate = async () => {
		if (!name.trim()) {
			toast.error(t("workflowList.toastNameRequired"));
			return;
		}
		setIsCreating(true);
		try {
			const workflow = await createWorkflow({
				name: name.trim(),
				slug: slugify(name.trim()),
				description: description.trim(),
				status: "draft",
				class_name: toClassName(name.trim()),
				current_major_version: 0,
			});

			const trimmedNameEs = nameEs.trim() || undefined;
			const trimmedDescEs = descriptionEs.trim() || undefined;
			if (trimmedNameEs || trimmedDescEs) {
				localStorage.setItem(
					`workflow_initial_meta_es_${workflow.id}`,
					JSON.stringify({
						nameEs: trimmedNameEs,
						descriptionEs: trimmedDescEs,
					}),
				);
			}

			toast.success(
				t("workflowList.toastCreated").replace("{name}", workflow.name),
			);
			setName("");
			setNameEs("");
			setDescription("");
			setDescriptionEs("");
			onOpenChange(false);
			onCreated(workflow.id);
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			if (err instanceof ApiError && err.status === 409) {
				toast.error(t("workflowList.toastDuplicateName"));
			} else {
				toast.error(t("workflowList.toastCreateError"), { description: msg });
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
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("workflowList.createDialogTitle")}</DialogTitle>
					<DialogDescription>
						{t("workflowList.createDialogDesc")}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label htmlFor="wf-name">{t("workflowList.createFieldName")}</Label>
						<div className="grid grid-cols-2 gap-2">
							<Input
								id="wf-name"
								placeholder={t("workflowList.createFieldNamePlaceholder")}
								value={name}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={handleKeyDown}
								autoFocus
							/>
							<Input
								id="wf-name-es"
								placeholder={t("workflowList.createFieldNameEsPlaceholder")}
								value={nameEs}
								onChange={(e) => setNameEs(e.target.value)}
								onKeyDown={handleKeyDown}
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<span className="text-[10px] text-muted-foreground">
								{t("common.english")}
							</span>
							<span className="text-[10px] text-muted-foreground">
								{t("common.spanish")}
							</span>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="wf-desc">
							{t("workflowList.createFieldDescription")}
						</Label>
						<div className="grid grid-cols-2 gap-2">
							<Input
								id="wf-desc"
								placeholder={t(
									"workflowList.createFieldDescriptionPlaceholder",
								)}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								onKeyDown={handleKeyDown}
							/>
							<Input
								id="wf-desc-es"
								placeholder={t(
									"workflowList.createFieldDescriptionEsPlaceholder",
								)}
								value={descriptionEs}
								onChange={(e) => setDescriptionEs(e.target.value)}
								onKeyDown={handleKeyDown}
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<span className="text-[10px] text-muted-foreground">
								{t("common.english")}
							</span>
							<span className="text-[10px] text-muted-foreground">
								{t("common.spanish")}
							</span>
						</div>
					</div>
				</div>
				<div className="flex justify-end gap-2 pt-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isCreating}
					>
						{t("common.cancel")}
					</Button>
					<Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
						{isCreating ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								{t("workflowList.createButtonCreating")}
							</>
						) : (
							<>
								<Plus className="mr-2 h-4 w-4" />
								{t("workflowList.createButtonCreate")}
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
	const { t, language, getFieldLabel } = useLanguage();
	const locale = getLocaleForLanguage(language);
	const [search, setSearch] = useState("");
	const [searchScope, setSearchScope] = useState<SearchScope>("all");
	const [versionFilter, setVersionFilter] = useState<VersionFilter>("all");
	const [activeTab, setActiveTab] = useState("all");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [cloningId, setCloningId] = useState<string | null>(null);
	const [importModalOpen, setImportModalOpen] = useState(false);
	const [page, setPage] = useState(1);
	const [perPage, setPerPage] = useState(20);

	const { workflows, resultInfo, isLoading, error, mutate } = useWorkflows({
		search: search || undefined,
		status: activeTab === "all" ? undefined : activeTab,
		page,
		per_page: perPage,
	});

	// Lightweight stat calls (per_page=1) to get real total counts per status
	const { resultInfo: statsAll } = useWorkflows({ per_page: 1 });
	const { resultInfo: statsPublished } = useWorkflows({
		status: "published",
		per_page: 1,
	});
	const { resultInfo: statsDraft } = useWorkflows({
		status: "draft",
		per_page: 1,
	});
	const { resultInfo: statsArchived } = useWorkflows({
		status: "archived",
		per_page: 1,
	});

	// Client-side filter: only versionFilter applies (search/status handled server-side)
	const filtered = useMemo(() => {
		return workflows.filter((wf) => {
			const matchesVersion = (() => {
				if (versionFilter === "all") return true;
				if (versionFilter === "unpublished")
					return wf.current_major_version === 0;
				return wf.current_major_version === versionFilter;
			})();
			return matchesVersion;
		});
	}, [workflows, versionFilter]);

	// Stats
	const stats = useMemo(() => {
		return {
			total: statsAll?.total_count ?? 0,
			published: statsPublished?.total_count ?? 0,
			draft: statsDraft?.total_count ?? 0,
			archived: statsArchived?.total_count ?? 0,
		};
	}, [statsAll, statsPublished, statsDraft, statsArchived]);

	// Pagination helpers
	const totalPages = resultInfo
		? Math.ceil(resultInfo.total_count / resultInfo.per_page)
		: 1;
	const canGoPrev = page > 1;
	const canGoNext = page < totalPages;

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
		const newStatus = wf.status === "archived" ? "draft" : "archived";
		try {
			// PUT requires all non-optional fields — send the full workflow object
			// with only status changed to avoid validation errors.
			await updateWorkflow(wf.id, {
				name: wf.name,
				slug: wf.slug,
				description: wf.description,
				status: newStatus,
				class_name: wf.class_name,
				current_major_version: wf.current_major_version,
				...(wf.github_repo_url != null && {
					github_repo_url: wf.github_repo_url,
				}),
			});
			toast.success(
				newStatus === "archived"
					? t("workflowList.toastArchived").replace("{name}", wf.name)
					: t("workflowList.toastRestored").replace("{name}", wf.name),
			);
			mutate();
		} catch (err) {
			toast.error(t("workflowList.toastArchiveError"), {
				description: extractApiErrorMessage(err),
			});
		}
	};

	const handleDelete = async (wf: Workflow) => {
		if (!confirm(t("workflowList.deleteConfirm").replace("{name}", wf.name)))
			return;
		setDeletingId(wf.id);
		try {
			await deleteWorkflow(wf.id);
			toast.success(t("workflowList.toastDeleted").replace("{name}", wf.name));
			mutate();
		} catch (err) {
			toast.error(t("workflowList.toastDeleteError"), {
				description: extractApiErrorMessage(err),
			});
		} finally {
			setDeletingId(null);
		}
	};

	const handleClone = async (wf: Workflow) => {
		setCloningId(wf.id);
		try {
			const cloned = await cloneWorkflow(wf.id);
			toast.success(t("workflowList.toastCloned").replace("{name}", wf.name));
			mutate();
			router.push(`/editor/${cloned.id}`);
		} catch (err) {
			toast.error(t("workflowList.toastCloneError"), {
				description: extractApiErrorMessage(err),
			});
		} finally {
			setCloningId(null);
		}
	};

	const handleExportJson = async (wf: Workflow) => {
		try {
			const full = await getWorkflow(wf.id);
			const def =
				typeof full.definition === "string"
					? (JSON.parse(full.definition) as Record<string, unknown>)
					: ((full.definition ?? {}) as Record<string, unknown>);

			const exportData = {
				metadata: {
					version: "2.0",
					kind: "workflow",
					exportedAt: new Date().toISOString(),
				},
				definition: {
					nodes: def.nodes ?? [],
					edges: def.edges ?? [],
					flags: def.flags ?? [],
					zoom: def.zoom ?? 1,
					pan: def.pan ?? { x: 0, y: 0 },
					...(def.metadata ? { metadata: def.metadata } : {}),
				},
			};

			const slug = wf.slug || wf.name.toLowerCase().replace(/\s+/g, "-");
			const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
			const filename = `workflow-${slug}-${ts}.json`;

			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			toast.error(t("workflowList.toastExportError"));
		}
	};

	const handleImportNew = async (data: Record<string, unknown>) => {
		try {
			// Extract definition — support canonical v2.0 and legacy bare-root
			const def =
				(data.definition as Record<string, unknown> | undefined) ?? data;
			const meta = (def.metadata ?? data.metadata) as
				| Record<string, unknown>
				| undefined;
			const importedName =
				(meta?.nameEs as string | undefined) ||
				(data.name as string | undefined) ||
				t("workflowList.newWorkflow");
			const uniqueName =
				`${t("workflowList.rowActionClone").replace("Clone", "Imported")} ${importedName}`.trim();

			const created = await createWorkflow({
				name: uniqueName,
				slug: slugify(uniqueName),
				description: (data.description as string | undefined) ?? "",
				status: "draft",
				class_name: toClassName(uniqueName),
				current_major_version: 0,
				definition: def as Record<string, unknown>,
			});

			toast.success(t("workflowList.toastImportSuccess"));
			router.push(`/editor/${created.id}`);
		} catch {
			toast.error(t("workflowList.toastImportError"));
		}
	};

	// Skeleton until we have received a response (data defined) or error. Show empty
	// state only when loading is done and data is available (possibly empty array).
	const showSkeleton = !error && resultInfo === null && isLoading;

	if (showSkeleton) {
		return <WorkflowListSkeleton />;
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-8 sm:px-6 lg:px-8">
				{/* Header - responsive: stack on small screens, wrap actions on narrow */}
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3 min-w-0 flex-shrink-0">
						<img src="/app-icon.svg" alt="" className="h-8 w-auto shrink-0" />
						<div className="min-w-0">
							<h1 className="text-xl font-bold tracking-tight truncate sm:text-2xl">
								{t("workflowList.title")}
							</h1>
							<p className="text-sm text-muted-foreground truncate">
								{t("workflowList.subtitle")}
							</p>
						</div>
					</div>
					<div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
						<Button
							variant="outline"
							onClick={() => setImportModalOpen(true)}
							className="shrink-0"
						>
							<Upload className="mr-2 h-4 w-4" />
							{t("workflowList.importJson")}
						</Button>
						<Button
							onClick={() => setCreateDialogOpen(true)}
							className="shrink-0"
						>
							<Plus className="mr-2 h-4 w-4" />
							{t("workflowList.newWorkflow")}
						</Button>
						<SessionControls className="flex-wrap justify-end" />
					</div>
				</div>

				{/* Stats chips - scroll on very narrow screens */}
				<div className="mb-5 flex min-h-[44px] flex-wrap justify-center gap-2 overflow-x-auto pb-1">
					{[
						{
							label: t("workflowList.statsTotal"),
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
							label: t("workflowList.statsPublished"),
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
							label: t("workflowList.statsDrafts"),
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
							label: t("workflowList.statsArchived"),
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
								onClick={() => {
									setActiveTab(stat.tab);
									setPage(1);
								}}
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
							placeholder={t("workflowList.searchPlaceholder")}
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
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
								aria-label={t("workflowList.searchScope")}
							>
								<SelectValue placeholder={t("workflowList.searchScope")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									{t("workflowList.searchInAll")}
								</SelectItem>
								<SelectItem value="name">
									{t("workflowList.searchInName")}
								</SelectItem>
								<SelectItem value="description">
									{t("workflowList.searchInDescription")}
								</SelectItem>
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
								aria-label={t("workflowList.filterVersion")}
							>
								<SelectValue placeholder={t("workflowList.filterVersion")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									{t("workflowList.allVersions")}
								</SelectItem>
								<SelectItem value="unpublished">
									{t("workflowList.unpublished")}
								</SelectItem>
								{availableVersions.map((v) => (
									<SelectItem key={v} value={String(v)}>
										v{v}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
							{filtered.length === 1
								? t("workflowList.oneResult")
								: t("workflowList.manyResults").replace(
										"{n}",
										String(filtered.length),
									)}
						</span>
					</div>
				</div>

				{/* List */}
				<Card className="min-h-[200px] overflow-hidden">
					{error ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
							<AlertCircle className="h-8 w-8 text-destructive" />
							<p className="text-sm">{t("workflowList.errorLoading")}</p>
							<Button variant="outline" size="sm" onClick={() => mutate()}>
								{t("common.retry")}
							</Button>
						</div>
					) : filtered.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
							<img
								src="/app-icon.svg"
								alt=""
								className="h-10 w-auto opacity-30"
							/>
							<p className="text-sm">
								{search || activeTab !== "all" || versionFilter !== "all"
									? t("workflowList.noWorkflowsFiltered")
									: t("workflowList.noWorkflows")}
							</p>
							{!search && activeTab === "all" && versionFilter === "all" && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setCreateDialogOpen(true)}
								>
									<Plus className="mr-2 h-4 w-4" />
									{t("workflowList.newWorkflow")}
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
										onExport={handleExportJson}
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
											<TableHead>{t("workflowList.tableHeaderName")}</TableHead>
											<TableHead className="hidden sm:table-cell">
												{t("workflowList.tableHeaderDescription")}
											</TableHead>
											<TableHead>
												{t("workflowList.tableHeaderStatus")}
											</TableHead>
											<TableHead className="hidden md:table-cell">
												{t("workflowList.tableHeaderVersion")}
											</TableHead>
											<TableHead className="hidden lg:table-cell">
												{t("workflowList.tableHeaderUpdated")}
											</TableHead>
											<TableHead className="w-[60px]" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{filtered.map((wf) => {
											const wfMeta = getDefinitionMetadata(wf);
											const displayDesc = getFieldLabel(
												wf.description || "",
												wfMeta.descriptionEs,
											);
											return (
												<TableRow
													key={wf.id}
													className="cursor-pointer"
													onClick={() => handleEdit(wf.id)}
												>
													<TableCell className="font-medium">
														{getFieldLabel(wf.name, wfMeta.nameEs)}
													</TableCell>
													<TableCell className="hidden max-w-xs truncate text-muted-foreground sm:table-cell">
														{displayDesc || (
															<span className="italic opacity-50">
																{t("workflowList.noDescriptionPlaceholder")}
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
														{formatRelativeDate(wf.updated_at, t, locale)}
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
																	{deletingId === wf.id ||
																	cloningId === wf.id ? (
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
																	{t("workflowList.rowActionEdit")}
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => handleArchive(wf)}
																>
																	{wf.status === "archived" ? (
																		<>
																			<WorkflowIcon className="mr-2 h-4 w-4" />
																			{t("workflowList.rowActionRestore")}
																		</>
																	) : (
																		<>
																			<WorkflowIcon className="mr-2 h-4 w-4" />
																			{t("workflowList.rowActionArchive")}
																		</>
																	)}
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => handleClone(wf)}
																>
																	<Copy className="mr-2 h-4 w-4" />
																	{t("workflowList.rowActionClone")}
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => handleExportJson(wf)}
																>
																	<Download className="mr-2 h-4 w-4" />
																	{t("workflowList.rowActionExportJson")}
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
																				{t("workflowList.rowActionDelete")}
																			</DropdownMenuItem>
																		</>
																	)}
															</DropdownMenuContent>
														</DropdownMenu>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							{/* Pagination controls */}
							{resultInfo && resultInfo.total_count > 0 && (
								<div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">
											{t("workflowList.rowsPerPage")}
										</span>
										<Select
											value={String(perPage)}
											onValueChange={(v) => {
												setPerPage(Number(v));
												setPage(1);
											}}
										>
											<SelectTrigger className="h-8 w-[72px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{[10, 20, 50, 100].map((n) => (
													<SelectItem key={n} value={String(n)}>
														{n}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-sm text-muted-foreground">
											{t("workflowList.pageInfo")
												.replace("{page}", String(page))
												.replace("{total}", String(totalPages))}
										</span>
										<div className="flex items-center gap-1">
											<Button
												variant="outline"
												size="icon"
												className="h-8 w-8"
												disabled={!canGoPrev}
												onClick={() => setPage((p) => p - 1)}
												aria-label={t("workflowList.prevPage")}
											>
												<ChevronLeft className="h-4 w-4" />
											</Button>
											<Button
												variant="outline"
												size="icon"
												className="h-8 w-8"
												disabled={!canGoNext}
												onClick={() => setPage((p) => p + 1)}
												aria-label={t("workflowList.nextPage")}
											>
												<ChevronRight className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</Card>
			</div>

			<CreateWorkflowDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onCreated={handleCreated}
			/>

			{importModalOpen && (
				<JSONModal
					mode="import"
					workflow={{ nodes: [], edges: [], flags: [] }}
					onClose={() => setImportModalOpen(false)}
					onImport={(data) => {
						setImportModalOpen(false);
						void handleImportNew(data);
					}}
				/>
			)}
		</div>
	);
}
