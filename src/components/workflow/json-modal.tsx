"use client";

import { useState } from "react";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload } from "lucide-react";

interface JSONModalProps {
	mode: "export" | "import";
	workflow: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
	onClose: () => void;
	onImport: (data: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
}

export function JSONModal({
	mode,
	workflow,
	onClose,
	onImport,
}: JSONModalProps) {
	const [jsonText, setJsonText] = useState(
		mode === "export"
			? JSON.stringify(
					{
						metadata: { version: "1.0", createdAt: new Date().toISOString() },
						...workflow,
					},
					null,
					2,
				)
			: "",
	);
	const [error, setError] = useState<string | null>(null);

	const handleImport = () => {
		try {
			const data = JSON.parse(jsonText);

			if (!data.nodes || !Array.isArray(data.nodes)) {
				throw new Error('Formato inválido: falta el array "nodes"');
			}

			if (!data.edges || !Array.isArray(data.edges)) {
				throw new Error('Formato inválido: falta el array "edges"');
			}

			onImport({ nodes: data.nodes, edges: data.edges });
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Error al parsear JSON");
		}
	};

	const handleDownload = () => {
		const blob = new Blob([jsonText], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `workflow-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 w-[90vw]">
				<DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
					<DialogTitle>
						{mode === "export" ? (
							<span className="flex items-center gap-2">
								<Download className="h-5 w-5" />
								Exportar JSON
							</span>
						) : (
							<span className="flex items-center gap-2">
								<Upload className="h-5 w-5" />
								Importar JSON
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4">
					<div className="flex-1 min-h-0 flex flex-col">
						<div className="flex-1 min-h-0 overflow-auto rounded-md border border-border">
							<Textarea
								value={jsonText}
								onChange={(e) => setJsonText(e.target.value)}
								className="font-mono text-xs h-full min-h-[200px] resize-none border-0 focus-visible:ring-0"
								readOnly={mode === "export"}
								placeholder={
									mode === "import" ? "Pega el JSON del flujo aquí..." : ""
								}
							/>
						</div>
					</div>

					{error && (
						<div className="rounded bg-destructive/10 p-3 text-sm text-destructive flex-shrink-0">
							{error}
						</div>
					)}

					<div className="flex justify-end gap-2 flex-shrink-0">
						<Button variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						{mode === "export" ? (
							<Button onClick={handleDownload}>
								<Download className="mr-2 h-4 w-4" />
								Descargar
							</Button>
						) : (
							<Button onClick={handleImport}>
								<Upload className="mr-2 h-4 w-4" />
								Importar
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
