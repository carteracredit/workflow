"use client";

import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, XCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface PreviewModalProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	onClose: () => void;
}

export function PreviewModal({ nodes, edges, onClose }: PreviewModalProps) {
	const startNode = nodes.find((n) => n.type === "Start");
	const { t } = useLanguage();

	const simulateFlow = () => {
		const logs: string[] = [];

		if (!startNode) {
			logs.push(`❌ ${t("previewModal.logNoStartNode")}`);
			return logs;
		}

		logs.push(
			`✅ ${t("previewModal.logStartingFrom").replace("{title}", startNode.title)}`,
		);

		let currentNodeId = startNode.id;
		const visited = new Set<string>();
		let steps = 0;
		const maxSteps = 20;

		while (steps < maxSteps) {
			if (visited.has(currentNodeId)) {
				logs.push(`⚠️ ${t("previewModal.logCycleDetected")}`);
				break;
			}

			visited.add(currentNodeId);
			const currentNode = nodes.find((n) => n.id === currentNodeId);

			if (!currentNode) break;

			logs.push(
				`📍 ${t("previewModal.logProcessing").replace("{title}", currentNode.title).replace("{type}", currentNode.type)}`,
			);

			if (currentNode.type === "End") {
				logs.push(`✅ ${t("previewModal.logFlowEndedFin")}`);
				break;
			}

			if (currentNode.type === "Reject") {
				logs.push(`❌ ${t("previewModal.logFlowEndedRejected")}`);
				break;
			}

			const nextEdge = edges.find((e) => e.from === currentNodeId);
			if (!nextEdge) {
				logs.push(`⚠️ ${t("previewModal.logNoNextNode")}`);
				break;
			}

			currentNodeId = nextEdge.to;
			steps++;
		}

		if (steps >= maxSteps) {
			logs.push(`⚠️ ${t("previewModal.logMaxStepsReached")}`);
		}

		return logs;
	};

	const logs = simulateFlow();

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{t("previewModal.title")}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex items-center gap-2 rounded-lg bg-muted p-3">
						<Play className="h-5 w-5 text-primary" />
						<span className="font-medium">
							{t("previewModal.simulationTitle")}
						</span>
					</div>

					<ScrollArea className="h-96 rounded border border-border bg-card p-4">
						<div className="space-y-2 font-mono text-sm">
							{logs.map((log, index) => (
								<div key={index} className="flex items-start gap-2">
									{log.startsWith("✅") && (
										<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
									)}
									{log.startsWith("❌") && (
										<XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
									)}
									{log.startsWith("⚠️") && (
										<span className="mt-0.5 h-4 w-4 shrink-0">⚠️</span>
									)}
									{log.startsWith("📍") && (
										<span className="mt-0.5 h-4 w-4 shrink-0">📍</span>
									)}
									<span className="flex-1">{log}</span>
								</div>
							))}
						</div>
					</ScrollArea>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							{t("previewModal.close")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
