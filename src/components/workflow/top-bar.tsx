"use client";

import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarSub,
	MenubarSubContent,
	MenubarSubTrigger,
	MenubarTrigger,
} from "@/components/ui/menubar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { SessionControls } from "@/components/SessionControls";
import {
	Save,
	Upload,
	Download,
	HelpCircle,
	FolderOpen,
	Rocket,
	RefreshCw,
	Trash2,
	Flag,
	Settings,
	MoreVertical,
	Bell,
	Pencil,
	Keyboard,
	ArrowLeft,
	Loader2,
	Variable,
} from "lucide-react";
import type { WorkflowMetadata, WorkflowNode } from "@/lib/workflow/types";
import { Palette } from "@/components/workflow/palette";
import { useLanguage } from "@/components/LanguageProvider";

type ShortcutDefinition = {
	labelKey: string;
	mac: string[];
	win: string[];
	altWin?: string[];
	description?: string;
	categoryKey: string;
};

const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
	// Barra superior - Acciones principales
	{
		labelKey: "topBar.shortcutSaveWorkflow",
		mac: ["⌘", "S"],
		win: ["Ctrl", "S"],
		categoryKey: "topBar.shortcutsCategoryTop",
	},
	{
		labelKey: "topBar.shortcutResetFlow",
		mac: ["⌘", "⇧", "R"],
		win: ["Ctrl", "⇧", "R"],
		categoryKey: "topBar.shortcutsCategoryTop",
	},
	{
		labelKey: "topBar.shortcutValidate",
		mac: ["⌘", "⇧", "V"],
		win: ["Ctrl", "⇧", "V"],
		categoryKey: "topBar.shortcutsCategoryTop",
	},
	{
		labelKey: "topBar.shortcutPreview",
		mac: ["⌘", "P"],
		win: ["Ctrl", "P"],
		categoryKey: "topBar.shortcutsCategoryTop",
	},
	// Barra inferior - Herramientas de canvas
	{
		labelKey: "topBar.shortcutPanTool",
		mac: ["Space"],
		win: ["Space"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutSelectTool",
		mac: ["V"],
		win: ["V"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutUndo",
		mac: ["⌘", "Z"],
		win: ["Ctrl", "Z"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutRedo",
		mac: ["⌘", "Y"],
		win: ["Ctrl", "Y"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutCopySelection",
		mac: ["⌘", "C"],
		win: ["Ctrl", "C"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutPasteSelection",
		mac: ["⌘", "V"],
		win: ["Ctrl", "V"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutZoomIn",
		mac: ["2"],
		win: ["2"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutZoomOut",
		mac: ["1"],
		win: ["1"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	{
		labelKey: "topBar.shortcutFitView",
		mac: ["F"],
		win: ["F"],
		categoryKey: "topBar.shortcutsCategoryBottom",
	},
	// Herramientas - Acciones adicionales
	{
		labelKey: "topBar.shortcutPublish",
		mac: ["⌘", "⇧", "P"],
		win: ["Ctrl", "⇧", "P"],
		categoryKey: "topBar.shortcutsCategoryTools",
	},
	{
		labelKey: "topBar.shortcutExportJson",
		mac: ["⌘", "E"],
		win: ["Ctrl", "E"],
		categoryKey: "topBar.shortcutsCategoryTools",
	},
	{
		labelKey: "topBar.shortcutImportJson",
		mac: ["⌘", "I"],
		win: ["Ctrl", "I"],
		categoryKey: "topBar.shortcutsCategoryTools",
	},
	{
		labelKey: "topBar.shortcutManageFlags",
		mac: ["⌘", "⇧", "F"],
		win: ["Ctrl", "⇧", "F"],
		categoryKey: "topBar.shortcutsCategoryTools",
	},
	{
		labelKey: "topBar.shortcutFlowProperties",
		mac: ["⌘", ","],
		win: ["Ctrl", ","],
		categoryKey: "topBar.shortcutsCategoryTools",
	},
];

interface TopBarProps {
	onNew: () => void;
	onSave: () => void | Promise<void>;
	onPublish: () => void;
	onExportJSON: () => void;
	onImportJSON: () => void;
	onLoadExample: (key: "basic" | "api" | "manual") => void;
	onManageFlags: () => void;
	onManageVariables: () => void;
	onToggleWorkflowProperties: () => void;
	workflowMetadata: WorkflowMetadata;
	/** If provided, show a back-to-list button */
	onBack?: () => void;
	/** Current workflow lifecycle status (draft / published / archived) */
	workflowStatus?: "draft" | "published" | "archived";
	/** Authoritative major version from the API — overrides metadata.version display */
	currentMajorVersion?: number;
	paletteProps?: {
		onAddNode: (node: WorkflowNode) => void;
		zoom: number;
		pan: { x: number; y: number };
	};
	/** Whether a save operation is in progress */
	isSaving?: boolean;
}

export function TopBar({
	onNew,
	onSave,
	onPublish,
	onExportJSON,
	onImportJSON,
	onLoadExample,
	onManageFlags,
	onManageVariables,
	onToggleWorkflowProperties,
	workflowMetadata,
	onBack,
	workflowStatus,
	currentMajorVersion,
	paletteProps,
	isSaving,
}: TopBarProps) {
	const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
	const { t } = useLanguage();

	const displayVersion = (() => {
		// Show version badge only when the workflow has been published at least once
		if (currentMajorVersion !== undefined && currentMajorVersion >= 1) {
			return `v${currentMajorVersion}`;
		}
		return null;
	})();

	return (
		<div className="relative z-50 border-b border-border bg-card/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/70">
			<div className="flex items-center gap-3 min-w-0">
				{onBack && (
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 flex-shrink-0"
						onClick={onBack}
						title={t("topBar.backTitle")}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
				)}
				<div className="min-w-0 flex-shrink-0">
					<div className="flex flex-wrap items-center gap-2">
						<img
							src="/app-icon.svg"
							alt="workflow"
							className="h-6"
							style={{ width: "auto" }}
						/>
						<div className="flex items-center gap-1.5">
							<h1 className="truncate text-base font-semibold text-foreground">
								{workflowMetadata.name || t("topBar.defaultWorkflowName")}
							</h1>
							<Button
								variant="ghost"
								size="icon"
								className="h-5 w-5"
								onClick={onToggleWorkflowProperties}
								title={t("topBar.editNameTitle")}
							>
								<Pencil className="h-3 w-3" />
							</Button>
						</div>
						{displayVersion && (
							<span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-foreground/70">
								{displayVersion}
							</span>
						)}
					</div>
				</div>

				{paletteProps && (
					<div className="relative flex min-w-0 flex-1 items-center">
						{/* Left fade edge */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-card/80 to-transparent"
						/>
						{/*
						 * Two-element centering pattern that avoids the
						 * "justify-center + overflow-x: auto" left-scroll bug:
						 *
						 *  outer  — flex-1, justify-center → centers the inner div
						 *           when the palette fits; never scrolls itself
						 *  inner  — max-w-full, overflow-x-auto → constrained to the
						 *           available width so it can scroll left-to-right
						 *           when the palette is too wide; no justify-center
						 *           so nothing overflows to the left
						 */}
						<div className="flex min-w-0 flex-1 items-center justify-center">
							<div className="max-w-full overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								<Palette
									onAddNode={paletteProps.onAddNode}
									zoom={paletteProps.zoom}
									pan={paletteProps.pan}
									className="flex-nowrap flex-shrink-0"
								/>
							</div>
						</div>
						{/* Right fade edge */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-card/80 to-transparent"
						/>
					</div>
				)}

				<div className="flex flex-shrink-0 items-center justify-end gap-1 sm:gap-2">
					<Button
						variant="ghost"
						size="sm"
						title={t("topBar.notificationsTitle")}
						className="rounded-md bg-muted/50"
					>
						<Bell className="h-4 w-4 text-muted-foreground" />
					</Button>

					<Button
						variant="outline"
						size="sm"
						onClick={onSave}
						disabled={isSaving}
						title={t("topBar.saveTitle")}
						className="gap-2 rounded-md px-3"
					>
						{isSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						<span className="text-sm font-semibold">
							{isSaving ? t("topBar.savingLabel") : t("topBar.saveLabel")}
						</span>
					</Button>

					{workflowStatus === "published" ? (
						<Button
							variant="outline"
							size="sm"
							onClick={onPublish}
							title={t("topBar.updateTitle")}
							className="gap-2 rounded-md border-primary/40 px-3 text-primary hover:border-primary hover:bg-primary/10 hover:text-primary"
						>
							<RefreshCw className="h-4 w-4" />
							<span className="text-sm font-semibold">
								{t("topBar.updateLabel")}
							</span>
						</Button>
					) : (
						<Button
							variant="default"
							size="sm"
							onClick={onPublish}
							title={t("topBar.publishTitle")}
							className="gap-2 rounded-md px-3"
						>
							<Rocket className="h-4 w-4" />
							<span className="text-sm font-semibold">
								{t("topBar.publishLabel")}
							</span>
						</Button>
					)}

					<Menubar className="border-none bg-transparent">
						<MenubarMenu>
							<MenubarTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									title={t("topBar.moreOptionsTitle")}
									className="rounded-md bg-muted/50"
								>
									<MoreVertical className="h-4 w-4 text-muted-foreground" />
								</Button>
							</MenubarTrigger>
							<MenubarContent align="end">
								<MenubarItem onClick={onNew}>
									<Trash2 className="mr-2 h-4 w-4" />
									{t("topBar.menuResetFlow")}
								</MenubarItem>
								<MenubarSub>
									<MenubarSubTrigger>
										<FolderOpen className="mr-2 h-4 w-4" />
										{t("topBar.menuLoadExample")}
									</MenubarSubTrigger>
									<MenubarSubContent>
										<MenubarItem onClick={() => onLoadExample("basic")}>
											{t("topBar.menuExampleBasic")}
										</MenubarItem>
										<MenubarItem onClick={() => onLoadExample("api")}>
											{t("topBar.menuExampleApi")}
										</MenubarItem>
										<MenubarItem onClick={() => onLoadExample("manual")}>
											{t("topBar.menuExampleManual")}
										</MenubarItem>
									</MenubarSubContent>
								</MenubarSub>
								<MenubarItem onClick={onManageFlags}>
									<Flag className="mr-2 h-4 w-4" />
									{t("topBar.menuManageFlags")}
								</MenubarItem>
								<MenubarItem onClick={onManageVariables}>
									<Variable className="mr-2 h-4 w-4" />
									{t("topBar.menuManageVariables")}
								</MenubarItem>
								<MenubarItem onClick={onExportJSON}>
									<Download className="mr-2 h-4 w-4" />
									{t("topBar.menuExportJson")}
								</MenubarItem>
								<MenubarItem onClick={onImportJSON}>
									<Upload className="mr-2 h-4 w-4" />
									{t("topBar.menuImportJson")}
								</MenubarItem>
								<MenubarItem onClick={onToggleWorkflowProperties}>
									<Settings className="mr-2 h-4 w-4" />
									{t("topBar.menuWorkflowProperties")}
								</MenubarItem>
								<MenubarItem>
									<HelpCircle className="mr-2 h-4 w-4" />
									{t("topBar.menuHelp")}
								</MenubarItem>
								<MenubarSeparator />
								<MenubarItem
									onSelect={(e) => {
										e.preventDefault();
										setShortcutsModalOpen(true);
									}}
								>
									<Keyboard className="mr-2 h-4 w-4" />
									{t("topBar.menuShortcuts")}
								</MenubarItem>
							</MenubarContent>
						</MenubarMenu>
					</Menubar>

					<SessionControls />
				</div>
			</div>
			<KeyboardShortcutsModal
				open={shortcutsModalOpen}
				onOpenChange={setShortcutsModalOpen}
			/>
		</div>
	);
}

export function KeyboardShortcutsModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useLanguage();
	const normalizeKeys = (keys: string[]) =>
		keys.map((k) => (k === "Shift" ? "⇧" : k));

	const renderShortcutRow = (shortcut: ShortcutDefinition) => {
		const macNormalized = normalizeKeys(shortcut.mac);
		const winNormalized = normalizeKeys(shortcut.win);
		const areIdentical =
			JSON.stringify(macNormalized) === JSON.stringify(winNormalized);
		const macRest = macNormalized.slice(1);
		const canMerge =
			!areIdentical &&
			macNormalized[0] === "⌘" &&
			winNormalized[0] === "Ctrl" &&
			JSON.stringify(macRest) === JSON.stringify(winNormalized.slice(1));

		return (
			<div
				key={shortcut.labelKey}
				className="flex items-center justify-between gap-6 py-1.5"
			>
				<span className="text-sm text-foreground/90 flex-shrink-0 min-w-[160px]">
					{t(shortcut.labelKey)}
				</span>
				<div className="flex items-center gap-1.5 flex-shrink-0">
					{areIdentical ? (
						<ShortcutKeys keys={macNormalized} />
					) : canMerge ? (
						<>
							<kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-md border border-border/40 bg-muted/80 text-xs font-semibold text-foreground shadow-sm">
								⌘
							</kbd>
							<span className="text-xs text-muted-foreground/60 mx-1">/</span>
							<span className="text-xs font-medium text-foreground/90">
								Ctrl
							</span>
							{macRest.length > 0 && (
								<>
									<span className="text-xs text-muted-foreground/60 mx-1">
										+
									</span>
									<ShortcutKeys keys={macRest} />
								</>
							)}
						</>
					) : (
						<>
							<ShortcutKeys keys={macNormalized} />
							<span className="text-xs text-muted-foreground/50 mx-1">/</span>
							<ShortcutKeys keys={winNormalized} />
						</>
					)}
				</div>
			</div>
		);
	};

	const barraSuperior = KEYBOARD_SHORTCUTS.filter(
		(shortcut) => shortcut.categoryKey === "topBar.shortcutsCategoryTop",
	);
	const barraInferior = KEYBOARD_SHORTCUTS.filter(
		(shortcut) => shortcut.categoryKey === "topBar.shortcutsCategoryBottom",
	);
	const herramientas = KEYBOARD_SHORTCUTS.filter(
		(shortcut) => shortcut.categoryKey === "topBar.shortcutsCategoryTools",
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-[1400px] sm:!max-w-[1400px] w-[90vw] h-auto max-h-none flex flex-col p-0 gap-0">
				<DialogHeader className="px-8 pt-5 pb-4 border-b flex-shrink-0">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<Keyboard className="h-5 w-5" />
						{t("topBar.shortcutsTitle")}
					</DialogTitle>
				</DialogHeader>

				<div className="px-10 py-6">
					<div className="grid grid-cols-3 gap-x-12 gap-y-0">
						{/* Columna 1: Barra Superior */}
						<div className="flex flex-col gap-1.5">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
								{t("topBar.shortcutsCategoryTop")}
							</h3>
							{barraSuperior.map(renderShortcutRow)}
						</div>

						{/* Columna 2: Barra Inferior */}
						<div className="flex flex-col gap-1.5">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
								{t("topBar.shortcutsCategoryBottom")}
							</h3>
							{barraInferior.map(renderShortcutRow)}
						</div>

						{/* Columna 3: Herramientas */}
						<div className="flex flex-col gap-1.5">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
								{t("topBar.shortcutsCategoryTools")}
							</h3>
							{herramientas.map(renderShortcutRow)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ShortcutKeys({ keys }: { keys: string[] }) {
	return (
		<div className="flex items-center gap-1">
			{keys.map((key, index) => (
				<Fragment key={`${key}-${index}`}>
					<kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-md border border-border/40 bg-muted/80 text-xs font-semibold text-foreground shadow-sm">
						{key}
					</kbd>
					{index < keys.length - 1 && (
						<span className="text-xs text-muted-foreground/60 mx-0.5">+</span>
					)}
				</Fragment>
			))}
		</div>
	);
}
