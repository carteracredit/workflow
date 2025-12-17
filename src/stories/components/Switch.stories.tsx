import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const meta = {
	title: "UI/Switch",
	component: Switch,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Controlled: Story = {
	render: () => {
		const [checked, setChecked] = useState(true);

		return (
			<label className="flex items-center gap-3 text-sm">
				<Switch checked={checked} onCheckedChange={setChecked} id="autosave" />
				<span>
					<Label htmlFor="autosave" className="cursor-pointer">
						Autoguardado
					</Label>
					<span className="block text-xs text-muted-foreground">
						Actualiza el workflow cada 30 segundos
					</span>
				</span>
			</label>
		);
	},
};

export const Disabled: Story = {
	render: () => (
		<label className="flex items-center gap-3 text-sm text-muted-foreground">
			<Switch disabled />
			<span>
				Modo lectura
				<span className="block text-xs">
					Disponible solo para usuarios con permisos de QA
				</span>
			</span>
		</label>
	),
};
