"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";

export interface PublishModalProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	metadata: WorkflowMetadata;
	flags: Flag[];
	onClose: () => void;
}

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

export function PublishModal({
	nodes,
	edges,
	metadata,
	onClose,
}: PublishModalProps) {
	const [phases, setPhases] = useState<TranspilationPhase[]>([]);
	const [result, setResult] = useState<TranspilationResult | null>(null);
	const [isGenerating, setIsGenerating] = useState(true);

	useEffect(() => {
		const generate = async () => {
			try {
				const transpilationResult = await generateWorkflowCodeWithProgress(
					nodes,
					edges,
					metadata,
					{
						className: metadata.name
							? metadata.name.replace(/[^a-zA-Z0-9]/g, "")
							: "GeneratedWorkflow",
						includeComments: true,
						includeImports: true,
					},
					(updatedPhases) => {
						setPhases(updatedPhases);
					},
				);

				setResult(transpilationResult);
				setIsGenerating(false);

				if (transpilationResult.valid) {
					toast.success("Workflow transpilado exitosamente", {
						description: `Generado en ${transpilationResult.totalDurationMs}ms`,
					});
				} else {
					toast.error("Error al transpilar workflow", {
						description: `${transpilationResult.errors.length} error(es) encontrados`,
					});
				}
			} catch (error) {
				console.error("Error during transpilation:", error);
				toast.error("Error inesperado durante la transpilación", {
					description:
						error instanceof Error ? error.message : "Error desconocido",
				});
				setIsGenerating(false);
			}
		};

		generate();
	}, [nodes, edges, metadata]);

	const handleDownload = () => {
		if (!result || !result.code) return;

		const filename = metadata.name
			? `${metadata.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.ts`
			: "workflow.ts";

		const blob = new Blob([result.code], { type: "text/typescript" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toast.success("Archivo descargado", {
			description: filename,
		});
	};

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Publicar Workflow</DialogTitle>
					<DialogDescription>
						{isGenerating
							? "Transpilando workflow a código TypeScript..."
							: result?.valid
								? "Workflow transpilado exitosamente. Puedes descargar el archivo."
								: "Error al transpilar el workflow."}
					</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					{phases.map((phase) => (
						<PhaseItem key={phase.id} phase={phase} />
					))}
				</div>

				{!isGenerating && result && (
					<div className="flex justify-end gap-3 pt-4 border-t">
						<Button variant="outline" onClick={onClose}>
							Cerrar
						</Button>
						{result.valid && (
							<Button onClick={handleDownload}>
								<Download className="mr-2 h-4 w-4" />
								Descargar .ts
							</Button>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
