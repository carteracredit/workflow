import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Slider } from "@/components/ui/slider";

const meta = {
	title: "UI/Slider",
	component: Slider,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SingleValue: Story = {
	render: () => {
		const [value, setValue] = useState([45]);

		return (
			<div className="w-72 space-y-2">
				<div className="text-sm text-muted-foreground">
					Zoom actual: <span className="font-semibold">{value[0]}%</span>
				</div>
				<Slider
					min={10}
					max={150}
					step={5}
					value={value}
					onValueChange={setValue}
				/>
			</div>
		);
	},
};

export const RangeSelection: Story = {
	render: () => {
		const [range, setRange] = useState([30, 70]);

		return (
			<div className="w-80 space-y-2">
				<div className="text-sm text-muted-foreground">
					Rango de tolerancia:{" "}
					<span className="font-semibold">
						{range[0]}% - {range[1]}%
					</span>
				</div>
				<Slider
					min={0}
					max={100}
					step={1}
					value={range}
					onValueChange={setRange}
				/>
			</div>
		);
	},
};
