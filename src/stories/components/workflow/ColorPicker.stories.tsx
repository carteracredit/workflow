import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { ColorPicker } from "@/components/workflow/color-picker";
import type { TailwindColor500 } from "@/lib/flag-manager";

const meta = {
	title: "Components/Workflow/ColorPicker",
	component: ColorPicker,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof ColorPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		color: "blue-500",
		onColorChange: () => {},
	},
	render: (args) => {
		const [color, setColor] = useState<TailwindColor500>(args.color);

		return (
			<div className="flex items-center gap-4 rounded-lg border bg-card px-6 py-4">
				<div className="space-y-1 text-sm">
					<p className="font-medium">Color del flag</p>
					<p className="text-xs text-muted-foreground">
						Selecciona un color consistente para los badges del workflow.
					</p>
					<div className="text-xs">
						Color actual: <span className="font-semibold">{color}</span>
					</div>
				</div>
				<ColorPicker
					{...args}
					color={color}
					onColorChange={(value) => {
						setColor(value);
						args.onColorChange(value);
					}}
				/>
			</div>
		);
	},
};
