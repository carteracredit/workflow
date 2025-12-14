import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { SWRConfig } from "swr";
import { TodoApp } from "@/components/TodoApp";
import type { Task } from "@/lib/api/tasks";

const withSWR: Decorator = (Story, context) => (
	<SWRConfig value={{ revalidateOnMount: false, revalidateOnFocus: false }}>
		{Story(context.args)}
	</SWRConfig>
);

const meta: Meta<typeof TodoApp> = {
	title: "Components/TodoApp",
	component: TodoApp,
	decorators: [withSWR],
};

export default meta;

type Story = StoryObj<typeof TodoApp>;

const sampleTasks: Task[] = [
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
		initialTasks: sampleTasks,
		apiBasePath: "/api",
	},
};
