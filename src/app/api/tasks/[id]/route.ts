import { getUpstreamApiBaseUrl } from "@/lib/api/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseId(id: string) {
	const n = Number(id);
	return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

function upstreamUrl(id: number) {
	return new URL(`/tasks/${id}`, getUpstreamApiBaseUrl());
}

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const parsed = parseId(id);
	if (!parsed) {
		return NextResponse.json(
			{ success: false, error: "Invalid task id" },
			{ status: 400 },
		);
	}

	const res = await fetch(upstreamUrl(parsed), {
		method: "GET",
		cache: "no-store",
		headers: { accept: "application/json" },
	});
	const body = await res.text();
	return new NextResponse(body, {
		status: res.status,
		headers: {
			"content-type": res.headers.get("content-type") ?? "application/json",
		},
	});
}

export async function PUT(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const parsed = parseId(id);
	if (!parsed) {
		return NextResponse.json(
			{ success: false, error: "Invalid task id" },
			{ status: 400 },
		);
	}

	const json = await req.json().catch(() => null);
	if (!json || typeof json !== "object") {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	const res = await fetch(upstreamUrl(parsed), {
		method: "PUT",
		cache: "no-store",
		headers: { accept: "application/json", "content-type": "application/json" },
		body: JSON.stringify(json),
	});
	const body = await res.text();
	return new NextResponse(body, {
		status: res.status,
		headers: {
			"content-type": res.headers.get("content-type") ?? "application/json",
		},
	});
}

export async function DELETE(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const parsed = parseId(id);
	if (!parsed) {
		return NextResponse.json(
			{ success: false, error: "Invalid task id" },
			{ status: 400 },
		);
	}

	const res = await fetch(upstreamUrl(parsed), {
		method: "DELETE",
		cache: "no-store",
		headers: { accept: "application/json" },
	});
	const body = await res.text();
	return new NextResponse(body, {
		status: res.status,
		headers: {
			"content-type": res.headers.get("content-type") ?? "application/json",
		},
	});
}
