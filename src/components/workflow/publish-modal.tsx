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
import { publishWorkflow } from "@/lib/workflow-api/workflows";
import type { PublishWorkflowResponse } from "@/lib/workflow-api/types";
import { ApiError } from "@/lib/workflow-api/http";
import { toast } from "sonner";

export interface PublishModalProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	metadata: WorkflowMetadata;
	flags: Flag[];
	/** API id of the saved workflow in workflow-svc (null = not yet saved) */
	workflowApiId: number | null;
	/** Callback to save the workflow first if workflowApiId is null */
	onSave: () => Promise<void>;
	/** JWT token for authenticated API calls */
	apiToken: string | null;
	onClose: () => void;
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
	workflowApiId,
	onSave,
	apiToken,
	onClose,
}: PublishModalProps) {
	const [phases, setPhases] = useState<TranspilationPhase[]>([]);
	const [transpileResult, setTranspileResult] =
		useState<TranspilationResult | null>(null);
	const [deployStatus, setDeployStatus] = useState<DeployPhaseStatus>("idle");
	const [deployResult, setDeployResult] =
		useState<PublishWorkflowResponse | null>(null);
	const [deployError, setDeployError] = useState<string | undefined>();
	const [isRunning, setIsRunning] = useState(true);

	const run = useCallback(async () => {
		setIsRunning(true);

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

			generatedCode = result.code;
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
			if (saved) {
				const parsed = Number.parseInt(saved, 10);
				if (!Number.isNaN(parsed)) currentWorkflowId = parsed;
			}
		}

		if (!currentWorkflowId) {
			toast.error("No se pudo obtener el ID del workflow guardado");
			setIsRunning(false);
			return;
		}

		setDeployStatus("running");
		try {
			const result = await publishWorkflow(
				currentWorkflowId,
				{ code: generatedCode, environment: "development" },
				{ jwt: apiToken },
			);
			setDeployResult(result);
			setDeployStatus("done");
			toast.success("Workflow publicado", {
				description: `Deployment iniciado. GitHub Actions desplegará a Cloudflare automáticamente.`,
			});
		} catch (err) {
			const msg =
				err instanceof ApiError
					? `Error ${err.status}: ${err.message}`
					: err instanceof Error
						? err.message
						: "Error desconocido";
			setDeployError(msg);
			setDeployStatus("error");
			toast.error("Error al publicar", { description: msg });
		}

		setIsRunning(false);
	}, [nodes, edges, metadata, workflowApiId, onSave, apiToken]);

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

				{/* Deployment result */}
				{deployStatus === "done" && deployResult && (
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
