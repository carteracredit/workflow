"use client";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function ClientLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <ThemeProvider>{children}</ThemeProvider>;
}
