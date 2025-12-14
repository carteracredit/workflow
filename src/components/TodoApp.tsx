"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ApiEnvelope, Task, TaskUpsertInput } from "@/lib/api/tasks";
import { slugify } from "@/lib/slugify";

async function jsonFetcher<T>(url: string): Promise<T> {
	const res = await fetch(url, { headers: { accept: "application/json" } });
	const body = (await res.json().catch(() => null)) as unknown;
	if (!res.ok) {
		throw new Error(`Request failed: ${res.status}`);
	}
	return body as T;
}

async function apiJson<T>(url: string, init: RequestInit) {
	const res = await fetch(url, {
		...init,
		headers: {
			accept: "application/json",
			...(init.headers ?? {}),
		},
	});
	const body = (await res.json().catch(() => null)) as unknown;
	if (!res.ok) throw new Error(`Request failed: ${res.status}`);
	return body as T;
}

export function TodoApp({
	initialTasks,
	apiBasePath = "/api",
}: {
	initialTasks?: Task[];
	apiBasePath?: string;
}) {
	const [text, setText] = useState("");
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const tasksUrl = `${apiBasePath}/tasks`;

	const { data: tasks = [], mutate } = useSWR<Task[]>(
		tasksUrl,
		async (url) => {
			const env = await jsonFetcher<ApiEnvelope<Task[]>>(url);
			if (!env?.success) throw new Error("API returned success=false");
			return env.result;
		},
		{
			fallbackData: initialTasks ?? [],
			revalidateOnFocus: false,
		},
	);

	const remaining = useMemo(
		() => tasks.filter((t) => !t.completed).length,
		[tasks],
	);

	function buildUpsertInput(name: string, completed: boolean): TaskUpsertInput {
		const base = slugify(name);
		const suffix = Math.random().toString(16).slice(2, 8);
		const dueDate = new Date(
			Date.now() + 7 * 24 * 60 * 60 * 1000,
		).toISOString();

		return {
			name,
			slug: `${base || "task"}-${suffix}`,
			description: "",
			completed,
			due_date: dueDate,
		};
	}

	async function addTask() {
		const trimmed = text.trim();
		if (!trimmed) return;
		setErrorMsg(null);

		try {
			await apiJson<ApiEnvelope<Task>>(tasksUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(buildUpsertInput(trimmed, false)),
			});
			setText("");
			await mutate();
		} catch (e) {
			setErrorMsg(e instanceof Error ? e.message : "Failed to add task");
		}
	}

	async function toggleTask(task: Task) {
		setErrorMsg(null);
		const optimistic = tasks.map((t) =>
			t.id === task.id ? { ...t, completed: !t.completed } : t,
		);

		await mutate(
			async () => {
				const input: TaskUpsertInput = {
					name: task.name,
					slug: task.slug,
					description: task.description,
					completed: !task.completed,
					due_date: task.due_date,
				};

				await apiJson<ApiEnvelope<Task>>(`${tasksUrl}/${task.id}`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(input),
				});

				// Revalidate to ensure we match backend state
				return optimistic;
			},
			{ optimisticData: optimistic, rollbackOnError: true, revalidate: true },
		).catch((e) =>
			setErrorMsg(e instanceof Error ? e.message : "Update failed"),
		);
	}

	async function removeTask(id: number) {
		setErrorMsg(null);
		const optimistic = tasks.filter((t) => t.id !== id);

		await mutate(
			async () => {
				await apiJson<ApiEnvelope<Task>>(`${tasksUrl}/${id}`, {
					method: "DELETE",
				});
				return optimistic;
			},
			{ optimisticData: optimistic, rollbackOnError: true, revalidate: true },
		).catch((e) =>
			setErrorMsg(e instanceof Error ? e.message : "Delete failed"),
		);
	}

	async function clearCompleted() {
		setErrorMsg(null);
		const completed = tasks.filter((t) => t.completed);

		try {
			await Promise.all(
				completed.map((t) =>
					apiJson(`${tasksUrl}/${t.id}`, { method: "DELETE" }),
				),
			);
			await mutate();
		} catch (e) {
			setErrorMsg(e instanceof Error ? e.message : "Failed to clear completed");
		}
	}

	return (
		<Card aria-label="Todo list" className="shadow-sm">
			<CardHeader className="gap-4">
				<form
					className="flex flex-col gap-2 sm:flex-row sm:items-center"
					onSubmit={(e) => {
						e.preventDefault();
						void addTask();
					}}
				>
					<label className="sr-only" htmlFor="new-task">
						New task
					</label>
					<Input
						id="new-task"
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Add a task…"
						className="w-full"
					/>
					<Button type="submit" className="w-full sm:w-auto sm:flex-shrink-0">
						Add
					</Button>
				</form>

				{errorMsg ? (
					<div className="text-sm text-destructive" role="alert">
						{errorMsg}
					</div>
				) : null}

				<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
					<span>
						{tasks.length === 0
							? "No tasks yet."
							: `${remaining} remaining • ${tasks.length} total`}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={clearCompleted}
						disabled={!tasks.some((t) => t.completed)}
					>
						Clear completed
					</Button>
				</div>
			</CardHeader>

			<CardContent className="px-0">
				<ul className="divide-y">
					{tasks.map((t) => (
						<li key={t.id} className="flex items-center gap-3 px-6 py-3">
							<Checkbox
								aria-label={`Mark "${t.name}" as completed`}
								checked={t.completed}
								onCheckedChange={() => void toggleTask(t)}
							/>
							<span
								className={`flex-1 text-sm ${
									t.completed ? "text-muted-foreground line-through" : ""
								}`}
							>
								{t.name}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => void removeTask(t.id)}
								aria-label={`Delete "${t.name}"`}
							>
								Delete
							</Button>
						</li>
					))}
					{tasks.length === 0 ? (
						<li className="px-6 py-4 text-sm text-muted-foreground">
							Add your first task above.
						</li>
					) : null}
				</ul>
			</CardContent>
		</Card>
	);
}
