import { describe, it, expect, beforeEach } from "vitest";
import {
	sessionStore,
	setSession,
	clearSession,
	setSessionPending,
	setSessionError,
} from "./sessionStore";
import type { Session } from "./types";

describe("sessionStore", () => {
	const mockSession: NonNullable<Session> = {
		user: {
			id: "u1",
			name: "Admin User",
			email: "admin@test.com",
			image: null,
			emailVerified: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			role: "admin",
		},
		session: {
			id: "s1",
			userId: "u1",
			token: "token",
			expiresAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	};

	const mockNonAdminSession: NonNullable<Session> = {
		...mockSession,
		user: { ...mockSession.user, role: "user" },
	};

	beforeEach(() => {
		clearSession();
	});

	describe("setSession", () => {
		it("sets session data and isAdmin true when user has admin role", () => {
			setSession(mockSession);
			const state = sessionStore.get();
			expect(state.data).toEqual(mockSession);
			expect(state.isPending).toBe(false);
			expect(state.error).toBeNull();
			expect(state.isAdmin).toBe(true);
		});

		it("sets isAdmin false when user does not have admin role", () => {
			setSession(mockNonAdminSession);
			const state = sessionStore.get();
			expect(state.isAdmin).toBe(false);
		});

		it("sets isAdmin false when session is null", () => {
			setSession(null);
			const state = sessionStore.get();
			expect(state.data).toBeNull();
			expect(state.isAdmin).toBe(false);
		});
	});

	describe("clearSession", () => {
		it("clears session data and resets state", () => {
			setSession(mockSession);
			clearSession();
			const state = sessionStore.get();
			expect(state.data).toBeNull();
			expect(state.error).toBeNull();
			expect(state.isPending).toBe(false);
			expect(state.isAdmin).toBe(false);
		});
	});

	describe("setSessionPending", () => {
		it("updates isPending while preserving other state", () => {
			setSession(mockSession);
			setSessionPending(true);
			const state = sessionStore.get();
			expect(state.isPending).toBe(true);
			expect(state.data).toEqual(mockSession);
		});

		it("sets isPending to false", () => {
			setSessionPending(true);
			setSessionPending(false);
			expect(sessionStore.get().isPending).toBe(false);
		});
	});

	describe("setSessionError", () => {
		it("sets error and sets isPending to false", () => {
			setSession(mockSession);
			const err = new Error("Session fetch failed");
			setSessionError(err);
			const state = sessionStore.get();
			expect(state.error).toBe(err);
			expect(state.isPending).toBe(false);
		});
	});
});
