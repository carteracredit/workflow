import type { Meta, StoryObj } from "@storybook/react";

import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const meta = {
	title: "Components/ThemeSwitcher",
	component: ThemeSwitcher,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof ThemeSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
			<div className="flex flex-col text-sm">
				<span className="font-medium">Tema del editor</span>
				<span className="text-xs text-muted-foreground">
					Sincroniza con el tema global o fuerza light/dark.
				</span>
			</div>
			<ThemeSwitcher />
		</div>
	),
};
