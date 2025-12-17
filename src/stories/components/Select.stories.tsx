import type { Meta, StoryObj } from "@storybook/react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
	{ value: "draft", label: "Borrador" },
	{ value: "in-review", label: "En revisión" },
	{ value: "approved", label: "Publicado" },
] as const;

const PRIORITY_OPTIONS = [
	{
		value: "high",
		label: "Alta prioridad",
		description: "Se ejecuta en cada originación urgente",
	},
	{
		value: "medium",
		label: "Media",
		description: "Ideal para iteraciones del equipo de riesgo",
	},
	{
		value: "low",
		label: "Baja",
		description: "Experimentos o pruebas internas",
	},
] as const;

const meta = {
	title: "UI/Select",
	component: Select,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WorkflowStatus: Story = {
	render: () => (
		<Select defaultValue={STATUS_OPTIONS[0].value}>
			<SelectTrigger className="w-60">
				<SelectValue placeholder="Selecciona el estado" />
			</SelectTrigger>
			<SelectContent>
				<SelectLabel>Estado actual</SelectLabel>
				{STATUS_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	),
};

export const PriorityWithDescription: Story = {
	render: () => (
		<Select defaultValue={PRIORITY_OPTIONS[1].value}>
			<SelectTrigger className="w-72">
				<SelectValue placeholder="Selecciona prioridad" />
			</SelectTrigger>
			<SelectContent>
				<SelectLabel>Prioridad</SelectLabel>
				<SelectSeparator />
				{PRIORITY_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						<div className="flex flex-col">
							<span className="font-medium">{option.label}</span>
							<span className="text-xs text-muted-foreground">
								{option.description}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	),
};
