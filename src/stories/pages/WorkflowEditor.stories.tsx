import type { Meta, StoryObj } from "@storybook/nextjs";
import { WorkflowEditor } from "@/components/WorkflowEditor";

const meta: Meta<typeof WorkflowEditor> = {
	title: "Pages/WorkflowEditor",
	component: WorkflowEditor,
	parameters: {
		layout: "fullscreen",
		chromatic: {
			delay: 2000,
		},
	},
};

export default meta;
type Story = StoryObj<typeof WorkflowEditor>;

export const Default: Story = {};
