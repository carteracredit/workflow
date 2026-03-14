"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type {
	OutputSchema,
	OutputSchemaProperty,
	SchemaPropertyType,
} from "@/lib/workflow/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PROPERTY_TYPES: Array<{ value: SchemaPropertyType; label: string }> = [
	{ value: "string", label: "STR" },
	{ value: "number", label: "NUM" },
	{ value: "boolean", label: "BOOL" },
	{ value: "object", label: "OBJ" },
	{ value: "array", label: "ARR" },
	{ value: "enum", label: "ENUM" },
];

function generateId() {
	return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultProperty(): OutputSchemaProperty {
	return { id: generateId(), name: "", type: "string" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeProperty(value: unknown): OutputSchemaProperty | null {
	if (!isRecord(value)) return null;

	const name = typeof value.name === "string" ? value.name : "";
	const type = typeof value.type === "string" ? value.type : "string";
	const validTypes = PROPERTY_TYPES.map((item) => item.value);
	if (!validTypes.includes(type as SchemaPropertyType)) return null;

	const property: OutputSchemaProperty = {
		id:
			typeof value.id === "string" && value.id.length > 0
				? value.id
				: generateId(),
		name,
		type: type as SchemaPropertyType,
	};

	if (typeof value.description === "string" && value.description.length > 0) {
		property.description = value.description;
	}

	if (property.type === "enum" && Array.isArray(value.enumValues)) {
		property.enumValues = value.enumValues.filter(
			(entry): entry is string => typeof entry === "string" && entry.length > 0,
		);
	}

	if (property.type === "object" && Array.isArray(value.properties)) {
		property.properties = value.properties
			.map((child) => normalizeProperty(child))
			.filter((child): child is OutputSchemaProperty => child !== null);
	}

	if (property.type === "array" && value.items) {
		property.items = normalizeProperty(value.items) ?? createDefaultProperty();
	}

	return property;
}

function normalizeSchema(
	value: unknown,
	fallbackName: string,
): OutputSchema | null {
	if (!isRecord(value) || !Array.isArray(value.properties)) return null;

	const properties = value.properties
		.map((entry) => normalizeProperty(entry))
		.filter((entry): entry is OutputSchemaProperty => entry !== null);

	return {
		name:
			typeof value.name === "string" && value.name.length > 0
				? value.name
				: fallbackName,
		properties,
	};
}

// ── Enum tag editor ────────────────────────────────────────────────────────

interface EnumTagEditorProps {
	values: string[];
	onChange: (values: string[]) => void;
}

function EnumTagEditor({ values, onChange }: EnumTagEditorProps) {
	const [input, setInput] = useState("");

	const addValue = (raw: string) => {
		const trimmed = raw.trim();
		if (trimmed && !values.includes(trimmed)) {
			onChange([...values, trimmed]);
		}
		setInput("");
	};

	return (
		<div className="mt-1.5 space-y-1.5">
			<div className="flex flex-wrap gap-1.5 min-h-[28px]">
				{values.map((v) => (
					<span
						key={v}
						className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground text-xs rounded-md border border-border"
					>
						{v}
						<button
							type="button"
							className="hover:text-destructive transition-colors"
							onClick={() => onChange(values.filter((x) => x !== v))}
						>
							×
						</button>
					</span>
				))}
			</div>
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === ",") {
						e.preventDefault();
						addValue(input);
					}
				}}
				onBlur={() => addValue(input)}
				placeholder="Agregar valor (Enter o coma)"
				className="w-full px-2 py-1 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
			/>
		</div>
	);
}

// ── Single property row (recursive) ───────────────────────────────────────

interface PropertyRowProps {
	property: OutputSchemaProperty;
	depth?: number;
	onUpdate: (updated: OutputSchemaProperty) => void;
	onDelete: () => void;
}

function PropertyRow({
	property,
	depth = 0,
	onUpdate,
	onDelete,
}: PropertyRowProps) {
	const [expanded, setExpanded] = useState(true);

	const hasChildren =
		(property.type === "object" &&
			property.properties &&
			property.properties.length > 0) ||
		(property.type === "array" && property.items);

	const update = (patch: Partial<OutputSchemaProperty>) =>
		onUpdate({ ...property, ...patch });

	const isInvalidName =
		property.name.length > 0 && /^[^a-zA-Z_]/.test(property.name);

	const handleTypeChange = (newType: SchemaPropertyType) => {
		const patch: Partial<OutputSchemaProperty> = { type: newType };
		if (newType !== "enum") patch.enumValues = undefined;
		if (newType !== "object") patch.properties = undefined;
		if (newType !== "array") patch.items = undefined;
		if (newType === "object" && !property.properties) patch.properties = [];
		if (newType === "array" && !property.items)
			patch.items = createDefaultProperty();
		update(patch);
	};

	const addChildProperty = () => {
		const current = property.properties ?? [];
		update({ properties: [...current, createDefaultProperty()] });
	};

	const updateChildProperty = (idx: number, updated: OutputSchemaProperty) => {
		const current = property.properties ?? [];
		const next = [...current];
		next[idx] = updated;
		update({ properties: next });
	};

	const deleteChildProperty = (idx: number) => {
		const current = property.properties ?? [];
		update({ properties: current.filter((_, i) => i !== idx) });
	};

	const indentPx = depth * 16;

	return (
		<div
			className={cn(
				"rounded-md border border-border/60 bg-card",
				depth > 0 && "border-border/40",
			)}
			style={{ marginLeft: `${indentPx}px` }}
		>
			{/* Property header row */}
			<div className="flex items-center gap-1.5 p-2">
				{/* Expand/collapse toggle for object/array */}
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

				{/* Type badge icon */}
				<TypeBadgeInline type={property.type} />

				{/* Name input */}
				<div className="flex flex-col flex-1 min-w-0">
					<Input
						value={property.name}
						onChange={(e) => update({ name: e.target.value })}
						placeholder="nombre"
						className={cn(
							"h-7 text-xs font-mono",
							isInvalidName &&
								"border-destructive focus-visible:ring-destructive",
						)}
					/>
					{isInvalidName && (
						<p className="text-[10px] text-destructive mt-0.5 leading-tight">
							Debe empezar con una letra
						</p>
					)}
				</div>

				{/* Type select */}
				<Select value={property.type} onValueChange={handleTypeChange}>
					<SelectTrigger className="h-7 w-[76px] text-xs px-2">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PROPERTY_TYPES.map((t) => (
							<SelectItem key={t.value} value={t.value} className="text-xs">
								{t.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Description input */}
				<Input
					value={property.description ?? ""}
					onChange={(e) => update({ description: e.target.value || undefined })}
					placeholder="descripción"
					className="h-7 text-xs flex-1 min-w-0 text-muted-foreground"
				/>

				{/* Delete button */}
				<button
					type="button"
					onClick={onDelete}
					className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
				>
					<Trash2 className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Enum values */}
			{property.type === "enum" && (
				<div className="px-3 pb-2">
					<EnumTagEditor
						values={property.enumValues ?? []}
						onChange={(enumValues) => update({ enumValues })}
					/>
				</div>
			)}

			{/* Object children */}
			{property.type === "object" && expanded && (
				<div className="px-2 pb-2 space-y-1.5">
					{(property.properties ?? []).map((child, idx) => (
						<PropertyRow
							key={child.id}
							property={child}
							depth={depth + 1}
							onUpdate={(updated) => updateChildProperty(idx, updated)}
							onDelete={() => deleteChildProperty(idx)}
						/>
					))}
					<button
						type="button"
						onClick={addChildProperty}
						className="ml-5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
					>
						<Plus className="w-3 h-3" />
						Agregar propiedad
					</button>
				</div>
			)}

			{/* Array item schema */}
			{property.type === "array" && expanded && property.items && (
				<div className="px-2 pb-2 space-y-1">
					<p className="text-[10px] text-muted-foreground ml-5 mb-1 uppercase tracking-wide">
						Tipo de elemento
					</p>
					<PropertyRow
						property={property.items}
						depth={depth + 1}
						onUpdate={(updated) => update({ items: updated })}
						onDelete={() => update({ items: createDefaultProperty() })}
					/>
				</div>
			)}
		</div>
	);
}

// ── Type badge (inline colored label) ─────────────────────────────────────

const typeBadgeStyles: Record<SchemaPropertyType, string> = {
	string: "bg-emerald-100 text-emerald-700",
	number: "bg-blue-100 text-blue-700",
	boolean: "bg-rose-100 text-rose-600",
	object: "bg-amber-100 text-amber-700",
	array: "bg-purple-100 text-purple-700",
	enum: "bg-indigo-100 text-indigo-700",
};

function TypeBadgeInline({ type }: { type: SchemaPropertyType }) {
	const labels: Record<SchemaPropertyType, string> = {
		string: "S",
		number: "#",
		boolean: "B",
		object: "{}",
		array: "[]",
		enum: "E",
	};
	return (
		<span
			className={cn(
				"w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded shrink-0",
				typeBadgeStyles[type],
			)}
		>
			{labels[type]}
		</span>
	);
}

// ── Main OutputSchemaEditor ────────────────────────────────────────────────

interface OutputSchemaEditorProps {
	value: OutputSchema | undefined;
	onChange: (schema: OutputSchema) => void;
	label?: string;
	/** If provided, renders an extra button to infer schema from a JSON string */
	onInferFromJson?: () => void;
}

export function OutputSchemaEditor({
	value,
	onChange,
	label = "Esquema de Salida",
	onInferFromJson,
}: OutputSchemaEditorProps) {
	const [collapsed, setCollapsed] = useState(false);
	const [mode, setMode] = useState<"simple" | "advanced">("simple");
	const [advancedJson, setAdvancedJson] = useState("");
	const [advancedError, setAdvancedError] = useState<string | null>(null);

	const schema: OutputSchema = value ?? { name: label, properties: [] };
	const prettySchema = useMemo(() => JSON.stringify(schema, null, 2), [schema]);

	useEffect(() => {
		if (mode === "simple") {
			setAdvancedJson(prettySchema);
			setAdvancedError(null);
		}
	}, [mode, prettySchema]);

	const updateProperty = useCallback(
		(idx: number, updated: OutputSchemaProperty) => {
			const next = [...schema.properties];
			next[idx] = updated;
			onChange({ ...schema, properties: next });
		},
		[schema, onChange],
	);

	const deleteProperty = useCallback(
		(idx: number) => {
			onChange({
				...schema,
				properties: schema.properties.filter((_, i) => i !== idx),
			});
		},
		[schema, onChange],
	);

	const addProperty = useCallback(() => {
		onChange({
			...schema,
			properties: [...schema.properties, createDefaultProperty()],
		});
	}, [schema, onChange]);

	const applyAdvancedSchema = useCallback(() => {
		try {
			const parsed = JSON.parse(advancedJson) as unknown;
			const normalized = normalizeSchema(parsed, schema.name || label);
			if (!normalized) {
				setAdvancedError(
					"Estructura invalida. Usa un objeto con { name, properties[] }.",
				);
				return false;
			}
			onChange(normalized);
			setAdvancedError(null);
			return true;
		} catch {
			setAdvancedError("JSON invalido. Revisa comas y llaves.");
			return false;
		}
	}, [advancedJson, label, onChange, schema.name]);

	const handleModeChange = (nextMode: "simple" | "advanced") => {
		if (nextMode === mode) return;
		if (nextMode === "advanced") {
			setAdvancedJson(prettySchema);
			setAdvancedError(null);
			setMode("advanced");
			return;
		}
		const applied = applyAdvancedSchema();
		if (applied) {
			setMode("simple");
		}
	};

	return (
		<div className="rounded-md border border-border/60 overflow-hidden">
			{/* Header */}
			<div className="w-full px-3 py-2.5 bg-muted/40 space-y-1.5">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="text-sm font-medium truncate">{label}</span>
						<span className="text-xs text-muted-foreground whitespace-nowrap">
							({schema.properties.length})
						</span>
					</div>
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="p-1 rounded hover:bg-muted transition-colors shrink-0"
						aria-label={collapsed ? "Expandir esquema" : "Contraer esquema"}
					>
						{collapsed ? (
							<ChevronRight className="w-4 h-4 text-muted-foreground" />
						) : (
							<ChevronDown className="w-4 h-4 text-muted-foreground" />
						)}
					</button>
				</div>
				{!collapsed && (
					<div className="flex items-center justify-between gap-2">
						{onInferFromJson ? (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onInferFromJson();
								}}
								className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors truncate"
							>
								Inferir desde Mock
							</button>
						) : (
							<span />
						)}
						<div className="flex items-center rounded-md border border-border/60 p-0.5 shrink-0">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleModeChange("simple");
								}}
								className={cn(
									"px-2 py-0.5 text-[11px] rounded-sm transition-colors",
									mode === "simple"
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Simple
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleModeChange("advanced");
								}}
								className={cn(
									"px-2 py-0.5 text-[11px] rounded-sm transition-colors",
									mode === "advanced"
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Advanced
							</button>
						</div>
					</div>
				)}
			</div>

			{!collapsed && (
				<div className="p-3 space-y-2">
					{mode === "simple" ? (
						<>
							{/* Schema name */}
							<div className="space-y-1">
								<Label className="text-xs text-muted-foreground">
									Nombre del esquema
								</Label>
								<Input
									value={schema.name}
									onChange={(e) =>
										onChange({ ...schema, name: e.target.value })
									}
									placeholder="EjemploOutput"
									className="h-7 text-xs font-mono"
								/>
							</div>

							{/* Column headers */}
							{schema.properties.length > 0 && (
								<div className="flex items-center gap-1.5 px-2 text-[10px] text-muted-foreground uppercase tracking-wide">
									<span className="w-5" />
									<span className="w-5" />
									<span className="flex-1">Nombre</span>
									<span className="w-[76px]">Tipo</span>
									<span className="flex-1">Descripción</span>
									<span className="w-7" />
								</div>
							)}

							{/* Property rows */}
							<div className="space-y-1.5">
								{schema.properties.map((prop, idx) => (
									<PropertyRow
										key={prop.id}
										property={prop}
										onUpdate={(updated) => updateProperty(idx, updated)}
										onDelete={() => deleteProperty(idx)}
									/>
								))}
							</div>

							{/* Add property */}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={addProperty}
								className="w-full h-8 text-xs border border-dashed border-border/60 hover:border-border"
							>
								<Plus className="w-3.5 h-3.5 mr-1" />
								Agregar propiedad
							</Button>
						</>
					) : (
						<>
							<div className="space-y-1">
								<Label className="text-xs text-muted-foreground">
									Editar JSON del esquema
								</Label>
								<Textarea
									value={advancedJson}
									onChange={(e) => {
										setAdvancedJson(e.target.value);
										if (advancedError) setAdvancedError(null);
									}}
									placeholder='{"name":"Output","properties":[]}'
									rows={12}
									className="font-mono text-xs"
								/>
							</div>
							{advancedError && (
								<div className="rounded-md bg-destructive/10 text-destructive text-xs px-2 py-1.5">
									{advancedError}
								</div>
							)}
							<div className="flex items-center justify-between gap-2">
								<p className="text-[11px] text-muted-foreground">
									Usa la misma estructura {`{ name, properties[] }`} del modo
									Simple.
								</p>
								<Button
									type="button"
									size="sm"
									onClick={applyAdvancedSchema}
									className="h-7 text-xs"
								>
									Aplicar JSON
								</Button>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}
