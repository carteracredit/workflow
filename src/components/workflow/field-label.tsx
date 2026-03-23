import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FieldLabelProps {
	htmlFor?: string;
	children: React.ReactNode;
	description?: string;
	className?: string;
}

export function FieldLabel({
	htmlFor,
	children,
	description,
	className,
}: FieldLabelProps) {
	return (
		<div className={cn("flex items-center gap-1.5", className)}>
			<Label htmlFor={htmlFor}>{children}</Label>
			{description && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="inline-flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
							aria-label="Más información"
						>
							<Info className="h-3.5 w-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="top" className="max-w-64">
						{description}
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
