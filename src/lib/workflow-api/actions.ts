"use server";

import { redirect } from "next/navigation";
import { getJwt } from "@/lib/auth/getJwt";
import { requireAdminSession } from "@/lib/auth/getServerSession";
import {
	listWorkflows,
	createWorkflow,
	getWorkflow,
	updateWorkflow,
	deleteWorkflow,
} from "./workflows";
import {
	listDeployments,
	createDeployment,
	getDeployment,
	updateDeployment,
} from "./deployments";
import type {
	Workflow,
	CreateWorkflowPayload,
	UpdateWorkflowPayload,
	WorkflowDeployment,
	CreateWorkflowDeploymentPayload,
	UpdateWorkflowDeploymentPayload,
} from "./types";

export type ApiResult<T> = {
	data: T | null;
	error: string | null;
};

function handleAuthError(error: unknown): never {
	if (error instanceof Error) {
		if (
			error.message === "Authentication required" ||
			error.message === "Admin access required"
		) {
			redirect("/forbidden");
		}
	}
	throw error;
}

// ── Workflows ──

export async function getWorkflowsAction(
	search?: string,
): Promise<ApiResult<Workflow[]>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const { workflows } = await listWorkflows({ jwt, search });
		return { data: workflows, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function getWorkflowAction(
	id: string,
): Promise<ApiResult<Workflow>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await getWorkflow(id, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function createWorkflowAction(
	payload: CreateWorkflowPayload,
): Promise<ApiResult<Workflow>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await createWorkflow(payload, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function updateWorkflowAction(
	id: string,
	payload: UpdateWorkflowPayload,
): Promise<ApiResult<Workflow>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await updateWorkflow(id, payload, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function deleteWorkflowAction(
	id: string,
): Promise<ApiResult<{ id: string }>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await deleteWorkflow(id, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

// ── Deployments ──

export async function getDeploymentsAction(
	search?: string,
): Promise<ApiResult<WorkflowDeployment[]>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await listDeployments({ jwt, search });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function getDeploymentAction(
	id: string,
): Promise<ApiResult<WorkflowDeployment>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await getDeployment(id, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function createDeploymentAction(
	payload: CreateWorkflowDeploymentPayload,
): Promise<ApiResult<WorkflowDeployment>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await createDeployment(payload, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}

export async function updateDeploymentAction(
	id: string,
	payload: UpdateWorkflowDeploymentPayload,
): Promise<ApiResult<WorkflowDeployment>> {
	try {
		await requireAdminSession();
		const jwt = await getJwt();
		if (!jwt) {
			return { data: null, error: "Failed to obtain authentication token" };
		}
		const data = await updateDeployment(id, payload, { jwt });
		return { data, error: null };
	} catch (error) {
		handleAuthError(error);
	}
}
