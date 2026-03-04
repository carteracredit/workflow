import { describe, it, expect } from "vitest";
import { formatGeneratedCode } from "./format-code";

describe("formatGeneratedCode", () => {
	it("adds trailing commas to multi-line arguments", async () => {
		// Prettier adds trailing commas when args are wrapped across lines
		const unformatted = `doSomething(veryLongArgumentOne, veryLongArgumentTwo, veryLongArgumentThree, veryLongArgumentFour);\n`;
		const result = await formatGeneratedCode(unformatted);
		// When args are wrapped, the last one gets a trailing comma
		expect(result).toContain("veryLongArgumentFour,");
	});

	it("uses tabs for indentation", async () => {
		const code = `export class Foo {
  run() {
    return 1;
  }
}
`;
		const result = await formatGeneratedCode(code);
		// useTabs: true — indented lines should use \t not spaces
		expect(result).toMatch(/\trun\(\)/);
	});

	it("enforces semicolons", async () => {
		const code = `const x = 1\nconst y = 2\n`;
		const result = await formatGeneratedCode(code);
		expect(result).toContain("const x = 1;");
		expect(result).toContain("const y = 2;");
	});

	it("returns original code unchanged if it is already valid and formatted", async () => {
		const alreadyFormatted = `import { WorkflowEntrypoint } from "cloudflare:workers";\n\nexport class MyWorkflow extends WorkflowEntrypoint {\n\tasync run() {\n\t\treturn { success: true };\n\t}\n}\n`;
		const result = await formatGeneratedCode(alreadyFormatted);
		expect(result).toBe(alreadyFormatted);
	});

	it("returns original code when the input has a syntax error", async () => {
		const broken = `export class Foo { run( { invalid syntax }}}`;
		const result = await formatGeneratedCode(broken);
		// Should not throw; should return the original broken code
		expect(result).toBe(broken);
	});
});
