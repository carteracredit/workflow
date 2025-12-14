"use client";

import { useState } from "react";
import type { Flag, FlagOption } from "@/lib/workflow/types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import {
	validateFlag,
	validateFlagsUnique,
	createDefaultFlag,
	createDefaultFlagOption,
	getColorValue,
} from "@/lib/flag-manager";
import { ColorPicker } from "./color-picker";
import { cn } from "@/lib/utils";
import type { TailwindColor500 } from "@/lib/flag-manager";

interface FlagManagerModalProps {
	flags: Flag[];
	onClose: () => void;
	onUpdateFlags: (flags: Flag[]) => void;
}

export function FlagManagerModal({
	flags,
	onClose,
	onUpdateFlags,
}: FlagManagerModalProps) {
	const [editingFlag, setEditingFlag] = useState<Flag | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleCreateFlag = () => {
		setEditingFlag(createDefaultFlag());
		setIsCreating(true);
		setError(null);
	};

	const handleEditFlag = (flag: Flag) => {
		setEditingFlag({
			...flag,
			options: flag.options.map((opt) => ({ ...opt })),
		});
		setIsCreating(false);
		setError(null);
	};

	const handleDeleteFlag = (flagId: string) => {
		if (window.confirm("¿Estás seguro de que deseas eliminar este flag?")) {
			onUpdateFlags(flags.filter((f) => f.id !== flagId));
		}
	};

	const handleSaveFlag = () => {
		if (!editingFlag) return;

		const validation = validateFlag(editingFlag);
		if (!validation.valid) {
			setError(validation.error || "Error de validación");
			return;
		}

		// Validar que no haya duplicados
		const otherFlags = isCreating
			? flags
			: flags.filter((f) => f.id !== editingFlag.id);
		const allFlags = [...otherFlags, editingFlag];
		const uniqueValidation = validateFlagsUnique(allFlags);
		if (!uniqueValidation.valid) {
			setError(uniqueValidation.error || "Ya existe un flag con ese nombre");
			return;
		}

		if (isCreating) {
			onUpdateFlags([...flags, editingFlag]);
		} else {
			onUpdateFlags(
				flags.map((f) => (f.id === editingFlag.id ? editingFlag : f)),
			);
		}

		setEditingFlag(null);
		setIsCreating(false);
		setError(null);
	};

	const handleCancelEdit = () => {
		setEditingFlag(null);
		setIsCreating(false);
		setError(null);
	};

	const handleAddOption = () => {
		if (!editingFlag) return;
		setEditingFlag({
			...editingFlag,
			options: [...editingFlag.options, createDefaultFlagOption()],
		});
	};

	const handleRemoveOption = (optionId: string) => {
		if (!editingFlag) return;
		if (editingFlag.options.length <= 1) {
			setError("El flag debe tener al menos una opción");
			return;
		}
		setEditingFlag({
			...editingFlag,
			options: editingFlag.options.filter((opt) => opt.id !== optionId),
		});
	};

	const handleUpdateOption = (
		optionId: string,
		updates: Partial<FlagOption>,
	) => {
		if (!editingFlag) return;
		setEditingFlag({
			...editingFlag,
			options: editingFlag.options.map((opt) =>
				opt.id === optionId ? { ...opt, ...updates } : opt,
			),
		});
	};

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent
				className={cn(
					"max-w-3xl flex flex-col p-0 gap-0",
					flags.length === 0 && !editingFlag ? "max-h-[50vh]" : "h-[85vh]",
				)}
			>
				<DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
					<DialogTitle>Gestionar Flags</DialogTitle>
				</DialogHeader>

				{!editingFlag ? (
					<div className="flex flex-col flex-1 min-h-0">
						<div className="px-6 py-4 border-b flex justify-between items-center flex-shrink-0">
							<p className="text-sm text-muted-foreground">
								Define flags con opciones y colores distintivos
							</p>
							<Button onClick={handleCreateFlag} size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Crear Flag
							</Button>
						</div>

						{flags.length === 0 ? (
							<div className="px-6 py-8 flex flex-col items-center justify-center text-center flex-1">
								<p className="font-medium mb-1 text-foreground">
									No hay flags definidos
								</p>
								<p className="text-sm text-muted-foreground mb-4">
									Crea tu primer flag para comenzar
								</p>
							</div>
						) : (
							<ScrollArea className="flex-1 min-h-0">
								<div className="px-6 py-4">
									<div className="space-y-3">
										{flags.map((flag) => (
											<div
												key={flag.id}
												className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
											>
												<div className="flex justify-between items-start mb-3">
													<div>
														<h3 className="font-semibold text-base">
															{flag.name}
														</h3>
														<p className="text-xs text-muted-foreground mt-0.5">
															{flag.options.length} opción
															{flag.options.length !== 1 ? "es" : ""}
														</p>
													</div>
													<div className="flex gap-1">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => handleEditFlag(flag)}
															className="h-8 w-8 p-0"
														>
															<Edit2 className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => handleDeleteFlag(flag.id)}
															className="h-8 w-8 p-0"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>

												<div className="flex flex-wrap gap-2">
													{flag.options.map((option) => (
														<div
															key={option.id}
															className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-sm"
															style={{
																backgroundColor: getColorValue(option.color),
															}}
														>
															<span>{option.label}</span>
														</div>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
							</ScrollArea>
						)}

						<div className="px-6 py-4 border-t flex justify-end flex-shrink-0">
							<Button variant="outline" onClick={onClose}>
								Cerrar
							</Button>
						</div>
					</div>
				) : (
					<>
						<div className="px-6 py-4 border-b space-y-4 flex-shrink-0">
							<div className="space-y-2">
								<Label htmlFor="flag-name" className="text-sm font-medium">
									Nombre del Flag
								</Label>
								<Input
									id="flag-name"
									value={editingFlag.name}
									onChange={(e) =>
										setEditingFlag({ ...editingFlag, name: e.target.value })
									}
									placeholder="Ej: Prioridad, Estado, Categoría..."
									className="w-full"
								/>
							</div>

							<div className="flex justify-between items-center">
								<Label className="text-sm font-medium">Opciones</Label>
								<Button variant="outline" size="sm" onClick={handleAddOption}>
									<Plus className="h-4 w-4 mr-2" />
									Agregar Opción
								</Button>
							</div>
						</div>

						<ScrollArea className="flex-1 min-h-0">
							<div className="px-6 py-4">
								<div className="space-y-3">
									{editingFlag.options.map((option, index) => (
										<div
											key={option.id}
											className="border rounded-lg p-4 bg-card"
										>
											<div className="flex items-center gap-3">
												<ColorPicker
													color={option.color as TailwindColor500}
													onColorChange={(color) =>
														handleUpdateOption(option.id, { color })
													}
												/>
												<div className="flex-1">
													<Input
														value={option.label}
														onChange={(e) =>
															handleUpdateOption(option.id, {
																label: e.target.value,
															})
														}
														placeholder={`Opción ${index + 1}`}
														className="w-full"
													/>
												</div>
												{editingFlag.options.length > 1 && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleRemoveOption(option.id)}
														className="h-9 w-9 p-0 flex-shrink-0"
													>
														<X className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						</ScrollArea>

						{error && (
							<div className="mx-6 mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive flex-shrink-0">
								{error}
							</div>
						)}

						<div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
							<Button variant="outline" onClick={handleCancelEdit}>
								Cancelar
							</Button>
							<Button onClick={handleSaveFlag}>
								<Check className="h-4 w-4 mr-2" />
								{isCreating ? "Crear" : "Guardar"}
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
