"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, Variable, ChevronDown } from "lucide-react";
import type { VariableNode, VariableSourceNode, VariableType } from "./types";
import { VariablePicker } from "./variable-picker";
import { cn } from "@/lib/utils";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export interface TemplateSegment {
	id: string;
	type: "text" | "variable";
	value: string;
	variablePath?: string;
	variableType?: VariableType;
	nodeName?: string;
	nodeId?: string;
	/** `true` when the alias in the path cannot be resolved to any known source node. */
	orphan?: boolean;
}

interface VariableTemplateInputProps {
	nodes: VariableSourceNode[];
	value?: TemplateSegment[];
	onChange?: (segments: TemplateSegment[]) => void;
	placeholder?: string;
	className?: string;
}

const variableColorMap: Record<VariableType, string> = {
	string:
		"bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200",
	number: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200",
	boolean: "bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200",
	object: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200",
	array: "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200",
	null: "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200",
	any: "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
};

function generateId() {
	return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function VariableTemplateInput({
	nodes,
	value,
	onChange,
	placeholder = "Escribe texto o agrega variables...",
	className,
}: VariableTemplateInputProps) {
	const [segments, setSegments] = useState<TemplateSegment[]>(value ?? []);
	const [textInput, setTextInput] = useState("");
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (value) setSegments(value);
	}, [value]);

	const updateSegments = useCallback(
		(newSegments: TemplateSegment[]) => {
			setSegments(newSegments);
			onChange?.(newSegments);
		},
		[onChange],
	);

	const handleVariableSelect = useCallback(
		(variable: VariableNode, node: VariableSourceNode) => {
			const newSegments = [...segments];

			// Use .length, not .trim(), so a whitespace-only pending value (e.g. a
			// single space typed to separate two variables) is preserved instead
			// of being silently dropped.
			if (textInput.length > 0) {
				newSegments.push({ id: generateId(), type: "text", value: textInput });
			}

			newSegments.push({
				id: generateId(),
				type: "variable",
				value: variable.name,
				variablePath: variable.path,
				variableType: variable.type,
				nodeName: node.name,
				nodeId: node.id,
			});

			updateSegments(newSegments);
			setTextInput("");
			setIsPickerOpen(false);
			inputRef.current?.focus();
		},
		[segments, textInput, updateSegments],
	);

	const handleRemoveSegment = useCallback(
		(segmentId: string) => {
			updateSegments(segments.filter((seg) => seg.id !== segmentId));
		},
		[segments, updateSegments],
	);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Backspace" && textInput === "" && segments.length > 0) {
			handleRemoveSegment(segments[segments.length - 1].id);
			e.preventDefault();
		}
		if (e.key === "Enter" && textInput.length > 0) {
			updateSegments([
				...segments,
				{ id: generateId(), type: "text" as const, value: textInput },
			]);
			setTextInput("");
			e.preventDefault();
		}
		if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
			setIsPickerOpen(true);
			e.preventDefault();
		}
		if (e.key === "Tab" && e.shiftKey) {
			setIsPickerOpen(true);
			e.preventDefault();
		}
	};

	const handleBlur = (e: React.FocusEvent) => {
		const relatedTarget = e.relatedTarget as HTMLElement;
		if (relatedTarget?.closest("[data-variable-picker]")) return;
		if (textInput.length > 0) {
			updateSegments([
				...segments,
				{ id: generateId(), type: "text" as const, value: textInput },
			]);
			setTextInput("");
		}
	};

	const outputString = useMemo(
		() =>
			segments
				.map((seg) =>
					seg.type === "variable" ? `\${${seg.variablePath}}` : seg.value,
				)
				.join(""),
		[segments],
	);

	return (
		<div className={cn("space-y-1.5 min-w-0", className)}>
			{/* Input area */}
			<div
				onClick={() => inputRef.current?.focus()}
				className={cn(
					"flex flex-wrap items-center gap-1.5 min-h-[40px] p-2",
					"bg-background border border-input rounded-md",
					"focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
					"cursor-text transition-all overflow-hidden",
				)}
			>
				{segments.map((segment) => (
					<SegmentBadge
						key={segment.id}
						segment={segment}
						onRemove={() => handleRemoveSegment(segment.id)}
					/>
				))}

				<input
					ref={inputRef}
					type="text"
					value={textInput}
					onChange={(e) => setTextInput(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					placeholder={segments.length === 0 ? placeholder : ""}
					className="flex-1 basis-16 min-w-0 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
				/>
			</div>

			{/* Insert button row */}
			<div className="flex items-center justify-between gap-2">
				<p className="text-[11px] text-muted-foreground truncate">
					<kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
						Ctrl
					</kbd>
					+
					<kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
						/
					</kbd>{" "}
					para insertar variables
				</p>

				<Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className={cn(
								"inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0",
								"bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
								"transition-colors",
							)}
						>
							<Variable className="w-3.5 h-3.5" />
							Insertar
							<ChevronDown className="w-3 h-3" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="end"
						side="bottom"
						className="w-72 p-0 border-0 shadow-xl"
						data-variable-picker
					>
						<VariablePicker nodes={nodes} onSelect={handleVariableSelect} />
					</PopoverContent>
				</Popover>
			</div>

			{/* Output preview */}
			{segments.length > 0 && (
				<div className="p-2 bg-muted/50 rounded-md border border-border overflow-hidden">
					<p className="text-[11px] font-medium text-muted-foreground mb-0.5">
						Resultado:
					</p>
					<code className="text-[11px] font-mono text-foreground break-all">
						{outputString || "(vacío)"}
					</code>
				</div>
			)}
		</div>
	);
}

interface SegmentBadgeProps {
	segment: TemplateSegment;
	onRemove: () => void;
}

function SegmentBadge({ segment, onRemove }: SegmentBadgeProps) {
	if (segment.type === "text") {
		return (
			<span className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 bg-muted/60 text-foreground text-xs rounded border border-border/50">
				<span className="truncate whitespace-pre">{segment.value}</span>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
				>
					<X className="w-3 h-3 text-muted-foreground" />
				</button>
			</span>
		);
	}

	const colorClass =
		variableColorMap[segment.variableType ?? "any"] ?? variableColorMap.any;

	if (segment.orphan) {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 text-xs rounded border",
					"bg-red-100 text-red-700 border-red-300 transition-colors",
				)}
				title={`Variable huérfana: ${segment.variablePath}`}
			>
				<span className="font-mono opacity-70 shrink-0">!</span>
				<span className="truncate line-through">
					{segment.variablePath ?? segment.value}
				</span>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="p-0.5 hover:bg-black/10 rounded transition-colors shrink-0"
				>
					<X className="w-3 h-3" />
				</button>
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 text-xs rounded border",
				"transition-colors",
				colorClass,
			)}
		>
			<VariableTypeIcon type={segment.variableType ?? "any"} />
			{segment.nodeName && (
				<>
					<span className="font-medium truncate opacity-70">
						{segment.nodeName}
					</span>
					<span className="opacity-40 shrink-0">·</span>
				</>
			)}
			<span className="font-medium truncate">{segment.value}</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				className="p-0.5 hover:bg-black/10 rounded transition-colors shrink-0"
			>
				<X className="w-3 h-3" />
			</button>
		</span>
	);
}

function VariableTypeIcon({ type }: { type: VariableType }) {
	const iconMap: Record<VariableType, string> = {
		string: "T",
		number: "#",
		boolean: "✓",
		object: "{}",
		array: "[]",
		null: "∅",
		any: "?",
	};

	return (
		<span className="text-[10px] font-bold opacity-70 shrink-0">
			{iconMap[type]}
		</span>
	);
}
