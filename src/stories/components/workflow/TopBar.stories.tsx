import type { Meta, StoryObj } from "@storybook/nextjs";
import { TopBar } from "@/components/workflow/top-bar";

const meta: Meta<typeof TopBar> = {
	title: "Components/Workflow/TopBar",
	component: TopBar,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		onNew: () => {},
		onSave: () => {},
		onPublish: () => {},
		onExportJSON: () => {},
		onImportJSON: () => {},
		onLoadExample: () => {},
		onManageFlags: () => {},
		onToggleWorkflowProperties: () => {},
		workflowMetadata: {
			name: "Workflow de originación",
			description: "Editor para flujo de aprobación de crédito automotriz.",
			version: "2.3.1",
			author: "Equipo Cartera",
			tags: ["credit", "workflow"],
			createdAt: new Date("2025-01-01T10:00:00Z").toISOString(),
			updatedAt: new Date("2025-01-10T12:00:00Z").toISOString(),
		},
	},
};

export default meta;
type Story = StoryObj<typeof TopBar>;

export const Default: Story = {};
