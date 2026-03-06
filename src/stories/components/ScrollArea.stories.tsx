import type { Meta, StoryObj } from "@storybook/react";

import { ScrollArea } from "@/components/ui/scroll-area";

const meta = {
	title: "UI/ScrollArea",
	component: ScrollArea,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

const CHANGELOG = Array.from({ length: 18 }, (_, index) => ({
	id: index + 1,
	title: `Actualización ${index + 1}`,
	description:
		"Se ajustaron reglas de conexión y se agregaron validaciones adicionales.",
	date: `2025-02-${(index + 1).toString().padStart(2, "0")}`,
}));

export const Default: Story = {
	render: () => (
		<ScrollArea className="h-64 w-[360px] rounded-lg border p-4">
			<div className="space-y-3">
				{CHANGELOG.map((entry) => (
					<div key={entry.id} className="space-y-1">
						<div className="flex items-center justify-between text-sm font-medium">
							<span>{entry.title}</span>
							<span className="text-xs text-muted-foreground">
								{entry.date}
							</span>
						</div>
						<p className="text-sm text-muted-foreground">{entry.description}</p>
					</div>
				))}
			</div>
		</ScrollArea>
	),
};
