import type { Meta, StoryObj } from "@storybook/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Card> = {
	title: "UI/Card",
	component: Card,
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
	render: () => (
		<Card className="max-w-md">
			<CardHeader>
				<CardTitle>Card title</CardTitle>
				<CardDescription>Short description goes here.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="text-sm text-muted-foreground">
					This is some content inside the card.
				</div>
			</CardContent>
			<CardFooter className="justify-end gap-2">
				<Button variant="outline">Cancel</Button>
				<Button>Save</Button>
			</CardFooter>
		</Card>
	),
};
