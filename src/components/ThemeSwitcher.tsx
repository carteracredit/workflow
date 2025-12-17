"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<Button variant="ghost" size="icon" className="h-9 w-9">
				<Monitor className="h-4 w-4" />
			</Button>
		);
	}

	const getThemeIcon = () => {
		if (theme === "light") return <Sun className="h-4 w-4" />;
		if (theme === "dark") return <Moon className="h-4 w-4" />;
		return <Monitor className="h-4 w-4" />;
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 rounded-md border border-border/70 bg-card hover:bg-accent"
					title="Cambiar tema"
				>
					{getThemeIcon()}
					<span className="sr-only">Cambiar tema</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-auto min-w-[36px] p-0.5">
				<DropdownMenuRadioGroup
					value={theme || "system"}
					onValueChange={(value) => setTheme(value)}
				>
					<DropdownMenuRadioItem
						value="system"
						className="cursor-pointer flex items-center justify-center w-9 h-9 p-0 pl-0 pr-0 rounded-md [&>span:first-child]:hidden data-[state=checked]:bg-accent/80"
					>
						<Monitor className="h-4 w-4" />
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem
						value="light"
						className="cursor-pointer flex items-center justify-center w-9 h-9 p-0 pl-0 pr-0 rounded-md [&>span:first-child]:hidden data-[state=checked]:bg-accent/80"
					>
						<Sun className="h-4 w-4" />
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem
						value="dark"
						className="cursor-pointer flex items-center justify-center w-9 h-9 p-0 pl-0 pr-0 rounded-md [&>span:first-child]:hidden data-[state=checked]:bg-accent/80"
					>
						<Moon className="h-4 w-4" />
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
