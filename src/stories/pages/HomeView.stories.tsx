import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { SWRConfig } from "swr";
import type { Task } from "@/lib/api/tasks";
import { HomeView } from "@/views/HomeView";

const withSWR: Decorator = (Story, context) => (
	<SWRConfig value={{ revalidateOnMount: false, revalidateOnFocus: false }}>
		{Story(context.args)}
	</SWRConfig>
);

const meta: Meta<typeof HomeView> = {
	title: "Pages/HomeView",
	component: HomeView,
	decorators: [withSWR],
};

export default meta;

type Story = StoryObj<typeof HomeView>;

const initialTasks: Task[] = [
	{
		id: 1,
		name: "Buy coffee",
		slug: "buy-coffee-aaaaaa",
		description: "",
		completed: false,
		due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
	},
	{
		id: 2,
		name: "Write docs",
		slug: "write-docs-bbbbbb",
		description: "",
		completed: true,
		due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	},
];

export const Default: Story = {
	args: {
		initialTasks,
	},
};
