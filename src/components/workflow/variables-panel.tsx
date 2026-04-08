"use client";

import { useState, useCallback, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
	AlertTriangle,
	CloudUpload,
	Eye,
	EyeOff,
	KeyRound,
	Lock,
	Loader2,
	Plus,
	RotateCcw,
	Trash2,
	Variable,
} from "lucide-react";
import type { WorkflowVariable } from "@/lib/workflow-api/variables";
import {
	listVariables,
	createVariable,
	updateVariable,
	deleteVariable,
	rotateSecret,
	syncAllVariables,
} from "@/lib/workflow-api/variables";
import { extractApiErrorMessage } from "@/lib/workflow-api/http";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VariableFormData = {
	name: string;
	value: string;
	is_secret: boolean;
	environment: "all" | "development" | "production";
	description: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

const RESERVED_NAMES = new Set([
	"WORKFLOW_SVC",
	"WORKFLOW_ID",
	"CASES_SVC",
	"NOTIFICATIONS_SERVICE",
	"AUTH_SERVICE",
	"ENVIRONMENT",
	"WORKFLOW_VERSION",
	"WORKFLOW",
	"DB",
	"KV",
]);

function validateName(name: string): string | null {
	if (!name) return "variablesPanel.validationNameRequired";
	if (!UPPER_SNAKE_CASE.test(name))
		return "variablesPanel.validationNameFormat";
	if (RESERVED_NAMES.has(name)) return "variablesPanel.validationNameReserved";
	return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EnvironmentBadge({ env }: { env: string }) {
	const colors: Record<string, string> = {
		all: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
		development:
			"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
		production:
			"bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
	};
	const label = env === "all" ? "All" : env === "development" ? "Dev" : "Prod";
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[env] ?? colors.all}`}
		>
			{label}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Variables Panel
// ---------------------------------------------------------------------------

export interface VariablesPanelProps {
	workflowId: string;
	jwt?: string;
	onClose: () => void;
}

export function VariablesPanel({
	workflowId,
	jwt,
	onClose,
}: VariablesPanelProps) {
	const { t } = useLanguage();

	const [variables, setVariables] = useState<WorkflowVariable[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [editingVar, setEditingVar] = useState<WorkflowVariable | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [rotatingVar, setRotatingVar] = useState<WorkflowVariable | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [showSecretValue, setShowSecretValue] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [form, setForm] = useState<VariableFormData>({
		name: "",
		value: "",
		is_secret: false,
		environment: "all",
		description: "",
	});

	const [rotateValue, setRotateValue] = useState("");
	const [rotateShowValue, setRotateShowValue] = useState(false);
	const [isRotating, setIsRotating] = useState(false);

	// -- Sync all to Cloudflare state --
	const [showSyncPanel, setShowSyncPanel] = useState(false);
	const [syncSecretInputs, setSyncSecretInputs] = useState<
		Record<string, string>
	>({});
	const [isSyncing, setIsSyncing] = useState(false);

	const loadVariables = useCallback(async () => {
		setIsLoading(true);
		try {
			const vars = await listVariables(workflowId, { jwt });
			setVariables(vars);
		} catch (err) {
			console.error("[VariablesPanel] Failed to load variables", err);
		} finally {
			setIsLoading(false);
		}
	}, [workflowId, jwt]);

	useEffect(() => {
		void loadVariables();
	}, [loadVariables]);

	const resetForm = () => {
		setForm({
			name: "",
			value: "",
			is_secret: false,
			environment: "all",
			description: "",
		});
		setFormError(null);
		setShowSecretValue(false);
	};

	const handleCreate = () => {
		resetForm();
		setEditingVar(null);
		setShowCreateForm(true);
	};

	const handleCreateSecret = () => {
		resetForm();
		setForm((f) => ({ ...f, is_secret: true }));
		setEditingVar(null);
		setShowCreateForm(true);
	};

	const handleEdit = (v: WorkflowVariable) => {
		setForm({
			name: v.name,
			value: v.value ?? "",
			is_secret: v.is_secret,
			environment: v.environment,
			description: v.description ?? "",
		});
		setEditingVar(v);
		setShowCreateForm(true);
		setFormError(null);
	};

	const handleSave = async () => {
		const nameKey = validateName(form.name);
		if (nameKey) {
			setFormError(t(nameKey as Parameters<typeof t>[0]));
			return;
		}

		setIsSaving(true);
		try {
			if (editingVar) {
				const updated = await updateVariable(
					workflowId,
					editingVar.id,
					{
						value: form.is_secret ? undefined : form.value || undefined,
						environment: form.environment,
						description: form.description || undefined,
					},
					{ jwt },
				);
				setVariables((prev) =>
					prev.map((v) => (v.id === editingVar.id ? updated : v)),
				);
				toast.success(t("variablesPanel.toastUpdated"));
			} else {
				const created = await createVariable(
					workflowId,
					{
						name: form.name,
						value: form.is_secret ? undefined : form.value || undefined,
						is_secret: form.is_secret,
						environment: form.environment,
						description: form.description || undefined,
					},
					{ jwt },
				);
				setVariables((prev) => [...prev, created]);
				toast.success(t("variablesPanel.toastCreated"));
			}
			setShowCreateForm(false);
			resetForm();
			setEditingVar(null);
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			toast.error(t("variablesPanel.toastError"), { description: msg });
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (v: WorkflowVariable) => {
		setDeletingId(v.id);
		try {
			await deleteVariable(workflowId, v.id, { jwt });
			setVariables((prev) => prev.filter((x) => x.id !== v.id));
			toast.success(t("variablesPanel.toastDeleted"));
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			toast.error(t("variablesPanel.toastDeleteError"), { description: msg });
		} finally {
			setDeletingId(null);
		}
	};

	const handleRotate = (v: WorkflowVariable) => {
		setRotatingVar(v);
		setRotateValue("");
		setRotateShowValue(false);
	};

	const handleRotateConfirm = async () => {
		if (!rotatingVar || !rotateValue) return;
		setIsRotating(true);
		try {
			const result = await rotateSecret(
				workflowId,
				{ name: rotatingVar.name, value: rotateValue },
				{ jwt },
			);
			const count = result.synced.length;
			toast.success(
				t("variablesPanel.rotateSuccess").replace("{n}", String(count)),
			);
			setRotatingVar(null);
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			toast.error(t("variablesPanel.rotateError"), { description: msg });
		} finally {
			setIsRotating(false);
		}
	};

	const handleSyncAll = async () => {
		setIsSyncing(true);
		try {
			const result = await syncAllVariables(
				workflowId,
				{ secretValues: syncSecretInputs },
				{ jwt },
			);
			if (result.synced.length === 0 && result.failed.length === 0) {
				toast.info(t("variablesPanel.syncSuccessNoDeployments"));
			} else if (result.failed.length > 0) {
				toast.error(t("variablesPanel.syncError"), {
					description: `Failed: ${result.failed.join(", ")}`,
				});
			} else {
				toast.success(
					t("variablesPanel.syncSuccess")
						.replace("{n}", String(result.variableCount))
						.replace("{w}", String(result.synced.length)),
				);
			}
			setShowSyncPanel(false);
			setSyncSecretInputs({});
		} catch (err) {
			const msg = extractApiErrorMessage(err);
			toast.error(t("variablesPanel.syncError"), { description: msg });
		} finally {
			setIsSyncing(false);
		}
	};

	const hasDraftChanges = variables.length > 0;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-full max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Variable className="h-5 w-5" />
						{t("variablesPanel.title")}
					</DialogTitle>
					<DialogDescription>{t("variablesPanel.subtitle")}</DialogDescription>
				</DialogHeader>

				{/* Draft banner */}
				<Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
					<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
					<AlertDescription className="text-amber-800 dark:text-amber-300">
						{t("variablesPanel.draftBanner")}
					</AlertDescription>
				</Alert>

				{/* Header actions */}
				<div className="flex items-center justify-between">
					{hasDraftChanges && (
						<Badge
							variant="outline"
							className="text-amber-600 border-amber-300"
						>
							{t("variablesPanel.pendingBadge")}
						</Badge>
					)}
					<div className="flex gap-2 ml-auto">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setSyncSecretInputs({});
								setShowSyncPanel(true);
							}}
							className="flex items-center gap-1"
						>
							<CloudUpload className="h-4 w-4" />
							{t("variablesPanel.syncButton")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleCreate}
							className="flex items-center gap-1"
						>
							<Plus className="h-4 w-4" />
							{t("variablesPanel.addVariable")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleCreateSecret}
							className="flex items-center gap-1"
						>
							<Lock className="h-4 w-4" />
							{t("variablesPanel.addSecret")}
						</Button>
					</div>
				</div>

				{/* Variables list */}
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
					</div>
				) : variables.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<Variable className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
						<p className="font-medium text-gray-500 dark:text-gray-400">
							{t("variablesPanel.noVarsTitle")}
						</p>
						<p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
							{t("variablesPanel.noVarsDesc")}
						</p>
					</div>
				) : (
					<ScrollArea className="max-h-64">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
									<th className="pb-2 font-medium">
										{t("variablesPanel.columnName")}
									</th>
									<th className="pb-2 font-medium">
										{t("variablesPanel.columnType")}
									</th>
									<th className="pb-2 font-medium">
										{t("variablesPanel.columnEnvironment")}
									</th>
									<th className="pb-2 font-medium">
										{t("variablesPanel.columnValue")}
									</th>
									<th className="pb-2 font-medium" />
								</tr>
							</thead>
							<tbody>
								{variables.map((v) => (
									<tr
										key={v.id}
										className="border-b dark:border-gray-700 last:border-0"
									>
										<td className="py-2 font-mono text-xs font-medium">
											{v.name}
										</td>
										<td className="py-2">
											{v.is_secret ? (
												<span className="inline-flex items-center gap-1 text-xs text-purple-700 dark:text-purple-400">
													<KeyRound className="h-3 w-3" />
													{t("variablesPanel.typeSecret")}
												</span>
											) : (
												<span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
													<Variable className="h-3 w-3" />
													{t("variablesPanel.typeVariable")}
												</span>
											)}
										</td>
										<td className="py-2">
											<EnvironmentBadge env={v.environment} />
										</td>
										<td className="py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
											{v.is_secret ? (
												<span className="text-gray-400 dark:text-gray-500 italic">
													{t("variablesPanel.secretValueMasked")}
												</span>
											) : (
												<span className="block truncate max-w-[140px]">
													{v.value ?? "—"}
												</span>
											)}
										</td>
										<td className="py-2">
											<div className="flex items-center gap-1 justify-end">
												{v.is_secret && (
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7"
														title={t("variablesPanel.rotateSecretTitle")}
														onClick={() => handleRotate(v)}
													>
														<RotateCcw className="h-3.5 w-3.5" />
													</Button>
												)}
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7"
													title={t("variablesPanel.editTitle")}
													onClick={() => handleEdit(v)}
												>
													<Variable className="h-3.5 w-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-red-500 hover:text-red-600"
													title={t("variablesPanel.deleteTitle")}
													disabled={deletingId === v.id}
													onClick={() => {
														if (
															window.confirm(
																t("variablesPanel.deleteConfirmBody").replace(
																	"{name}",
																	v.name,
																),
															)
														) {
															void handleDelete(v);
														}
													}}
												>
													{deletingId === v.id ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<Trash2 className="h-3.5 w-3.5" />
													)}
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</ScrollArea>
				)}

				{/* Create / Edit form */}
				{showCreateForm && (
					<div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 space-y-3">
						<h3 className="font-medium text-sm">
							{editingVar
								? t("variablesPanel.editTitle")
								: form.is_secret
									? t("variablesPanel.createSecretTitle")
									: t("variablesPanel.createTitle")}
						</h3>

						{/* Name */}
						<div className="space-y-1">
							<Label className="text-xs">{t("variablesPanel.nameLabel")}</Label>
							<Input
								placeholder={t("variablesPanel.namePlaceholder")}
								value={form.name}
								disabled={!!editingVar}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										name: e.target.value
											.toUpperCase()
											.replace(/[^A-Z0-9_]/g, "_"),
									}))
								}
								className="font-mono text-sm"
							/>
						</div>

						{/* is_secret toggle (only when creating) */}
						{!editingVar && (
							<div className="flex items-center gap-2">
								<Switch
									id="is-secret"
									checked={form.is_secret}
									onCheckedChange={(checked) =>
										setForm((f) => ({ ...f, is_secret: checked }))
									}
								/>
								<Label htmlFor="is-secret" className="text-xs cursor-pointer">
									{t("variablesPanel.isSecretLabel")}
								</Label>
							</div>
						)}

						{/* Value (non-secret only) */}
						{!form.is_secret && (
							<div className="space-y-1">
								<Label className="text-xs">
									{t("variablesPanel.valueLabel")}
								</Label>
								<Input
									placeholder={t("variablesPanel.valuePlaceholder")}
									value={form.value}
									onChange={(e) =>
										setForm((f) => ({ ...f, value: e.target.value }))
									}
									className="text-sm"
								/>
							</div>
						)}

						{/* Secret value (only when creating new secret) */}
						{form.is_secret && !editingVar && (
							<div className="space-y-1">
								<Label className="text-xs">
									{t("variablesPanel.secretValueLabel")}
								</Label>
								<div className="relative">
									<Input
										type={showSecretValue ? "text" : "password"}
										placeholder={t("variablesPanel.secretValuePlaceholder")}
										value={form.value}
										onChange={(e) =>
											setForm((f) => ({ ...f, value: e.target.value }))
										}
										className="pr-9 text-sm"
									/>
									<button
										type="button"
										className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
										onClick={() => setShowSecretValue((s) => !s)}
									>
										{showSecretValue ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400">
									{t("variablesPanel.secretValueHelp")}
								</p>
							</div>
						)}

						{/* Environment */}
						<div className="space-y-1">
							<Label className="text-xs">
								{t("variablesPanel.environmentLabel")}
							</Label>
							<Select
								value={form.environment}
								onValueChange={(val) =>
									setForm((f) => ({
										...f,
										environment: val as "all" | "development" | "production",
									}))
								}
							>
								<SelectTrigger className="text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">
										{t("variablesPanel.envAll")}
									</SelectItem>
									<SelectItem value="development">
										{t("variablesPanel.envDevelopment")}
									</SelectItem>
									<SelectItem value="production">
										{t("variablesPanel.envProduction")}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Description */}
						<div className="space-y-1">
							<Label className="text-xs">
								{t("variablesPanel.descriptionLabel")}
							</Label>
							<Input
								placeholder={t("variablesPanel.descriptionPlaceholder")}
								value={form.description}
								onChange={(e) =>
									setForm((f) => ({ ...f, description: e.target.value }))
								}
								className="text-sm"
							/>
						</div>

						{formError && <p className="text-xs text-red-500">{formError}</p>}

						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setShowCreateForm(false);
									setEditingVar(null);
									resetForm();
								}}
							>
								{t("variablesPanel.cancel")}
							</Button>
							<Button size="sm" disabled={isSaving} onClick={handleSave}>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									t("variablesPanel.save")
								)}
							</Button>
						</div>
					</div>
				)}

				{/* Rotate secret panel */}
				{rotatingVar && (
					<div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-950/30 space-y-3">
						<h3 className="font-medium text-sm flex items-center gap-2">
							<RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
							{t("variablesPanel.rotateSecretTitle")}
						</h3>
						<p className="text-xs text-gray-600 dark:text-gray-400">
							{t("variablesPanel.rotateSecretDesc")}
						</p>
						<Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
							<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
							<AlertDescription className="text-xs text-red-700 dark:text-red-300">
								{t("variablesPanel.rotateSecretWarning")}
							</AlertDescription>
						</Alert>
						<p className="text-xs font-mono font-medium">{rotatingVar.name}</p>
						<div className="space-y-1">
							<Label className="text-xs">
								{t("variablesPanel.rotateNewValueLabel")}
							</Label>
							<div className="relative">
								<Input
									type={rotateShowValue ? "text" : "password"}
									placeholder={t("variablesPanel.secretValuePlaceholder")}
									value={rotateValue}
									onChange={(e) => setRotateValue(e.target.value)}
									className="pr-9 text-sm"
								/>
								<button
									type="button"
									className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
									onClick={() => setRotateShowValue((s) => !s)}
								>
									{rotateShowValue ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setRotatingVar(null)}
							>
								{t("variablesPanel.cancel")}
							</Button>
							<Button
								size="sm"
								variant="destructive"
								disabled={isRotating || !rotateValue}
								onClick={handleRotateConfirm}
							>
								{isRotating ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									t("variablesPanel.rotateConfirm")
								)}
							</Button>
						</div>
					</div>
				)}

				{/* Sync all to Cloudflare panel */}
				{showSyncPanel && (
					<div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
						<h3 className="font-medium text-sm flex items-center gap-2">
							<CloudUpload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
							{t("variablesPanel.syncTitle")}
						</h3>
						<p className="text-xs text-gray-600 dark:text-gray-400">
							{t("variablesPanel.syncDesc")}
						</p>
						{variables.filter((v) => v.is_secret).length > 0 && (
							<>
								<p className="text-xs font-medium text-gray-700 dark:text-gray-300">
									{t("variablesPanel.syncSecretsNote")}
								</p>
								{variables
									.filter((v) => v.is_secret)
									.map((secret) => (
										<div key={secret.id} className="space-y-1">
											<Label className="text-xs font-mono">{secret.name}</Label>
											<Input
												type="password"
												placeholder="••••••••"
												value={syncSecretInputs[secret.name] ?? ""}
												onChange={(e) =>
													setSyncSecretInputs((prev) => ({
														...prev,
														[secret.name]: e.target.value,
													}))
												}
												className="text-sm"
											/>
										</div>
									))}
							</>
						)}
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setShowSyncPanel(false);
									setSyncSecretInputs({});
								}}
							>
								{t("variablesPanel.cancel")}
							</Button>
							<Button size="sm" disabled={isSyncing} onClick={handleSyncAll}>
								{isSyncing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<>
										<CloudUpload className="h-4 w-4 mr-1" />
										{t("variablesPanel.syncConfirm")}
									</>
								)}
							</Button>
						</div>
					</div>
				)}

				<div className="flex justify-end">
					<Button variant="outline" onClick={onClose}>
						{t("variablesPanel.close")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
