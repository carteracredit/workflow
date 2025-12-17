import type { Meta, StoryObj } from "@storybook/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const meta = {
	title: "UI/Avatar",
	component: Avatar,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
	render: () => (
		<Avatar className="h-14 w-14">
			<AvatarImage
				src="https://i.pravatar.cc/100?img=12"
				alt="Vanessa Flores"
			/>
			<AvatarFallback>VF</AvatarFallback>
		</Avatar>
	),
};

export const FallbackOnly: Story = {
	render: () => (
		<Avatar className="h-12 w-12">
			<AvatarFallback>JD</AvatarFallback>
		</Avatar>
	),
};

export const TeamStack: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			{[
				{ id: 3, label: "DM" },
				{ id: 15, label: "AL" },
				{ id: 22, label: "SR" },
			].map((member) => (
				<Avatar key={member.id}>
					<AvatarImage
						src={`https://i.pravatar.cc/80?img=${member.id}`}
						alt={`Integrante ${member.label}`}
					/>
					<AvatarFallback>{member.label}</AvatarFallback>
				</Avatar>
			))}
		</div>
	),
};
