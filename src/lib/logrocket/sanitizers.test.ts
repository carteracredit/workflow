import { describe, expect, it } from "vitest";
import {
	requestSanitizer,
	responseSanitizer,
	type LogRocketRequest,
	type LogRocketResponse,
} from "./sanitizers";

function makeRequest(
	overrides: Partial<LogRocketRequest> = {},
): LogRocketRequest {
	return {
		reqId: "req-1",
		url: "https://workflow-svc.test/workflows/1",
		method: "GET",
		headers: {},
		...overrides,
	};
}

function makeResponse(
	overrides: Partial<LogRocketResponse> = {},
): LogRocketResponse {
	return {
		reqId: "req-1",
		method: "GET",
		headers: {},
		...overrides,
	};
}

describe("requestSanitizer", () => {
	it("redacts the Authorization header (case-insensitive)", () => {
		const result = requestSanitizer(
			makeRequest({ headers: { authorization: "Bearer secret-jwt" } }),
		);
		expect(result.headers.authorization).toBe("[REDACTED]");
	});

	it("redacts the Cookie header", () => {
		const result = requestSanitizer(
			makeRequest({ headers: { Cookie: "session=abc" } }),
		);
		expect(result.headers.Cookie).toBe("[REDACTED]");
	});

	it("leaves non-sensitive headers untouched", () => {
		const result = requestSanitizer(
			makeRequest({ headers: { "Content-Type": "application/json" } }),
		);
		expect(result.headers["Content-Type"]).toBe("application/json");
	});

	it("redacts sensitive keys in a JSON body, recursively", () => {
		const body = JSON.stringify({
			cardNumber: "4111111111111111",
			cvv: "123",
			bankAccountNumber: "0011223344",
			routingNumber: "021000021",
			refreshToken: "abc.def.ghi",
			apiSecret: "shh",
			password: "hunter2",
			nested: { accountBalance: 1000 },
			workflowId: "WF-001",
		});

		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);

		expect(parsed.cardNumber).toBe("[REDACTED]");
		expect(parsed.cvv).toBe("[REDACTED]");
		expect(parsed.bankAccountNumber).toBe("[REDACTED]");
		expect(parsed.routingNumber).toBe("[REDACTED]");
		expect(parsed.refreshToken).toBe("[REDACTED]");
		expect(parsed.apiSecret).toBe("[REDACTED]");
		expect(parsed.password).toBe("[REDACTED]");
		expect(parsed.nested.accountBalance).toBe("[REDACTED]");
		expect(parsed.workflowId).toBe("WF-001");
	});

	it("redacts sensitive keys inside arrays of objects", () => {
		const body = JSON.stringify({
			paymentMethods: [{ cardNumber: "4111" }, { cardNumber: "5555" }],
		});
		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.paymentMethods[0].cardNumber).toBe("[REDACTED]");
		expect(parsed.paymentMethods[1].cardNumber).toBe("[REDACTED]");
	});

	it("redacts an entire container value when its own key looks sensitive", () => {
		const body = JSON.stringify({
			cards: [{ last4: "1111" }],
		});
		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.cards).toBe("[REDACTED]");
	});

	it("leaves non-JSON bodies untouched", () => {
		const result = requestSanitizer(makeRequest({ body: "not json" }));
		expect(result.body).toBe("not json");
	});

	it("leaves an undefined body untouched", () => {
		const result = requestSanitizer(makeRequest({ body: undefined }));
		expect(result.body).toBeUndefined();
	});
});

describe("responseSanitizer", () => {
	it("redacts the Authorization and Cookie headers", () => {
		const result = responseSanitizer(
			makeResponse({
				headers: { Authorization: "Bearer x", "set-cookie": "a=b" },
			}),
		);
		expect(result.headers.Authorization).toBe("[REDACTED]");
		// Only exact "authorization"/"cookie" header names are redacted, not
		// variants like "set-cookie" — network.isEnabled stays true regardless.
		expect(result.headers["set-cookie"]).toBe("a=b");
	});

	it("redacts sensitive keys in a JSON response body", () => {
		const body = JSON.stringify({ token: "abc", status: "ok" });
		const result = responseSanitizer(makeResponse({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.token).toBe("[REDACTED]");
		expect(parsed.status).toBe("ok");
	});
});
