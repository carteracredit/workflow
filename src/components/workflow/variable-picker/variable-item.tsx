"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { VariableNode, VariableSourceNode } from "./types";
import { TypeIcon, TypeBadge } from "./type-icons";
import { cn } from "@/lib/utils";

interface VariableItemProps {
	variable: VariableNode;
	node: VariableSourceNode;
	depth?: number;
	onSelect: (variable: VariableNode, node: VariableSourceNode) => void;
	searchQuery?: string;
	defaultExpanded?: boolean;
}

function highlightMatch(text: string, query: string) {
	if (!query) return text;

	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const index = lowerText.indexOf(lowerQuery);

	if (index === -1) return text;

	return (
		<>
			{text.slice(0, index)}
			<mark className="bg-amber-200 text-foreground rounded px-0.5">
				{text.slice(index, index + query.length)}
			</mark>
			{text.slice(index + query.length)}
		</>
	);
}

export function VariableItem({
	variable,
	node,
	depth = 0,
	onSelect,
	searchQuery = "",
	defaultExpanded = false,
}: VariableItemProps) {
	const hasChildren = variable.children && variable.children.length > 0;
	const [isExpanded, setIsExpanded] = useState(
		defaultExpanded || (searchQuery.length > 0 && hasChildren),
	);

	const handleClick = () => {
		if (hasChildren) {
			setIsExpanded(!isExpanded);
		} else {
			onSelect(variable, node);
		}
	};

	const handleSelectParent = (e: React.MouseEvent) => {
		e.stopPropagation();
		onSelect(variable, node);
	};

	return (
		<div className="select-none">
			<div
				className={cn(
					"flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
					"hover:bg-muted/80 group",
				)}
				style={{ paddingLeft: `${depth * 16 + 8}px` }}
				onClick={handleClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") handleClick();
				}}
				role="button"
				tabIndex={0}
			>
				{hasChildren ? (
					<button
						type="button"
						className="p-0.5 rounded hover:bg-muted"
						onClick={(e) => {
							e.stopPropagation();
							setIsExpanded(!isExpanded);
						}}
					>
						<ChevronRight
							className={cn(
								"w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
								isExpanded && "rotate-90",
							)}
						/>
					</button>
				) : (
					<span className="w-4" />
				)}

				<TypeIcon type={variable.type} />

				<span className="flex-1 text-sm font-medium text-foreground truncate">
					{highlightMatch(variable.name, searchQuery)}
				</span>

				<TypeBadge type={variable.type} />

				{hasChildren && (
					<button
						type="button"
						onClick={handleSelectParent}
						className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground transition-opacity px-1.5 py-0.5 rounded bg-muted"
					>
						Select
					</button>
				)}
			</div>

			{hasChildren && isExpanded && (
				<div className="relative">
					<div
						className="absolute left-0 top-0 bottom-0 border-l border-border"
						style={{ marginLeft: `${depth * 16 + 20}px` }}
					/>
					{variable.children!.map((child) => (
						<VariableItem
							key={child.path}
							variable={child}
							node={node}
							depth={depth + 1}
							onSelect={onSelect}
							searchQuery={searchQuery}
							defaultExpanded={defaultExpanded}
						/>
					))}
				</div>
			)}
		</div>
	);
}
