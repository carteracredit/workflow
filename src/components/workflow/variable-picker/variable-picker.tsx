"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type {
	VariableNode,
	VariableSourceNode,
	VariablePickerProps,
} from "./types";
import { VariableItem } from "./variable-item";
import { cn } from "@/lib/utils";

function filterVariables(
	variables: VariableNode[],
	query: string,
): VariableNode[] {
	const lowerQuery = query.toLowerCase();

	return variables
		.map((variable) => {
			const nameMatches = variable.name.toLowerCase().includes(lowerQuery);
			const filteredChildren = variable.children
				? filterVariables(variable.children, query)
				: [];

			if (nameMatches || filteredChildren.length > 0) {
				return {
					...variable,
					children: nameMatches ? variable.children : filteredChildren,
				};
			}

			return null;
		})
		.filter(Boolean) as VariableNode[];
}

function flattenVariables(variables: VariableNode[]): VariableNode[] {
	return variables.flatMap((variable) => [
		variable,
		...(variable.children ? flattenVariables(variable.children) : []),
	]);
}

export function VariablePicker({
	nodes,
	onSelect,
	searchPlaceholder = "Buscar variables...",
	className,
	defaultExpanded = false,
}: VariablePickerProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredNodes = useMemo(() => {
		if (!searchQuery) return nodes;

		return nodes
			.map((node) => ({
				...node,
				variables: filterVariables(node.variables, searchQuery),
			}))
			.filter((node) => node.variables.length > 0);
	}, [nodes, searchQuery]);

	const totalCount = useMemo(
		() =>
			nodes.reduce(
				(acc, node) => acc + flattenVariables(node.variables).length,
				0,
			),
		[nodes],
	);

	const filteredCount = useMemo(
		() =>
			filteredNodes.reduce(
				(acc, node) => acc + flattenVariables(node.variables).length,
				0,
			),
		[filteredNodes],
	);

	return (
		<div
			className={cn(
				"w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden",
				className,
			)}
		>
			{/* Search Header */}
			<div className="p-3 border-b border-border bg-muted/30">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={searchPlaceholder}
						className={cn(
							"w-full pl-9 pr-9 py-2 text-sm rounded-lg",
							"bg-background border border-input",
							"placeholder:text-muted-foreground",
							"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
						)}
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
						>
							<X className="w-3.5 h-3.5 text-muted-foreground" />
						</button>
					)}
				</div>
				{searchQuery && (
					<p className="mt-2 text-xs text-muted-foreground">
						Mostrando {filteredCount} de {totalCount} variables
					</p>
				)}
			</div>

			{/* Variable List */}
			<div className="max-h-80 overflow-y-auto">
				{nodes.length === 0 ? (
					<div className="p-6 text-center">
						<p className="text-sm text-muted-foreground">
							Sin variables disponibles
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Define un esquema de salida en los nodos anteriores
						</p>
					</div>
				) : filteredNodes.length === 0 ? (
					<div className="p-6 text-center">
						<p className="text-sm text-muted-foreground">
							No se encontraron variables
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Intenta con otro término de búsqueda
						</p>
					</div>
				) : (
					filteredNodes.map((node) => (
						<div
							key={node.id}
							className="border-b border-border last:border-b-0"
						>
							<div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40">
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
									{node.name}
								</span>
							</div>
							<div className="py-1 px-2">
								{node.variables.map((variable) => (
									<VariableItem
										key={variable.path}
										variable={variable}
										node={node}
										onSelect={onSelect}
										searchQuery={searchQuery}
										defaultExpanded={defaultExpanded}
									/>
								))}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
