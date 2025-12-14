"use client";

import type { ValidationError } from "@/lib/workflow/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, X } from "lucide-react";

interface ValidationTrayProps {
	errors: ValidationError[];
	onClose: () => void;
	onSelectNode: (nodeId: string) => void;
}

export function ValidationTray({
	errors,
	onClose,
	onSelectNode,
}: ValidationTrayProps) {
	const errorCount = errors.filter(
		(error) => error.severity === "error",
	).length;
	const warningCount = errors.length - errorCount;
	const severityCopy = {
		error: "Error",
		warning: "Advertencia",
	} as const;

	return (
		<div
			className="absolute bottom-0 left-0 right-80 border-t border-border bg-card"
			aria-live="polite"
		>
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
				<div className="flex items-center gap-2">
					<AlertCircle className="h-4 w-4 text-destructive" />
					<span className="text-sm font-medium">
						{errors.length} {errors.length === 1 ? "hallazgo" : "hallazgos"} de
						validación
					</span>
					<div className="flex gap-2 text-[11px] uppercase tracking-wide">
						{errorCount > 0 && (
							<span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
								{errorCount} errores
							</span>
						)}
						{warningCount > 0 && (
							<span className="rounded-full bg-amber-200/40 px-2 py-0.5 text-amber-700 dark:text-amber-300">
								{warningCount} avisos
							</span>
						)}
					</div>
				</div>
				<Button variant="ghost" size="icon" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			<ScrollArea className="h-32">
				<div className="space-y-1 p-2">
					{errors.map((error, index) => (
						<div
							key={index}
							className="flex cursor-pointer items-start gap-3 rounded border border-transparent p-2 text-sm hover:border-border hover:bg-accent/40"
							onClick={() => error.nodeId && onSelectNode(error.nodeId)}
						>
							<AlertCircle
								className={`mt-0.5 h-4 w-4 shrink-0 ${
									error.severity === "error"
										? "text-destructive"
										: "text-amber-500"
								}`}
							/>
							<div className="flex-1">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span
										className={`rounded-full px-2 py-0.5 ${
											error.severity === "error"
												? "bg-destructive/10 text-destructive"
												: "bg-amber-200/40 text-amber-700 dark:text-amber-300"
										}`}
									>
										{severityCopy[error.severity]}
									</span>
									{error.nodeId && <span>Nodo #{error.nodeId.slice(-4)}</span>}
								</div>
								<p className="mt-1 text-sm text-foreground">{error.message}</p>
							</div>
						</div>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
