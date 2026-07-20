import { describe, expect, it, vi, afterEach } from "vitest";
import { isValidJson, isWellFormedXml } from "./xml-validation";

describe("isWellFormedXml", () => {
	it("accepts a minimal element", () => {
		expect(isWellFormedXml("<root/>")).toBe(true);
	});

	it("accepts a simple open/close pair", () => {
		expect(isWellFormedXml("<root></root>")).toBe(true);
	});

	it("accepts nested elements", () => {
		expect(isWellFormedXml("<root><child>text</child></root>")).toBe(true);
	});

	it("accepts an XML declaration", () => {
		expect(
			isWellFormedXml('<?xml version="1.0" encoding="UTF-8"?><root/>'),
		).toBe(true);
	});

	it("accepts attributes", () => {
		expect(isWellFormedXml('<root id="1"><item key="a"/></root>')).toBe(true);
	});

	it("accepts a CDATA section", () => {
		expect(isWellFormedXml("<root><![CDATA[some <raw> data]]></root>")).toBe(
			true,
		);
	});

	it("accepts namespace prefixes", () => {
		expect(
			isWellFormedXml(
				'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>',
			),
		).toBe(true);
	});

	it("accepts comments", () => {
		expect(isWellFormedXml("<!-- header --><root/>")).toBe(true);
	});

	it("accepts workflow tokens (treated as valid text)", () => {
		expect(
			isWellFormedXml("<request><loanId>${node-123.loanId}</loanId></request>"),
		).toBe(true);
	});

	it("accepts multiple workflow tokens", () => {
		expect(
			isWellFormedXml("<req><a>${node-1.a}</a><b>${secret.KEY}</b></req>"),
		).toBe(true);
	});

	it("rejects mismatched closing tag", () => {
		expect(isWellFormedXml("<root></other>")).toBe(false);
	});

	it("rejects unclosed tag", () => {
		expect(isWellFormedXml("<root>")).toBe(false);
	});

	it("rejects multiple root elements", () => {
		expect(isWellFormedXml("<a/><b/>")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isWellFormedXml("")).toBe(false);
	});

	it("rejects plain text with no tags", () => {
		expect(isWellFormedXml("not xml")).toBe(false);
	});

	it("rejects missing closing bracket", () => {
		expect(isWellFormedXml("<root")).toBe(false);
	});
});

describe("isValidJson", () => {
	it("accepts a valid JSON object", () => {
		expect(isValidJson('{"key": "value"}')).toBe(true);
	});

	it("accepts a JSON array", () => {
		expect(isValidJson("[1, 2, 3]")).toBe(true);
	});

	it("accepts workflow tokens by stripping them first", () => {
		expect(
			isValidJson('{"loanId": "${node-123.loanId}", "amount": 1000}'),
		).toBe(true);
	});

	it("accepts nested object with tokens", () => {
		expect(
			isValidJson('{"a": "${secret.KEY}", "b": {"c": "${node-1.x}"}}'),
		).toBe(true);
	});

	it("rejects invalid JSON", () => {
		expect(isValidJson('{"key": value}')).toBe(false);
	});

	it("rejects trailing comma", () => {
		expect(isValidJson('{"a": 1,}')).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isValidJson("")).toBe(false);
	});

	it("rejects plain text", () => {
		expect(isValidJson("not json")).toBe(false);
	});
});

/**
 * Re-run isWellFormedXml with DOMParser stubbed to undefined so the
 * Node.js stack-based fallback is exercised (it would otherwise be hidden
 * behind the browser DOMParser branch in jsdom).
 */
describe("isWellFormedXml – Node.js fallback path (no DOMParser)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function withoutDOMParser(fn: () => void) {
		vi.stubGlobal("DOMParser", undefined);
		try {
			fn();
		} finally {
			vi.unstubAllGlobals();
		}
	}

	it("accepts a minimal self-closing element", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root/>")).toBe(true);
		});
	});

	it("accepts a simple open/close pair", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root></root>")).toBe(true);
		});
	});

	it("accepts nested elements", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root><child>text</child></root>")).toBe(true);
		});
	});

	it("accepts an XML declaration", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml('<?xml version="1.0"?><root/>')).toBe(true);
		});
	});

	it("accepts attributes", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml('<root id="1"><item key="a"/></root>')).toBe(true);
		});
	});

	it("accepts a CDATA section", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root><![CDATA[some <raw> data]]></root>")).toBe(
				true,
			);
		});
	});

	it("accepts namespace prefixes", () => {
		withoutDOMParser(() => {
			expect(
				isWellFormedXml(
					'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>',
				),
			).toBe(true);
		});
	});

	it("accepts comments", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<!-- header --><root/>")).toBe(true);
		});
	});

	it("accepts workflow tokens treated as valid text", () => {
		withoutDOMParser(() => {
			expect(
				isWellFormedXml(
					"<request><loanId>${node-123.loanId}</loanId></request>",
				),
			).toBe(true);
		});
	});

	it("rejects mismatched closing tag", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root></other>")).toBe(false);
		});
	});

	it("rejects unclosed tag", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root>")).toBe(false);
		});
	});

	it("rejects multiple root elements", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<a/><b/>")).toBe(false);
		});
	});

	it("rejects empty string", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("")).toBe(false);
		});
	});

	it("rejects plain text with no tags", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("not xml")).toBe(false);
		});
	});

	it("rejects missing closing bracket on opening tag", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml("<root")).toBe(false);
		});
	});

	it("rejects attribute without closing quote", () => {
		withoutDOMParser(() => {
			expect(isWellFormedXml('<root id="unclosed></root>')).toBe(false);
		});
	});

	it("rejects DOCTYPE with missing closing >", () => {
		withoutDOMParser(() => {
			// DOCTYPE that never closes
			expect(isWellFormedXml("<!DOCTYPE")).toBe(false);
		});
	});
});
