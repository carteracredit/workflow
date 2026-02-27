"use client";

import { use } from "react";
import { WorkflowEditor } from "@/components/WorkflowEditor";

interface EditorPageProps {
	params: Promise<{ id: string }>;
}

export default function EditorPage({ params }: EditorPageProps) {
	const { id } = use(params);
	const workflowId = parseInt(id, 10);

	if (isNaN(workflowId)) {
		return (
			<div className="flex items-center justify-center h-screen text-muted-foreground">
				ID de workflow inválido
			</div>
		);
	}

	return <WorkflowEditor workflowId={workflowId} />;
}
