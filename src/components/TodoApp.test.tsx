import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoApp } from "./TodoApp";
import { SWRConfig } from "swr";
import type { Task } from "@/lib/api/tasks";

describe("TodoApp", () => {
	let tasks: Task[];
	let nextId: number;
	let failGet: boolean;
	let failPost: boolean;
	let failPut: boolean;
	let failDelete: boolean;
	let getSuccessFalse: boolean;
	let throwPostNonError: boolean;
	let throwPutNonError: boolean;
	let throwDeleteNonError: boolean;
	let assertSlugFallback: boolean;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		tasks = [];
		nextId = 1;
		failGet = false;
		failPost = false;
		failPut = false;
		failDelete = false;
		getSuccessFalse = false;
		throwPostNonError = false;
		throwPutNonError = false;
		throwDeleteNonError = false;
		assertSlugFallback = false;

		const jsonResponse = (body: unknown, status = 200) =>
			new Response(JSON.stringify(body), {
				status,
				headers: { "content-type": "application/json" },
			});

		// Minimal fetch mock that behaves like our `/api/tasks` proxy
		fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input.toString();
			const method = (init?.method ?? "GET").toUpperCase();

			if (url.endsWith("/api/tasks") && method === "GET") {
				if (failGet) return jsonResponse({ success: false }, 500);
				if (getSuccessFalse)
					return jsonResponse({ success: false, result: [] }, 200);
				return jsonResponse({ success: true, result: tasks });
			}
			if (url.endsWith("/api/tasks") && method === "POST") {
				if (throwPostNonError) throw "boom";
				if (failPost) return jsonResponse({ success: false }, 500);
				const body = JSON.parse(String(init?.body ?? "{}")) as Omit<Task, "id">;
				if (assertSlugFallback) {
					expect(body.slug.startsWith("task-")).toBe(true);
				}
				const created: Task = { id: nextId++, ...body };
				tasks = [created, ...tasks];
				return jsonResponse({ success: true, result: created }, 201);
			}

			const m = url.match(/\/api\/tasks\/(\d+)$/);
			if (m) {
				const id = Number(m[1]);
				if (method === "PUT") {
					if (throwPutNonError) throw "boom";
					if (failPut) return jsonResponse({ success: false }, 500);
					const body = JSON.parse(String(init?.body ?? "{}")) as Omit<
						Task,
						"id"
					>;
					const updated: Task = { id, ...body };
					tasks = tasks.map((t) => (t.id === id ? updated : t));
					return jsonResponse({ success: true, result: updated });
				}
				if (method === "DELETE") {
					if (throwDeleteNonError) throw "boom";
					if (failDelete) return jsonResponse({ success: false }, 500);
					const found = tasks.find((t) => t.id === id);
					tasks = tasks.filter((t) => t.id !== id);
					return jsonResponse({ success: true, result: found ?? null });
				}
			}

			return jsonResponse({ success: false, error: "not mocked" }, 500);
		});

		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		cleanup();
	});

	function renderApp(opts?: { initialTasks?: Task[] }) {
		render(
			<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
				<TodoApp initialTasks={opts?.initialTasks ?? []} />
			</SWRConfig>,
		);
	}

	it("adds a todo", async () => {
		const user = userEvent.setup();
		renderApp();

		await user.type(screen.getByLabelText("New task"), "Buy milk");
		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(await screen.findByText("Buy milk")).toBeInTheDocument();
	});

	it("does not add empty/whitespace-only todos", async () => {
		const user = userEvent.setup();
		renderApp();

		await user.type(screen.getByLabelText("New task"), "   ");
		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
	});

	it("renders the add form with mobile-friendly layout", () => {
		renderApp();

		const form = screen.getByLabelText("New task").closest("form");
		expect(form).not.toBeNull();
		const formElement = form as HTMLFormElement;
		expect(formElement).toHaveClass("flex-col");

		const addButton = screen.getByRole("button", { name: "Add" });
		expect(addButton).toHaveClass("w-full");
		expect(addButton).toHaveClass("sm:w-auto");
	});

	it("toggles a todo completed", async () => {
		const user = userEvent.setup();
		renderApp();

		await user.type(screen.getByLabelText("New task"), "Write tests");
		await user.click(screen.getByRole("button", { name: "Add" }));

		const checkbox = screen.getByRole("checkbox", {
			name: 'Mark "Write tests" as completed',
		});
		expect(checkbox).not.toBeChecked();

		await user.click(checkbox);
		expect(checkbox).toBeChecked();
	});

	it("clears completed todos", async () => {
		const user = userEvent.setup();
		renderApp();

		await user.type(screen.getByLabelText("New task"), "A");
		await user.click(screen.getByRole("button", { name: "Add" }));
		await user.type(screen.getByLabelText("New task"), "B");
		await user.click(screen.getByRole("button", { name: "Add" }));

		await user.click(
			screen.getByRole("checkbox", { name: 'Mark "A" as completed' }),
		);

		await user.click(screen.getByRole("button", { name: "Clear completed" }));

		expect(await screen.findByText("B")).toBeInTheDocument();
		expect(screen.queryByText("A")).not.toBeInTheDocument();
	});

	it("deletes a todo", async () => {
		const user = userEvent.setup();
		renderApp();

		await user.type(screen.getByLabelText("New task"), "Throw trash");
		await user.click(screen.getByRole("button", { name: "Add" }));

		await user.click(
			screen.getByRole("button", { name: 'Delete "Throw trash"' }),
		);
		expect(screen.queryByText("Throw trash")).not.toBeInTheDocument();
	});

	it("sets an error when the initial tasks fetch fails", async () => {
		failGet = true;
		renderApp();
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
	});

	it("handles success=false envelopes from the API", async () => {
		getSuccessFalse = true;
		renderApp();
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
	});

	it('uses "task-" as slug prefix when name cannot be slugified', async () => {
		const user = userEvent.setup();
		assertSlugFallback = true;
		renderApp();

		await user.type(screen.getByLabelText("New task"), "!!!");
		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(await screen.findByText("!!!")).toBeInTheDocument();
	});

	it("shows an error when creating a task fails", async () => {
		const user = userEvent.setup();
		failPost = true;
		renderApp();

		await user.type(screen.getByLabelText("New task"), "Will fail");
		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Request failed: 500",
		);
	});

	it("shows a fallback error message when create throws a non-Error value", async () => {
		const user = userEvent.setup();
		throwPostNonError = true;
		renderApp();

		await user.type(screen.getByLabelText("New task"), "Will throw");
		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Failed to add task",
		);
	});

	it("shows an error when updating a task fails", async () => {
		const user = userEvent.setup();
		tasks = [
			{
				id: 1,
				name: "Existing",
				slug: "existing-1",
				description: "",
				completed: false,
				due_date: new Date().toISOString(),
			},
		];
		failPut = true;
		renderApp({ initialTasks: tasks });

		await user.click(
			screen.getByRole("checkbox", { name: 'Mark "Existing" as completed' }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Request failed: 500",
		);
	});

	it("shows a fallback error message when update throws a non-Error value", async () => {
		const user = userEvent.setup();
		tasks = [
			{
				id: 1,
				name: "Existing",
				slug: "existing-1",
				description: "",
				completed: false,
				due_date: new Date().toISOString(),
			},
		];
		throwPutNonError = true;
		renderApp({ initialTasks: tasks });

		await user.click(
			screen.getByRole("checkbox", { name: 'Mark "Existing" as completed' }),
		);

		expect(await screen.findByRole("alert")).toHaveTextContent("Update failed");
	});

	it("shows an error when deleting a task fails", async () => {
		const user = userEvent.setup();
		tasks = [
			{
				id: 1,
				name: "Existing",
				slug: "existing-1",
				description: "",
				completed: false,
				due_date: new Date().toISOString(),
			},
		];
		failDelete = true;
		renderApp({ initialTasks: tasks });

		await user.click(screen.getByRole("button", { name: 'Delete "Existing"' }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Request failed: 500",
		);
	});

	it("shows a fallback error message when delete throws a non-Error value", async () => {
		const user = userEvent.setup();
		tasks = [
			{
				id: 1,
				name: "Existing",
				slug: "existing-1",
				description: "",
				completed: false,
				due_date: new Date().toISOString(),
			},
		];
		throwDeleteNonError = true;
		renderApp({ initialTasks: tasks });

		await user.click(screen.getByRole("button", { name: 'Delete "Existing"' }));

		expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed");
	});

	it("shows an error when clearing completed tasks fails", async () => {
		const user = userEvent.setup();
		tasks = [
			{
				id: 1,
				name: "Done",
				slug: "done-1",
				description: "",
				completed: true,
				due_date: new Date().toISOString(),
			},
		];
		failDelete = true;
		renderApp({ initialTasks: tasks });

		await user.click(screen.getByRole("button", { name: "Clear completed" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Request failed: 500",
		);
	});

	it("shows a fallback error message when clear completed throws a non-Error value", async () => {
		const user = userEvent.setup();
		tasks = [
			{
				id: 1,
				name: "Done",
				slug: "done-1",
				description: "",
				completed: true,
				due_date: new Date().toISOString(),
			},
		];
		throwDeleteNonError = true;
		renderApp({ initialTasks: tasks });

		await user.click(screen.getByRole("button", { name: "Clear completed" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Failed to clear completed",
		);
	});
});
