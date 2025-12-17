import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const meta = {
	title: "UI/DropdownMenu",
	component: DropdownMenu,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
		const [autoSave, setAutoSave] = useState(true);
		const [shortcuts, setShortcuts] = useState(false);
		const handleDashboard = () => {};
		const handleValidations = () => {};
		const handleHistory = () => {};

		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">Preferencias</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-64">
					<DropdownMenuLabel>Workspace</DropdownMenuLabel>
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={handleDashboard}>
							Dashboard principal
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={handleValidations}>
							Errores de validación
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={handleHistory}>
							Historial de cambios
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Tema</DropdownMenuLabel>
					<DropdownMenuRadioGroup
						value={theme}
						onValueChange={(value) =>
							setTheme(value as "system" | "light" | "dark")
						}
					>
						<DropdownMenuRadioItem value="system">
							Seguir al sistema
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="light">Claro</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="dark">Oscuro</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Productividad</DropdownMenuLabel>
					<DropdownMenuCheckboxItem
						checked={autoSave}
						onCheckedChange={(checked) => setAutoSave(checked === true)}
					>
						Autoguardado cada 30s
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={shortcuts}
						onCheckedChange={(checked) => setShortcuts(checked === true)}
					>
						Atajos de teclado
					</DropdownMenuCheckboxItem>
					<DropdownMenuSeparator />
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							Ejecuciones recientes
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="w-48">
							<DropdownMenuItem>Originación Santander</DropdownMenuItem>
							<DropdownMenuItem>Workflow hipotecario</DropdownMenuItem>
							<DropdownMenuItem>Sandbox QA</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	},
};
