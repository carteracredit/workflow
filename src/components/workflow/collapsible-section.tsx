"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
	title: string;
	defaultOpen?: boolean;
	className?: string;
	children: React.ReactNode;
}

export function CollapsibleSection({
	title,
	defaultOpen = true,
	className,
	children,
}: CollapsibleSectionProps) {
	const [open, setOpen] = React.useState(defaultOpen);

	return (
		<div
			className={cn(
				"rounded-md border border-border/60 overflow-hidden",
				className,
			)}
		>
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs font-medium text-foreground"
			>
				<span>{title}</span>
				{open ? (
					<ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
				) : (
					<ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
				)}
			</button>
			{open && (
				<div className="p-3 space-y-3 border-t border-border/60">
					{children}
				</div>
			)}
		</div>
	);
}
