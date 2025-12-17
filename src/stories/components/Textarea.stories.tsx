import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const meta = {
	title: "UI/Textarea",
	component: Textarea,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		placeholder: "Describe el objetivo del workflow…",
		rows: 4,
	},
	render: (args) => (
		<label className="flex w-[480px] flex-col gap-2 text-sm">
			<Label>Descripción</Label>
			<Textarea {...args} />
		</label>
	),
};

export const WithValidationMessage: Story = {
	args: {
		defaultValue:
			"La originación digital debe incluir validaciones de buró y antifraude.",
		"aria-invalid": true,
	},
	render: (args) => (
		<label className="flex w-[480px] flex-col gap-2 text-sm">
			<Label className="text-destructive">Notas internas</Label>
			<Textarea {...args} />
			<span className="text-xs text-destructive">
				Este campo es obligatorio para flujos productivos.
			</span>
		</label>
	),
};
