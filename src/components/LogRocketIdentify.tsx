"use client";

import { useEffect } from "react";
import LogRocket from "logrocket";

import { useAuthSession } from "@/lib/auth/useAuthSession";

/**
 * Identifies the signed-in user to LogRocket once a session is available, so
 * session replays can be linked back to the user. Renders nothing — safe to
 * mount even when LogRocket hasn't been initialized (calls are queued/no-op).
 */
export function LogRocketIdentify() {
	const { data: session } = useAuthSession();

	useEffect(() => {
		if (!session) return;
		const { user } = session;
		LogRocket.identify(user.id, {
			name: user.name ?? "",
			email: user.email ?? "",
			role: user.role ?? "",
		});
	}, [session]);

	return null;
}
