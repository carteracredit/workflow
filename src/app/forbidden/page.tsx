"use client";

import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { logout } from "@/lib/auth/actions";
import { getAuthAppUrl } from "@/lib/auth/config";

export default function ForbiddenPage() {
	const handleLogout = async () => {
		await logout();
	};

	const handleGoBack = () => {
		// Navigate to the main public site or auth app
		const authAppUrl = getAuthAppUrl();
		window.location.href = authAppUrl;
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
						<ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
					</div>
					<CardTitle className="text-2xl">Acceso Denegado</CardTitle>
					<CardDescription className="text-base">
						No tienes permisos para acceder a la consola de flujos de trabajo
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground text-center">
						Esta área está restringida únicamente a usuarios con rol de
						administrador. Si crees que deberías tener acceso, contacta al
						administrador del sistema.
					</p>
					<div className="flex flex-col gap-2">
						<Button onClick={handleGoBack} variant="outline" className="w-full">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Volver al inicio
						</Button>
						<Button
							onClick={handleLogout}
							variant="ghost"
							className="w-full text-muted-foreground"
						>
							<LogOut className="mr-2 h-4 w-4" />
							Cerrar sesión
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
