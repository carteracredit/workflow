"use client";
import {
	ThemeProvider as NextThemesProvider,
	type ThemeProviderProps,
} from "next-themes";
import { useEffect, useState } from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			{...props}
		>
			{mounted ? children : null}
		</NextThemesProvider>
	);
}
