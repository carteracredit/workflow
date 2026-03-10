"use client";

import { useEffect, useState, useCallback } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Loader2,
	CheckCircle2,
	XCircle,
	ChevronDown,
	ChevronRight,
	Download,
	Rocket,
	ExternalLink,
} from "lucide-react";
import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
	Flag,
} from "@/lib/workflow/types";
import {
	generateWorkflowCodeWithProgress,
	type TranspilationPhase,
	type TranspilationResult,
} from "@/lib/workflow/code-generator";
import { formatGeneratedCode } from "@/lib/workflow/format-code";
import { publishWorkflow } from "@/lib/workflow-api/workflows";
import type { PublishWorkflowDeployedResponse } from "@/lib/workflow-api/types";
import { extractApiErrorMessage } from "@/lib/workflow-api/http";
import { toast } from "sonner";

export interface PublishModalProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	metadata: WorkflowMetadata;
	flags: Flag[];
	/** Current canvas zoom level — included in the definition snapshot */
	zoom?: number;
	/** Current canvas pan offset — included in the definition snapshot */
	pan?: { x: number; y: number };
	/** API id of the saved workflow in workflow-svc (null = not yet saved) */
	workflowApiId: string | null;
	/** Callback to save the workflow first if workflowApiId is null */
	onSave: () => Promise<void>;
	/** JWT token for authenticated API calls */
	apiToken: string | null;
	onClose: () => void;
	/** Called with the new status and version when publish completes successfully */
	onPublished?: (status: "published", majorVersion?: number) => void;
}

// ---------------------------------------------------------------------------
// Phase item component
// ---------------------------------------------------------------------------

function PhaseItem({ phase }: { phase: TranspilationPhase }) {
	const [expanded, setExpanded] = useState(false);

	const getIcon = () => {
		switch (phase.status) {
			case "running":
				return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
			case "done":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "error":
				return <XCircle className="h-5 w-5 text-red-500" />;
			default:
				return (
					<div className="h-5 w-5 rounded-full border-2 border-gray-300" />
				);
		}
	};

	const hasLogs = phase.logs.length > 0;

	return (
		<div className="mb-4">
			<div className="flex items-start gap-3">
				<div className="mt-0.5">{getIcon()}</div>
				<div className="flex-1">
					<div className="flex items-center justify-between">
						<span
							className={`font-medium ${
								phase.status === "error"
									? "text-red-600"
									: phase.status === "done"
										? "text-green-600"
										: "text-gray-700"
							}`}
						>
							{phase.label}
						</span>
						{hasLogs && (
							<button
								type="button"
								onClick={() => setExpanded(!expanded)}
								className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
							>
								{expanded ? (
									<ChevronDown className="h-4 w-4" />
								) : (
									<ChevronRight className="h-4 w-4" />
								)}
								{phase.logs.length} log(s)
							</button>
						)}
					</div>
					{expanded && hasLogs && (
						<div className="mt-2 rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
							{phase.logs.map((log, i) => (
								<div key={i} className="whitespace-pre-wrap">
									{log}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Deployment status phase item (for the "Publicando en Cloudflare" step)
// ---------------------------------------------------------------------------

type DeployPhaseStatus = "idle" | "running" | "done" | "error";

function DeployPhaseItem({
	status,
	error,
}: {
	status: DeployPhaseStatus;
	error?: string;
}) {
	const getIcon = () => {
		switch (status) {
			case "running":
				return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
			case "done":
				return <CheckCircle2 className="h-5 w-5 text-green-500" />;
			case "error":
				return <XCircle className="h-5 w-5 text-red-500" />;
			default:
				return (
					<div className="h-5 w-5 rounded-full border-2 border-gray-300" />
				);
		}
	};

	return (
		<div className="mb-4">
			<div className="flex items-start gap-3">
				<div className="mt-0.5">{getIcon()}</div>
				<div className="flex-1">
					<span
						className={`font-medium ${
							status === "error"
								? "text-red-600"
								: status === "done"
									? "text-green-600"
									: "text-gray-700"
						}`}
					>
						Publicando en Cloudflare
					</span>
					{error && <p className="mt-1 text-sm text-red-500">{error}</p>}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function PublishModal({
	nodes,
	edges,
	metadata,
	flags,
	zoom = 1,
	pan = { x: 0, y: 0 },
	workflowApiId,
	onSave,
	apiToken,
	onClose,
	onPublished,
}: PublishModalProps) {
	const [phases, setPhases] = useState<TranspilationPhase[]>([]);
	const [transpileResult, setTranspileResult] =
		useState<TranspilationResult | null>(null);
	const [deployStatus, setDeployStatus] = useState<DeployPhaseStatus>("idle");
	const [deployResult, setDeployResult] =
		useState<PublishWorkflowDeployedResponse | null>(null);
	const [deployError, setDeployError] = useState<string | undefined>();
	const [skipped, setSkipped] = useState(false);
	const [isRunning, setIsRunning] = useState(true);

	const run = useCallback(async () => {
		// Reset all state so a retry starts with a clean slate.
		setIsRunning(true);
		setSkipped(false);
		setPhases([]);
		setTranspileResult(null);
		setDeployStatus("idle");
		setDeployResult(null);
		setDeployError(undefined);

		// Step 1: Auto-save if needed
		if (!workflowApiId) {
			try {
				await onSave();
			} catch {
				toast.error("Error al guardar el workflow antes de publicar");
				setIsRunning(false);
				return;
			}
		}

		// Step 2: Generate TypeScript code
		// The template expects "MyWorkflow" as the class name
		let generatedCode: string | null = null;
		try {
			const result = await generateWorkflowCodeWithProgress(
				nodes,
				edges,
				metadata,
				{
					className: "MyWorkflow",
					includeComments: true,
					includeImports: true,
				},
				(updatedPhases) => {
					setPhases(updatedPhases);
				},
			);

			setTranspileResult(result);

			if (!result.valid || !result.code) {
				toast.error("Error al transpilar workflow", {
					description: `${result.errors.length} error(es) encontrados`,
				});
				setIsRunning(false);
				return;
			}

			// Format with Prettier so the deployed file passes format:check in CI
			generatedCode = await formatGeneratedCode(result.code);
		} catch (err) {
			toast.error("Error inesperado durante la transpilación", {
				description: err instanceof Error ? err.message : "Error desconocido",
			});
			setIsRunning(false);
			return;
		}

		// Step 3: Publish to Cloudflare via workflow-svc → GitHub → GitHub Actions
		if (!apiToken) {
			toast.error("No autenticado", {
				description: "Debes iniciar sesión para publicar.",
			});
			setIsRunning(false);
			return;
		}

		// workflowApiId should now be set (either was already set or saved above)
		// We re-read from localStorage since onSave() may have updated it
		let currentWorkflowId = workflowApiId;
		if (!currentWorkflowId && typeof window !== "undefined") {
			const saved = localStorage.getItem("cartera-workflow-api-id");
			if (saved) currentWorkflowId = saved;
		}

		if (!currentWorkflowId) {
			toast.error("No se pudo obtener el ID del workflow guardado");
			setIsRunning(false);
			return;
		}

		// Build definition snapshot: always sent to keep the DB in sync with the
		// editor state, even when the user never clicked "Save" explicitly.
		const definitionSnapshot = {
			nodes,
			edges,
			flags,
			zoom,
			pan,
		};

		setDeployStatus("running");
		try {
			const result = await publishWorkflow(
				currentWorkflowId,
				{
					code: generatedCode,
					environment: "development",
					definition: definitionSnapshot,
				},
				{ jwt: apiToken },
			);

			if (result.skipped) {
				setSkipped(true);
				setDeployStatus("done");
				toast.info("Sin cambios detectados", {
					description:
						"El workflow no ha cambiado desde la última publicación. No se realizó un nuevo deploy.",
				});
			} else {
				setDeployResult(result as PublishWorkflowDeployedResponse);
				setDeployStatus("done");
				const deployedVersion = (result as PublishWorkflowDeployedResponse)
					.version;
				onPublished?.("published", deployedVersion ?? undefined);
				toast.success("Workflow publicado", {
					description: `Deployment iniciado. GitHub Actions desplegará a Cloudflare automáticamente.`,
				});
			}
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			setDeployError(msg);
			setDeployStatus("error");
			toast.error("Error al publicar", { description: msg });
		}

		setIsRunning(false);
	}, [
		nodes,
		edges,
		metadata,
		flags,
		zoom,
		pan,
		workflowApiId,
		onSave,
		apiToken,
		onPublished,
	]);

	useEffect(() => {
		run();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleDownload = () => {
		if (!transpileResult?.code) return;

		const filename = metadata.name
			? `${metadata.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.ts`
			: "workflow.ts";

		const blob = new Blob([transpileResult.code], { type: "text/typescript" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toast.success("Archivo descargado", { description: filename });
	};

	const isFinished = !isRunning;
	const transpileOk = transpileResult?.valid === true;

	const getDescription = () => {
		if (isRunning) return "Generando y publicando workflow...";
		if (deployStatus === "done" && skipped)
			return "No se detectaron cambios desde la última publicación.";
		if (deployStatus === "done")
			return "Workflow publicado. GitHub Actions desplegará a Cloudflare automáticamente.";
		if (deployStatus === "error") return "Error al publicar el workflow.";
		if (!transpileOk) return "Error al transpilar el workflow.";
		return "Proceso completado.";
	};

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Publicar Workflow</DialogTitle>
					<DialogDescription>{getDescription()}</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					{phases.map((phase) => (
						<PhaseItem key={phase.id} phase={phase} />
					))}

					{/* Deploy phase — only show after transpilation starts */}
					{phases.length > 0 && (
						<DeployPhaseItem status={deployStatus} error={deployError} />
					)}
				</div>

				{/* No changes — skipped */}
				{deployStatus === "done" && skipped && (
					<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
						<p className="mb-1 text-sm font-medium text-amber-800">
							Sin cambios detectados
						</p>
						<p className="text-xs text-amber-700">
							El código generado es idéntico al de la última publicación. No se
							realizó un nuevo deploy ni se incrementó la versión.
						</p>
					</div>
				)}

				{/* Deployment result */}
				{deployStatus === "done" && deployResult && !skipped && (
					<div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
						<p className="mb-2 text-sm font-medium text-green-800">
							Deployment iniciado correctamente
						</p>
						<div className="space-y-1 text-xs text-green-700">
							<p>
								<span className="font-medium">Worker:</span>{" "}
								{deployResult.worker_name}
							</p>
							<p>
								<span className="font-medium">Branch:</span>{" "}
								{deployResult.branch}
							</p>
							<p>
								<span className="font-medium">Versión:</span> v
								{deployResult.version}
							</p>
							<p>
								<span className="font-medium">Estado:</span>{" "}
								{deployResult.deployment.status}
							</p>
						</div>
						{deployResult.repo_url && (
							<a
								href={deployResult.repo_url}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-2 inline-flex items-center gap-1 text-xs text-green-700 underline hover:text-green-900"
							>
								Ver repositorio en GitHub
								<ExternalLink className="h-3 w-3" />
							</a>
						)}
					</div>
				)}

				{isFinished && (
					<div className="flex justify-end gap-3 border-t pt-4">
						<Button variant="outline" onClick={onClose}>
							Cerrar
						</Button>
						{transpileOk && transpileResult?.code && (
							<Button variant="outline" onClick={handleDownload}>
								<Download className="mr-2 h-4 w-4" />
								Descargar .ts
							</Button>
						)}
						{deployStatus === "error" && (
							<Button onClick={() => run()}>
								<Rocket className="mr-2 h-4 w-4" />
								Reintentar
							</Button>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
