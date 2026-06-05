"use client";

import { useState, useRef } from "react";
import type { WorkflowNode, WorkflowEdge, Flag } from "@/lib/workflow/types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, FileUp } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export interface WorkflowExportData {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	flags: Flag[];
	zoom?: number;
	pan?: { x: number; y: number };
	metadata?: { nameEs?: string; descriptionEs?: string };
}

interface JSONModalProps {
	mode: "export" | "import";
	workflow: WorkflowExportData;
	onClose: () => void;
	onImport: (data: Record<string, unknown>) => void;
}

function buildCanonicalExport(workflow: WorkflowExportData): object {
	return {
		metadata: {
			version: "2.0",
			kind: "workflow",
			exportedAt: new Date().toISOString(),
		},
		definition: {
			nodes: workflow.nodes,
			edges: workflow.edges,
			flags: workflow.flags,
			zoom: workflow.zoom ?? 1,
			pan: workflow.pan ?? { x: 0, y: 0 },
			...(workflow.metadata?.nameEs || workflow.metadata?.descriptionEs
				? { metadata: workflow.metadata }
				: {}),
		},
	};
}

/**
 * Normalizes imported JSON to a flat definition object that
 * `parseDefinitionJson` can consume. Handles both v2.0 canonical
 * format (with `metadata.kind` + `definition` wrapper) and v1.0
 * legacy format (flat `nodes`/`edges`/`flags`).
 */
function normalizeImportedJson(
	data: Record<string, unknown>,
	t: (key: string) => string,
): Record<string, unknown> {
	if (data.metadata && typeof data.metadata === "object") {
		const meta = data.metadata as Record<string, unknown>;
		if (meta.kind && meta.kind !== "workflow") {
			throw new Error(t("jsonModal.errorInvalidKind"));
		}
		if (
			meta.version === "2.0" &&
			data.definition &&
			typeof data.definition === "object"
		) {
			return data.definition as Record<string, unknown>;
		}
	}

	if (!data.nodes || !Array.isArray(data.nodes)) {
		throw new Error(t("jsonModal.errorInvalidNodes"));
	}
	if (!data.edges || !Array.isArray(data.edges)) {
		throw new Error(t("jsonModal.errorInvalidEdges"));
	}

	return data;
}

export function JSONModal({
	mode,
	workflow,
	onClose,
	onImport,
}: JSONModalProps) {
	const [jsonText, setJsonText] = useState(
		mode === "export"
			? JSON.stringify(buildCanonicalExport(workflow), null, 2)
			: "",
	);
	const [error, setError] = useState<string | null>(null);
	const { t } = useLanguage();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleImport = () => {
		try {
			const raw = JSON.parse(jsonText);
			const normalized = normalizeImportedJson(raw, t);
			onImport(normalized);
			setError(null);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t("jsonModal.errorParseJson"),
			);
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

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const text = ev.target?.result;
			if (typeof text === "string") {
				setJsonText(text);
				setError(null);
			}
		};
		reader.readAsText(file);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 w-[90vw]">
				<DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
					<DialogTitle>
						{mode === "export" ? (
							<span className="flex items-center gap-2">
								<Download className="h-5 w-5" />
								{t("jsonModal.exportTitle")}
							</span>
						) : (
							<span className="flex items-center gap-2">
								<Upload className="h-5 w-5" />
								{t("jsonModal.importTitle")}
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
									mode === "import" ? t("jsonModal.importPlaceholder") : ""
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
						{mode === "import" && (
							<>
								<input
									ref={fileInputRef}
									type="file"
									accept=".json"
									className="hidden"
									onChange={handleFileUpload}
								/>
								<Button
									variant="outline"
									onClick={() => fileInputRef.current?.click()}
								>
									<FileUp className="mr-2 h-4 w-4" />
									{t("jsonModal.uploadFile")}
								</Button>
							</>
						)}
						<Button variant="outline" onClick={onClose}>
							{t("jsonModal.cancel")}
						</Button>
						{mode === "export" ? (
							<Button onClick={handleDownload}>
								<Download className="mr-2 h-4 w-4" />
								{t("jsonModal.download")}
							</Button>
						) : (
							<Button onClick={handleImport}>
								<Upload className="mr-2 h-4 w-4" />
								{t("jsonModal.import")}
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
