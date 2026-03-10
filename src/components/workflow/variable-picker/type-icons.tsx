"use client";

import type { VariableType } from "./types";
import { cn } from "@/lib/utils";

interface TypeIconProps {
	type: VariableType;
	className?: string;
}

export function TypeIcon({ type, className }: TypeIconProps) {
	const baseClass =
		"w-4 h-4 flex items-center justify-center text-xs font-medium rounded-sm";

	switch (type) {
		case "string":
			return (
				<div
					className={cn(
						baseClass,
						"bg-emerald-100 text-emerald-700",
						className,
					)}
				>
					<svg
						viewBox="0 0 16 16"
						fill="none"
						className="w-3 h-3"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						<rect x="3" y="2" width="10" height="12" rx="1" />
						<line x1="5" y1="5" x2="11" y2="5" />
						<line x1="5" y1="8" x2="11" y2="8" />
						<line x1="5" y1="11" x2="8" y2="11" />
					</svg>
				</div>
			);
		case "number":
			return (
				<div className={cn(baseClass, "bg-blue-100 text-blue-700", className)}>
					<span className="text-[10px] font-bold">123</span>
				</div>
			);
		case "boolean":
			return (
				<div className={cn(baseClass, "bg-rose-100 text-rose-600", className)}>
					<svg
						viewBox="0 0 16 16"
						fill="none"
						className="w-3 h-3"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M4 8l3 3 5-6" />
					</svg>
				</div>
			);
		case "object":
			return (
				<div
					className={cn(baseClass, "bg-amber-100 text-amber-700", className)}
				>
					<span className="text-[11px] font-bold">{"{}"}</span>
				</div>
			);
		case "array":
			return (
				<div
					className={cn(baseClass, "bg-purple-100 text-purple-700", className)}
				>
					<span className="text-[11px] font-bold">{"[]"}</span>
				</div>
			);
		case "null":
			return (
				<div className={cn(baseClass, "bg-gray-100 text-gray-500", className)}>
					<span className="text-[10px] font-medium">∅</span>
				</div>
			);
		default:
			return (
				<div className={cn(baseClass, "bg-gray-100 text-gray-600", className)}>
					<span className="text-[10px]">?</span>
				</div>
			);
	}
}

interface TypeBadgeProps {
	type: VariableType;
	className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
	const colorMap: Record<VariableType, string> = {
		string: "bg-emerald-50 text-emerald-700 border-emerald-200",
		number: "bg-blue-50 text-blue-700 border-blue-200",
		boolean: "bg-rose-50 text-rose-600 border-rose-200",
		object: "bg-amber-50 text-amber-700 border-amber-200",
		array: "bg-purple-50 text-purple-700 border-purple-200",
		null: "bg-gray-50 text-gray-500 border-gray-200",
		any: "bg-gray-50 text-gray-600 border-gray-200",
	};

	return (
		<span
			className={cn(
				"px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border",
				colorMap[type] ?? colorMap.any,
				className,
			)}
		>
			{type}
		</span>
	);
}
