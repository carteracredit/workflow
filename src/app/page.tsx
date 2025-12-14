import { listTasks } from "@/lib/api/tasks";
import { HomeView } from "@/views/HomeView";

export default async function Home() {
	const initialTasks = await listTasks({ page: 1, per_page: 20 })
		.then((r) => r.result)
		.catch(() => []);

	return <HomeView initialTasks={initialTasks} />;
}
