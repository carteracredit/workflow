"use client";

import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import { getAuthAppUrl } from "@/lib/auth/config";
import { logout } from "@/lib/auth/actions";
import { User, LogOut, Globe, Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";

// ---------------------------------------------------------------------------
// Compact language picker
// ---------------------------------------------------------------------------

const LANGUAGES = [
	{ key: "en", label: "EN", nativeName: "English" },
	{ key: "es", label: "ES", nativeName: "Español" },
];

function CompactLanguageSwitcher() {
	const { language, setLanguage } = useLanguage();
	const current = LANGUAGES.find((l) => l.key === language) ?? LANGUAGES[0];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 gap-1.5 rounded-md px-2 font-medium text-muted-foreground hover:text-foreground"
				>
					<Globe className="h-3.5 w-3.5 shrink-0" />
					<span className="text-xs font-semibold tracking-wide">
						{current.label}
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-36">
				{LANGUAGES.map((lang) => (
					<DropdownMenuItem
						key={lang.key}
						onClick={() => setLanguage(lang.key as "en" | "es")}
						className="flex items-center justify-between gap-2"
					>
						<div className="flex items-center gap-2">
							<Globe className="h-3.5 w-3.5 text-muted-foreground" />
							<span>{lang.nativeName}</span>
						</div>
						{language === lang.key && (
							<Check className="h-3.5 w-3.5 text-primary" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ---------------------------------------------------------------------------
// Compact theme picker
// ---------------------------------------------------------------------------

const THEMES = [
	{ value: "light", icon: Sun, label: "Light" },
	{ value: "dark", icon: Moon, label: "Dark" },
	{ value: "system", icon: Monitor, label: "System" },
] as const;

function CompactThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const current =
		THEMES.find((t) => t.value === theme) ??
		THEMES.find((t) => t.value === "system")!;
	const CurrentIcon = current.icon;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground"
					aria-label="Theme"
				>
					<CurrentIcon className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-36">
				{THEMES.map(({ value, icon: Icon, label }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => setTheme(value)}
						className="flex items-center justify-between gap-2"
					>
						<div className="flex items-center gap-2">
							<Icon className="h-3.5 w-3.5 text-muted-foreground" />
							<span>{label}</span>
						</div>
						{theme === value && <Check className="h-3.5 w-3.5 text-primary" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ---------------------------------------------------------------------------
// User / avatar menu
// ---------------------------------------------------------------------------

function UserMenu() {
	const { data: session } = useAuthSession();
	const { t } = useLanguage();

	const handleLogout = async () => {
		await logout();
	};

	if (!session) return null;

	const initials =
		session.user.name
			?.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase() || "U";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 rounded-full p-0"
					data-private
				>
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={session.user.image || undefined}
							alt={session.user.name}
						/>
						<AvatarFallback className="text-xs font-semibold">
							{initials}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-56"
				align="end"
				sideOffset={6}
				data-private
			>
				{/* User info header */}
				<div className="flex items-center gap-3 px-3 py-2.5">
					<Avatar className="h-9 w-9 shrink-0">
						<AvatarImage
							src={session.user.image || undefined}
							alt={session.user.name}
						/>
						<AvatarFallback className="text-sm font-semibold">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold leading-none">
							{session.user.name}
						</p>
						<p className="mt-1 truncate text-xs text-muted-foreground">
							{session.user.email}
						</p>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<a
						href={`${getAuthAppUrl()}/settings`}
						className="flex cursor-pointer items-center gap-2"
					>
						<User className="h-4 w-4" />
						{t("userAccount")}
					</a>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleLogout}
					className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive [&_svg]:text-destructive"
				>
					<LogOut className="h-4 w-4" />
					{t("userLogout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ---------------------------------------------------------------------------
// Exported composed bar
// ---------------------------------------------------------------------------

/**
 * Shared session controls bar: language switcher, theme switcher, user menu.
 * Used in both the editor top-bar and the workflow list header.
 */
export function SessionControls({ className }: { className?: string }) {
	return (
		<div className={cn("flex items-center gap-0.5", className)}>
			<CompactLanguageSwitcher />
			<CompactThemeSwitcher />
			<UserMenu />
		</div>
	);
}
