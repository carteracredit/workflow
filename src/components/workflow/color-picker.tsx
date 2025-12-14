"use client";

import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	TAILWIND_COLORS_500,
	getColorValue,
	type TailwindColor500,
} from "@/lib/flag-manager";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
	color: TailwindColor500;
	onColorChange: (color: TailwindColor500) => void;
	className?: string;
}

export function ColorPicker({
	color,
	onColorChange,
	className,
}: ColorPickerProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"h-8 w-8 rounded border-2 border-border transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
						className,
					)}
					style={{ backgroundColor: getColorValue(color) }}
					title={color}
					aria-label={`Color seleccionado: ${color}`}
				/>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-3" align="start">
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">
						Seleccionar color
					</p>
					<div className="grid grid-cols-11 gap-2">
						{TAILWIND_COLORS_500.map((colorOption) => (
							<button
								key={colorOption}
								type="button"
								onClick={() => {
									onColorChange(colorOption);
									setOpen(false);
								}}
								className={cn(
									"h-6 w-6 rounded border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
									color === colorOption
										? "border-foreground ring-2 ring-offset-1 ring-ring scale-110"
										: "border-border hover:border-foreground/50",
								)}
								style={{ backgroundColor: getColorValue(colorOption) }}
								title={colorOption}
								aria-label={colorOption}
							/>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
