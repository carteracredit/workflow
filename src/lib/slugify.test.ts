import { describe, it, expect } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
	it("should convert string to lowercase", () => {
		expect(slugify("HELLO WORLD")).toBe("hello-world");
	});

	it("should trim whitespace", () => {
		expect(slugify("  hello world  ")).toBe("hello-world");
	});

	it("should remove quotes", () => {
		expect(slugify("hello'world")).toBe("helloworld");
		expect(slugify('hello"world')).toBe("helloworld");
	});

	it("should replace non-alphanumeric characters with hyphens", () => {
		expect(slugify("hello world!")).toBe("hello-world");
		expect(slugify("hello@world#test")).toBe("hello-world-test");
	});

	it("should collapse multiple hyphens", () => {
		expect(slugify("hello---world")).toBe("hello-world");
		expect(slugify("hello   world")).toBe("hello-world");
	});

	it("should remove leading and trailing hyphens", () => {
		expect(slugify("-hello-world-")).toBe("hello-world");
		expect(slugify("---hello---world---")).toBe("hello-world");
	});

	it("should handle empty string", () => {
		expect(slugify("")).toBe("");
	});

	it("should handle string with only special characters", () => {
		expect(slugify("!!!@@@###")).toBe("");
	});

	it("should handle mixed case with numbers", () => {
		expect(slugify("Hello123World")).toBe("hello123world");
	});

	it("should handle unicode characters", () => {
		expect(slugify("héllo wörld")).toBe("h-llo-w-rld");
	});
});
