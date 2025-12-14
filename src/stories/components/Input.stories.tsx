import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "@/components/ui/input";

const meta: Meta<typeof Input> = {
	title: "UI/Input",
	component: Input,
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Text: Story = {
	args: {
		placeholder: "Type something…",
	},
};

export const WithValue: Story = {
	args: {
		defaultValue: "Hello",
	},
};
