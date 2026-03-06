"use client";

import { useState, useCallback, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
} from "@/lib/workflow/types";
import {
	generateWorkflowCode,
	validateForCodeGeneration,
} from "@/lib/workflow/code-generator";
import { formatGeneratedCode } from "@/lib/workflow/format-code";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Code,
	Download,
	Copy,
	Check,
	AlertTriangle,
	FileCode,
} from "lucide-react";

interface CodeModalProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	metadata?: WorkflowMetadata;
	onClose: () => void;
}

export function CodeModal({ nodes, edges, metadata, onClose }: CodeModalProps) {
	const { resolvedTheme } = useTheme();
	const [copied, setCopied] = useState(false);
	const [formattedCode, setFormattedCode] = useState<string | null>(null);

	// Validate workflow
	const validation = validateForCodeGeneration(nodes, edges);

	// Generate raw code synchronously (for immediate display)
	const { code: rawCode, warnings } = generateWorkflowCode(
		nodes,
		edges,
		metadata,
		{
			className: metadata?.name
				? metadata.name.replace(/[^a-zA-Z0-9]/g, "") + "Workflow"
				: "GeneratedWorkflow",
			includeComments: true,
			includeImports: true,
		},
	);

	// Format code with Prettier asynchronously so the displayed code
	// matches exactly what will be deployed via wrangler.
	useEffect(() => {
		let cancelled = false;
		formatGeneratedCode(rawCode).then((formatted) => {
			if (!cancelled) setFormattedCode(formatted);
		});
		return () => {
			cancelled = true;
		};
	}, [rawCode]);

	// Use formatted code once ready, fall back to raw while loading
	const code = formattedCode ?? rawCode;

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy code:", err);
		}
	}, [code]);

	const handleDownload = useCallback(() => {
		const fileName = metadata?.name
			? `${metadata.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-workflow.ts`
			: "workflow.ts";

		const blob = new Blob([code], { type: "text/typescript" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		a.click();
		URL.revokeObjectURL(url);
	}, [code, metadata?.name]);

	const syntaxTheme = resolvedTheme === "dark" ? oneDark : oneLight;

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="flex h-[90vh] w-[90vw] max-w-5xl flex-col gap-0 p-0">
				<DialogHeader className="flex-shrink-0 border-b px-6 pb-4 pt-6">
					<DialogTitle>
						<span className="flex items-center gap-2">
							<FileCode className="h-5 w-5" />
							Código Cloudflare Workflow
						</span>
					</DialogTitle>
				</DialogHeader>

				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
					{/* Validation errors */}
					{!validation.valid && (
						<div className="flex-shrink-0 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
							<div className="flex items-center gap-2 font-medium text-destructive">
								<AlertTriangle className="h-4 w-4" />
								Errores de validación
							</div>
							<ul className="mt-2 list-inside list-disc space-y-1 text-sm text-destructive/90">
								{validation.errors.map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						</div>
					)}

					{/* Warnings */}
					{warnings.length > 0 && (
						<div className="flex-shrink-0 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
							<div className="flex items-center gap-2 font-medium text-yellow-700 dark:text-yellow-400">
								<AlertTriangle className="h-4 w-4" />
								Advertencias
							</div>
							<ul className="mt-2 list-inside list-disc space-y-1 text-sm text-yellow-700/90 dark:text-yellow-400/90">
								{warnings.map((warning, index) => (
									<li key={index}>{warning}</li>
								))}
							</ul>
						</div>
					)}

					{/* Code display - takes remaining space */}
					<div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
						<div className="absolute inset-0 overflow-auto">
							<SyntaxHighlighter
								language="typescript"
								style={syntaxTheme}
								showLineNumbers
								customStyle={{
									margin: 0,
									borderRadius: "0.5rem",
									fontSize: "0.8125rem",
									lineHeight: "1.5",
									minHeight: "100%",
									background: resolvedTheme === "dark" ? "#282c34" : "#fafafa",
								}}
								lineNumberStyle={{
									minWidth: "3em",
									paddingRight: "1em",
									color: resolvedTheme === "dark" ? "#636d83" : "#9ca3af",
									userSelect: "none",
								}}
								codeTagProps={{
									style: {
										fontFamily:
											'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
									},
								}}
							>
								{code}
							</SyntaxHighlighter>
						</div>
					</div>

					{/* Info box */}
					<div className="flex-shrink-0 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
						<div className="flex items-start gap-2">
							<Code className="mt-0.5 h-4 w-4 flex-shrink-0" />
							<div>
								<p className="font-medium text-foreground">
									Sobre Cloudflare Workflows
								</p>
								<p className="mt-1">
									Este código está diseñado para ejecutarse como un{" "}
									<a
										href="https://developers.cloudflare.com/workflows/"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary underline underline-offset-2 hover:text-primary/80"
									>
										Cloudflare Workflow
									</a>
									. Los workflows permiten construir aplicaciones durables con
									múltiples pasos, reintentos automáticos y persistencia de
									estado.
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Footer actions */}
				<div className="flex-shrink-0 border-t px-6 py-4">
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Cerrar
						</Button>
						<Button variant="outline" onClick={handleCopy}>
							{copied ? (
								<>
									<Check className="mr-2 h-4 w-4" />
									¡Copiado!
								</>
							) : (
								<>
									<Copy className="mr-2 h-4 w-4" />
									Copiar
								</>
							)}
						</Button>
						<Button onClick={handleDownload}>
							<Download className="mr-2 h-4 w-4" />
							Descargar .ts
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
