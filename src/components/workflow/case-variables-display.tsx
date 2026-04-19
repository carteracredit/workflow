"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
	CASE_VARIABLES,
	cloneCaseVariables,
} from "@/lib/workflow/case-variables";
import type {
	OutputSchemaProperty,
	SchemaPropertyType,
} from "@/lib/workflow/types";
import { useLanguage } from "@/components/LanguageProvider";

const typeBadgeStyles: Record<SchemaPropertyType, string> = {
	string: "bg-emerald-100 text-emerald-700",
	number: "bg-blue-100 text-blue-700",
	boolean: "bg-rose-100 text-rose-600",
	object: "bg-amber-100 text-amber-700",
	array: "bg-purple-100 text-purple-700",
	enum: "bg-indigo-100 text-indigo-700",
};

const typeLabels: Record<SchemaPropertyType, string> = {
	string: "S",
	number: "#",
	boolean: "B",
	object: "{}",
	array: "[]",
	enum: "E",
};

function TypeBadge({ type }: { type: SchemaPropertyType }) {
	return (
		<span
			className={cn(
				"w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded shrink-0",
				typeBadgeStyles[type],
			)}
		>
			{typeLabels[type]}
		</span>
	);
}

interface ReadOnlyRowProps {
	property: OutputSchemaProperty;
	depth?: number;
}

function ReadOnlyRow({ property, depth = 0 }: ReadOnlyRowProps) {
	const [expanded, setExpanded] = useState(true);
	const hasChildren =
		(property.type === "object" &&
			property.properties &&
			property.properties.length > 0) ||
		(property.type === "array" && !!property.items);

	return (
		<div
			className={cn(
				"rounded-md border border-border/40 bg-muted/30",
				depth > 0 && "border-border/30",
			)}
			style={{ marginLeft: `${depth * 16}px` }}
		>
			<div className="flex items-center gap-1.5 p-2">
				{hasChildren ? (
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
					>
						{expanded ? (
							<ChevronDown className="w-3.5 h-3.5" />
						) : (
							<ChevronRight className="w-3.5 h-3.5" />
						)}
					</button>
				) : (
					<span className="w-5" />
				)}
				<TypeBadge type={property.type} />
				<span className="flex-1 text-xs font-mono text-foreground truncate">
					{property.name}
				</span>
				{property.description && (
					<span className="flex-1 text-[11px] text-muted-foreground truncate">
						{property.description}
					</span>
				)}
				<Lock
					className="w-3 h-3 text-muted-foreground shrink-0"
					aria-label="Read-only (provided by the system)"
				/>
			</div>

			{property.type === "object" && expanded && property.properties && (
				<div className="px-2 pb-2 space-y-1">
					{property.properties.map((child) => (
						<ReadOnlyRow key={child.id} property={child} depth={depth + 1} />
					))}
				</div>
			)}

			{property.type === "array" && expanded && property.items && (
				<div className="px-2 pb-2 space-y-1">
					<ReadOnlyRow property={property.items} depth={depth + 1} />
				</div>
			)}
		</div>
	);
}

interface CaseVariablesDisplayProps {
	label?: string;
}

/**
 * Read-only panel rendered in the Start node properties. Lists the fixed
 * case-level variables that cases-svc always injects into the workflow
 * payload (applicant, seller, amount, role contacts, client address, …).
 *
 * Purpose: make these fields discoverable to workflow authors without
 * requiring them to declare them manually. They are also selectable in
 * every downstream `VariablePicker` via `buildVariableSourceNodes`.
 */
export function CaseVariablesDisplay({ label }: CaseVariablesDisplayProps) {
	const { t } = useLanguage();
	const [collapsed, setCollapsed] = useState(false);
	const effectiveLabel = label ?? t("propertiesPanel.caseVariablesLabel");
	const items = cloneCaseVariables();

	return (
		<div className="rounded-md border border-border/60 overflow-hidden">
			<div className="w-full px-3 py-2.5 bg-muted/40">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5 min-w-0">
						<Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
						<span className="text-sm font-medium truncate">
							{effectiveLabel}
						</span>
						<span className="text-xs text-muted-foreground whitespace-nowrap">
							({CASE_VARIABLES.length})
						</span>
					</div>
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="p-1 rounded hover:bg-muted transition-colors shrink-0"
						aria-label={collapsed ? "Expand" : "Collapse"}
					>
						{collapsed ? (
							<ChevronRight className="w-4 h-4 text-muted-foreground" />
						) : (
							<ChevronDown className="w-4 h-4 text-muted-foreground" />
						)}
					</button>
				</div>
				{!collapsed && (
					<p className="text-[11px] text-muted-foreground mt-1.5">
						{t("propertiesPanel.caseVariablesHint")}
					</p>
				)}
			</div>
			{!collapsed && (
				<div className="p-3 space-y-1.5">
					{items.map((prop) => (
						<ReadOnlyRow key={prop.id} property={prop} />
					))}
				</div>
			)}
		</div>
	);
}
