import type { Meta, StoryObj } from "@storybook/nextjs";
import { Palette } from "@/components/workflow/palette";

const meta: Meta<typeof Palette> = {
	title: "Components/Workflow/Palette",
	component: Palette,
	parameters: {
		layout: "padded",
	},
	args: {
		onAddNode: () => {},
		zoom: 1,
		pan: { x: 0, y: 0 },
	},
	decorators: [
		(Story) => (
			<div style={{ height: "600px", display: "flex" }}>
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof Palette>;

export const Default: Story = {};
