import { TodoApp } from "@/components/TodoApp";
import type { Task } from "@/lib/api/tasks";

export function HomeView({ initialTasks }: { initialTasks: Task[] }) {
	return (
		<div className="min-h-screen px-4 py-8 font-(family-name:--font-geist-sans) sm:px-6 sm:py-12">
			<main className="mx-auto w-full max-w-2xl">
				<header className="mb-8">
					<h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						A tiny Tasks example: add tasks, mark them complete, and remove
						them. Data is synced with the backend API.
					</p>
				</header>

				<TodoApp initialTasks={initialTasks} />
			</main>
		</div>
	);
}
