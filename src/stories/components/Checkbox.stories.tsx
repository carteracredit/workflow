import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

const meta: Meta<typeof Checkbox> = {
	title: "UI/Checkbox",
	component: Checkbox,
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = {
	args: {
		checked: false,
	},
};

export const Checked: Story = {
	args: {
		checked: true,
	},
};

export const Controlled: Story = {
	render: () => {
		const [checked, setChecked] = useState(false);
		return (
			<label className="flex items-center gap-2 text-sm">
				<Checkbox
					checked={checked}
					onCheckedChange={() => setChecked((v) => !v)}
				/>
				<span>{checked ? "Checked" : "Unchecked"}</span>
			</label>
		);
	},
};
