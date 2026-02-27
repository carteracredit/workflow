import type { Preview } from "@storybook/react";
import { ReactNode, useEffect } from "react";
import { useTheme } from "next-themes";

import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import "../src/app/globals.css";

type ThemeOption = "light" | "dark" | "system";

const ThemeSync = ({
	theme,
	children,
}: {
	theme: ThemeOption;
	children: ReactNode;
}) => {
	const { setTheme } = useTheme();

	useEffect(() => {
		setTheme(theme);
	}, [theme, setTheme]);

	return <>{children}</>;
};

export const globalTypes = {
	theme: {
		description: "Global theme for components (light/dark)",
		defaultValue: "system",
		toolbar: {
			icon: "mirror",
			items: [
				{ value: "system", title: "System" },
				{ value: "light", title: "Light" },
				{ value: "dark", title: "Dark" },
			],
			dynamicTitle: true,
		},
	},
};

const preview: Preview = {
	parameters: {
		actions: { argTypesRegex: "^on[A-Z].*" },
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		backgrounds: {
			default: "app",
			values: [{ name: "app", value: "transparent" }],
		},
		// All components in this app use the Next.js App Router (next/navigation).
		// This ensures @storybook/nextjs calls createNavigation() instead of
		// createRouter(), so useRouter() mocks are available in every story.
		nextjs: {
			appDirectory: true,
		},
	},
	decorators: [
		(Story, context) => {
			const theme =
				(context.globals.theme as ThemeOption | undefined) ?? "system";

			return (
				<LanguageProvider defaultLanguage="es">
					<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
						<ThemeSync theme={theme}>
							<div className="min-h-screen bg-background text-foreground p-6">
								<Story />
							</div>
						</ThemeSync>
					</ThemeProvider>
				</LanguageProvider>
			);
		},
	],
};

export default preview;
