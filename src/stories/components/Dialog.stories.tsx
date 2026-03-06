import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

type DialogStoryProps = {
	title: string;
	description: string;
	confirmLabel: string;
	cancelLabel: string;
	confirmVariant?: "default" | "destructive";
};

const DialogExample = ({
	title,
	description,
	confirmLabel,
	cancelLabel,
	confirmVariant = "default",
}: DialogStoryProps) => (
	<Dialog>
		<DialogTrigger asChild>
			<Button variant="outline">Abrir diálogo</Button>
		</DialogTrigger>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<div className="space-y-2 text-sm text-muted-foreground">
				<p>
					Los cambios se guardan automáticamente en cada paso, pero puedes
					revertirlos desde el historial del workflow.
				</p>
				<p>
					No olvides validar el flujo para detectar nodos desconectados o reglas
					incompletas antes de publicarlo.
				</p>
			</div>
			<DialogFooter>
				<Button variant="outline">{cancelLabel}</Button>
				<Button variant={confirmVariant}>{confirmLabel}</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);

const meta = {
	title: "UI/Dialog",
	component: DialogExample,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof DialogExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		title: "Configurar workflow",
		description:
			"Define la metadata principal antes de compartirlo con tu equipo.",
		confirmLabel: "Guardar cambios",
		cancelLabel: "Cancelar",
		confirmVariant: "default",
	},
};

export const DestructiveAction: Story = {
	args: {
		title: "Eliminar workflow",
		description:
			"Esta acción es irreversible. Se eliminarán nodos, conexiones y flags.",
		confirmLabel: "Eliminar",
		cancelLabel: "Volver",
		confirmVariant: "destructive",
	},
};
