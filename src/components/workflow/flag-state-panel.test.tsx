import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlagStatePanel } from "./flag-state-panel";

vi.mock("swr", () => ({
	default: vi.fn(),
}));

import useSWR from "swr";

const mockUseSWR = vi.mocked(useSWR);

describe("FlagStatePanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null when loading", () => {
		mockUseSWR.mockReturnValue({
			data: undefined,
			error: undefined,
			isLoading: true,
			isValidating: false,
			mutate: vi.fn(),
		} as ReturnType<typeof useSWR>);

		const { container } = render(
			<FlagStatePanel workflowId="wf-1" apiToken="token" />,
		);

		expect(container.firstChild).toBeNull();
	});

	it("returns null when flags is undefined", () => {
		mockUseSWR.mockReturnValue({
			data: undefined,
			error: undefined,
			isLoading: false,
			isValidating: false,
			mutate: vi.fn(),
		} as ReturnType<typeof useSWR>);

		const { container } = render(
			<FlagStatePanel workflowId="wf-1" apiToken="token" />,
		);

		expect(container.firstChild).toBeNull();
	});

	it("returns null when flags array is empty", () => {
		mockUseSWR.mockReturnValue({
			data: [],
			error: undefined,
			isLoading: false,
			isValidating: false,
			mutate: vi.fn(),
		} as ReturnType<typeof useSWR>);

		const { container } = render(
			<FlagStatePanel workflowId="wf-1" apiToken="token" />,
		);

		expect(container.firstChild).toBeNull();
	});

	it("renders flag names and option labels when data is present", () => {
		mockUseSWR.mockReturnValue({
			data: [
				{
					id: "flag-1",
					workflow_id: "wf-1",
					name: "Prioridad",
					sort_order: 0,
					created_at: "2024-01-01",
					updated_at: "2024-01-01",
					options: [
						{
							id: "opt-1",
							label: "Alta",
							color: "red-500",
							sort_order: 0,
						},
					],
					currentState: {
						optionId: "opt-1",
						updatedAt: "",
						updatedByInstanceId: null,
					},
				},
			],
			error: undefined,
			isLoading: false,
			isValidating: false,
			mutate: vi.fn(),
		} as ReturnType<typeof useSWR>);

		render(<FlagStatePanel workflowId="wf-1" apiToken="token" />);

		expect(screen.getByText("Estado de Flags")).toBeInTheDocument();
		expect(screen.getByText("Prioridad")).toBeInTheDocument();
		expect(screen.getByText("Alta")).toBeInTheDocument();
	});

	it("renders dash when flag has no active option", () => {
		mockUseSWR.mockReturnValue({
			data: [
				{
					id: "flag-2",
					workflow_id: "wf-1",
					name: "Sin estado",
					sort_order: 0,
					created_at: "2024-01-01",
					updated_at: "2024-01-01",
					options: [],
					currentState: null,
				},
			],
			error: undefined,
			isLoading: false,
			isValidating: false,
			mutate: vi.fn(),
		} as ReturnType<typeof useSWR>);

		render(<FlagStatePanel workflowId="wf-1" apiToken="token" />);

		expect(screen.getByText("Sin estado")).toBeInTheDocument();
		expect(screen.getByText("—")).toBeInTheDocument();
	});
});
