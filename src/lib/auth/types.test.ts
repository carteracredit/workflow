import { describe, it, expect } from "vitest";
import { isAdminRole } from "./types";

describe("isAdminRole", () => {
	it("returns false when role is undefined", () => {
		expect(isAdminRole(undefined)).toBe(false);
	});

	it("returns false when role is null", () => {
		expect(isAdminRole(null)).toBe(false);
	});

	it("returns false when role is empty string", () => {
		expect(isAdminRole("")).toBe(false);
	});

	it("returns true when role is 'admin'", () => {
		expect(isAdminRole("admin")).toBe(true);
	});

	it("returns true when role is 'Admin' (case insensitive)", () => {
		expect(isAdminRole("Admin")).toBe(true);
	});

	it("returns true when role is 'ADMIN'", () => {
		expect(isAdminRole("ADMIN")).toBe(true);
	});

	it("returns false when role is not admin", () => {
		expect(isAdminRole("user")).toBe(false);
		expect(isAdminRole("viewer")).toBe(false);
	});

	it("returns true for comma-separated roles including admin", () => {
		expect(isAdminRole("user,admin")).toBe(true);
		expect(isAdminRole("admin,user")).toBe(true);
		expect(isAdminRole("viewer, admin ,manager")).toBe(true);
	});

	it("returns false for comma-separated roles without admin", () => {
		expect(isAdminRole("user,viewer")).toBe(false);
	});

	it("trims whitespace in comma-separated roles", () => {
		expect(isAdminRole("  admin  ")).toBe(true);
		expect(isAdminRole("user,  admin  ")).toBe(true);
	});
});
