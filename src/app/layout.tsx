import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SessionHydrator } from "@/lib/auth/useAuthSession";
import { getServerSession } from "@/lib/auth/getServerSession";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogRocketIdentify } from "@/components/LogRocketIdentify";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Cartera Workflow",
	description: "Workflow Editor - Workflow Integration Platform",
	icons: {
		icon: [
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
		],
		apple: "/apple-touch-icon.png",
	},
	manifest: "/site.webmanifest",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await getServerSession();

	return (
		<html lang="es" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<ThemeProvider>
					<LanguageProvider>
						<TooltipProvider delayDuration={300}>
							<SessionHydrator serverSession={session}>
								<LogRocketIdentify />
								{children}
							</SessionHydrator>
						</TooltipProvider>
					</LanguageProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
