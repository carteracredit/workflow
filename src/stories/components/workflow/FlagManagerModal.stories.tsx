import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { FlagManagerModal } from "@/components/workflow/flag-manager-modal";
import type { Flag } from "@/lib/workflow/types";

const SAMPLE_FLAGS: Flag[] = [
	{
		id: "flag-prioridad",
		name: "Prioridad",
		options: [
			{ id: "opt-alta", label: "Alta", color: "red-500" },
			{ id: "opt-media", label: "Media", color: "amber-500" },
			{ id: "opt-baja", label: "Baja", color: "emerald-500" },
		],
	},
	{
		id: "flag-riesgo",
		name: "Riesgo",
		options: [
			{ id: "opt-riesgo-1", label: "Observación", color: "sky-500" },
			{ id: "opt-riesgo-2", label: "Seguimiento", color: "violet-500" },
		],
	},
];

const meta = {
	title: "Components/Workflow/FlagManagerModal",
	component: FlagManagerModal,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof FlagManagerModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		workflowId: "00000000-0000-0000-0000-000000000001",
		apiToken: "mock-jwt-token",
		flags: SAMPLE_FLAGS,
		onClose: () => {},
		onUpdateFlags: () => {},
	},
	render: (args) => {
		const [flags, setFlags] = useState<Flag[]>(args.flags);

		return (
			<div className="bg-background p-6">
				<FlagManagerModal
					{...args}
					flags={flags}
					onClose={() => args.onClose()}
					onUpdateFlags={(nextFlags) => {
						setFlags(nextFlags);
						args.onUpdateFlags(nextFlags);
					}}
				/>
			</div>
		);
	},
};
