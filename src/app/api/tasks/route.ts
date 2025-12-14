import { getUpstreamApiBaseUrl } from "@/lib/api/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function upstreamUrlFromRequest(req: Request) {
	const upstream = new URL("/tasks", getUpstreamApiBaseUrl());
	const incoming = new URL(req.url);
	upstream.search = incoming.search;
	return upstream;
}

export async function GET(req: Request) {
	const upstream = upstreamUrlFromRequest(req);
	const res = await fetch(upstream, {
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

export async function POST(req: Request) {
	const upstream = upstreamUrlFromRequest(req);
	const json = await req.json().catch(() => null);
	if (!json || typeof json !== "object") {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON body" },
			{ status: 400 },
		);
	}

	const res = await fetch(upstream, {
		method: "POST",
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
