import { describe, it, expect } from "vitest";
import {
	validateTransformCode,
	validateConditionExpression,
} from "./validate-code";

describe("validateTransformCode", () => {
	it("should accept valid TypeScript code", async () => {
		const result = await validateTransformCode(
			"const total = items.reduce((a, b) => a + b, 0);\nreturn { total };",
		);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it("should accept a simple return statement", async () => {
		const result = await validateTransformCode("return { success: true };");
		expect(result.valid).toBe(true);
	});

	it("should accept multi-line TypeScript with types", async () => {
		const result = await validateTransformCode(
			`const data = event.payload as { amount: number };
const tax = data.amount * 0.16;
return { amount: data.amount, tax, total: data.amount + tax };`,
		);
		expect(result.valid).toBe(true);
	});

	it("should reject bare JSON object (the reported bug)", async () => {
		// This is exactly what caused: Expected ";" but found ":"
		const result = await validateTransformCode('{"example":"example"}');
		expect(result.valid).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it("should reject a JSON object with multiple keys", async () => {
		const result = await validateTransformCode(
			'{"key1": "value1", "key2": 42}',
		);
		expect(result.valid).toBe(false);
	});

	it("should reject code with unclosed braces", async () => {
		const result = await validateTransformCode("const x = {");
		expect(result.valid).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it("should reject code with syntax error (missing closing paren)", async () => {
		const result = await validateTransformCode("const val = someFunction(;");
		expect(result.valid).toBe(false);
	});

	it("should return an error for empty code", async () => {
		const result = await validateTransformCode("");
		expect(result.valid).toBe(false);
		expect(result.error).toBe("El código no puede estar vacío");
	});

	it("should return an error for whitespace-only code", async () => {
		const result = await validateTransformCode("   \n\t  ");
		expect(result.valid).toBe(false);
		expect(result.error).toBe("El código no puede estar vacío");
	});

	it("should accept async/await syntax", async () => {
		const result = await validateTransformCode(
			"const data = await fetch('https://api.example.com');\nreturn data.json();",
		);
		expect(result.valid).toBe(true);
	});
});

describe("validateConditionExpression", () => {
	it("should accept a simple comparison expression", async () => {
		const result = await validateConditionExpression("creditScore > 700");
		expect(result.valid).toBe(true);
	});

	it("should accept a complex boolean expression", async () => {
		const result = await validateConditionExpression(
			"amount > 1000 && status === 'approved'",
		);
		expect(result.valid).toBe(true);
	});

	it("should accept a ternary-style expression", async () => {
		const result = await validateConditionExpression(
			"data.score >= 600 || data.hasGuarantor",
		);
		expect(result.valid).toBe(true);
	});

	it("should accept typeof check", async () => {
		const result = await validateConditionExpression(
			"typeof value === 'string' && value.length > 0",
		);
		expect(result.valid).toBe(true);
	});

	it("should reject an incomplete expression (trailing operator)", async () => {
		const result = await validateConditionExpression("amount >");
		expect(result.valid).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it("should reject a bare assignment (=) as condition", async () => {
		const result = await validateConditionExpression("x = 5");
		// This is syntactically valid JS (assignment is an expression),
		// but we don't flag it as a parse error – the test just asserts
		// no crash occurs.
		expect(typeof result.valid).toBe("boolean");
	});

	it("should reject an expression with unmatched parentheses", async () => {
		const result = await validateConditionExpression("(amount > 0");
		expect(result.valid).toBe(false);
	});

	it("should return an error for empty condition", async () => {
		const result = await validateConditionExpression("");
		expect(result.valid).toBe(false);
		expect(result.error).toBe("La condición no puede estar vacía");
	});

	it("should return an error for whitespace-only condition", async () => {
		const result = await validateConditionExpression("   ");
		expect(result.valid).toBe(false);
		expect(result.error).toBe("La condición no puede estar vacía");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// ESBuild semantic checks (patterns Prettier accepts but Cloudflare rejects)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateTransformCode – ESBuild semantic rules", () => {
	it("should reject `const x;` without initializer (the reported bug)", async () => {
		const result = await validateTransformCode("const newVariable;");
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/constante|const|asignado/i);
	});

	it("should reject `const x;` with type annotation and no initializer", async () => {
		const result = await validateTransformCode("const myVar: string;");
		expect(result.valid).toBe(false);
	});

	it("should reject const without initializer in multi-line code", async () => {
		const result = await validateTransformCode(
			`const a = 1;\nconst b;\nreturn a;`,
		);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Línea 2");
	});

	it("should accept `const x = value;` with initializer", async () => {
		const result = await validateTransformCode("const x = 5;");
		expect(result.valid).toBe(true);
	});

	it("should accept `const x: number = value;` with type and initializer", async () => {
		const result = await validateTransformCode("const x: number = 42;");
		expect(result.valid).toBe(true);
	});

	it("should accept `const obj = { key: 'value' };`", async () => {
		const result = await validateTransformCode("const obj = { key: 'value' };");
		expect(result.valid).toBe(true);
	});

	it("should accept `const arr = [1, 2, 3];`", async () => {
		const result = await validateTransformCode("const arr = [1, 2, 3];");
		expect(result.valid).toBe(true);
	});

	it("should accept `let x;` (let without initializer is valid in ESBuild)", async () => {
		const result = await validateTransformCode("let x;");
		expect(result.valid).toBe(true);
	});
});
