"use client";

import useSWR from "swr";
import { fetchJson } from "@/lib/workflow-api/http";
import { getWorkflowServiceUrl } from "@/lib/workflow-api/config";
import type { WorkflowFlag, ApiResponse } from "@/lib/workflow-api/types";
import { getColorValue } from "@/lib/flag-manager";
import { cn } from "@/lib/utils";
import { RefreshCw, Activity } from "lucide-react";

interface FlagStatePanelProps {
	workflowId: string;
	apiToken: string;
	className?: string;
}

async function fetchFlags(url: string, jwt: string): Promise<WorkflowFlag[]> {
	const { json } = await fetchJson<ApiResponse<WorkflowFlag[]>>(url, { jwt });
	return json.result;
}

/**
 * FlagStatePanel
 *
 * Shows the current runtime state of all flags for a workflow.
 * Polls every 10 seconds to stay up to date with worker-triggered updates.
 * Only renders when the workflow has been published (has a workflowId) and has flags.
 */
export function FlagStatePanel({
	workflowId,
	apiToken,
	className,
}: FlagStatePanelProps) {
	const url = `${getWorkflowServiceUrl()}/workflows/${workflowId}/flags`;

	const { data: flags, isLoading } = useSWR<WorkflowFlag[]>(
		[url, apiToken],
		([u, jwt]: [string, string]) => fetchFlags(u, jwt),
		{ refreshInterval: 10_000 },
	);

	if (isLoading || !flags || flags.length === 0) return null;

	return (
		<div
			className={cn(
				"rounded-lg border bg-card p-3 flex flex-col gap-2",
				className,
			)}
		>
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
				<Activity className="h-3 w-3" />
				<span>Estado de Flags</span>
				<RefreshCw className="h-3 w-3 ml-auto opacity-50" />
			</div>

			<div className="flex flex-col gap-1.5">
				{flags.map((flag) => {
					const activeOption = flag.currentState
						? flag.options.find((opt) => opt.id === flag.currentState!.optionId)
						: flag.options[0];

					return (
						<div
							key={flag.id}
							className="flex items-center justify-between gap-2"
						>
							<span className="text-xs text-muted-foreground truncate max-w-[45%]">
								{flag.name}
							</span>
							{activeOption ? (
								<span
									className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white truncate max-w-[50%]"
									style={{ backgroundColor: getColorValue(activeOption.color) }}
								>
									{activeOption.label}
								</span>
							) : (
								<span className="text-xs text-muted-foreground">—</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
