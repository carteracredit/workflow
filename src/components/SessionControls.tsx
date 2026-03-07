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
import { LanguageSwitcher, ThemeSwitcher } from "@algenium/blocks";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import { getAuthAppUrl } from "@/lib/auth/config";
import { logout } from "@/lib/auth/actions";
import { User, LogOut } from "lucide-react";

const languages = [
	{ key: "en", label: "EN", nativeName: "English" },
	{ key: "es", label: "ES", nativeName: "Español" },
];

function LanguageSwitcherWrapper() {
	const { t, language, setLanguage } = useLanguage();
	return (
		<LanguageSwitcher
			languages={languages}
			currentLanguage={language}
			onLanguageChange={(key) => setLanguage(key as "en" | "es")}
			labels={{ language: t("languageToggle") }}
			showIcon
		/>
	);
}

function ThemeSwitcherWrapper() {
	const { t } = useLanguage();
	return (
		<ThemeSwitcher
			labels={{
				theme: t("themeToggle"),
				light: t("themeLight"),
				dark: t("themeDark"),
				system: t("themeSystem"),
			}}
		/>
	);
}

function UserMenu() {
	const { data: session } = useAuthSession();
	const { t } = useLanguage();

	const handleLogout = async () => {
		await logout();
	};

	if (!session) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-10 w-10 rounded-full">
					<Avatar className="h-10 w-10">
						<AvatarImage
							src={session.user.image || undefined}
							alt={session.user.name}
						/>
						<AvatarFallback>
							{session.user.name
								?.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				<div className="flex items-center gap-2 p-2">
					<Avatar className="h-8 w-8">
						<AvatarImage
							src={session.user.image || undefined}
							alt={session.user.name}
						/>
						<AvatarFallback>
							{session.user.name
								?.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase() || "U"}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col space-y-0.5">
						<p className="text-sm font-medium">{session.user.name}</p>
						<p className="text-xs text-muted-foreground">
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
					className="flex cursor-pointer items-center gap-2 text-destructive"
				>
					<LogOut className="h-4 w-4" />
					{t("userLogout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Shared session controls bar: language switcher, theme switcher, user menu.
 * Used in both the editor top-bar and the workflow list header.
 */
export function SessionControls({ className }: { className?: string }) {
	return (
		<div className={cn("flex items-center gap-1", className)}>
			<LanguageSwitcherWrapper />
			<ThemeSwitcherWrapper />
			<UserMenu />
		</div>
	);
}
