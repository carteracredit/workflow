import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const { identifyMock, useAuthSessionMock } = vi.hoisted(() => ({
	identifyMock: vi.fn(),
	useAuthSessionMock: vi.fn(),
}));

vi.mock("logrocket", () => ({
	default: { identify: identifyMock },
}));

vi.mock("@/lib/auth/useAuthSession", () => ({
	useAuthSession: () => useAuthSessionMock(),
}));

import { LogRocketIdentify } from "./LogRocketIdentify";

describe("LogRocketIdentify", () => {
	afterEach(() => {
		cleanup();
		identifyMock.mockClear();
		useAuthSessionMock.mockReset();
	});

	it("renders nothing", () => {
		useAuthSessionMock.mockReturnValue({ data: null });
		const { container } = render(<LogRocketIdentify />);
		expect(container).toBeEmptyDOMElement();
	});

	it("does not identify when there is no session", () => {
		useAuthSessionMock.mockReturnValue({ data: null });
		render(<LogRocketIdentify />);
		expect(identifyMock).not.toHaveBeenCalled();
	});

	it("identifies the signed-in user once a session is available", () => {
		useAuthSessionMock.mockReturnValue({
			data: {
				user: {
					id: "user-1",
					name: "Ada Lovelace",
					email: "ada@example.com",
					role: "admin",
				},
			},
		});
		render(<LogRocketIdentify />);
		expect(identifyMock).toHaveBeenCalledWith("user-1", {
			name: "Ada Lovelace",
			email: "ada@example.com",
			role: "admin",
		});
	});
});
