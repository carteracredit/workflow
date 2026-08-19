import { describe, expect, it } from "vitest";
import {
	requestSanitizer,
	responseSanitizer,
	urlSanitizer,
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

	it.each([
		["proxy-authorization", "Basic abc"],
		["x-api-key", "k-123"],
		["x-auth-token", "t-123"],
		["x-session-token", "s-123"],
		["x-csrf-token", "csrf"],
		["x-xsrf-token", "xsrf"],
		["x-captcha-response", "turnstile-token"],
		["x-amz-security-token", "amz-session"],
	])("redacts the %s header", (header, value) => {
		const result = requestSanitizer(
			makeRequest({ headers: { [header]: value } }),
		);
		expect(result.headers[header]).toBe("[REDACTED]");
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

	it("redacts PII keys regardless of camelCase, snake_case or PascalCase", () => {
		const body = JSON.stringify({
			phoneNumber: "+15551212",
			email: "a@b.c",
			firstName: "Ada",
			birthDate: "1990-01-01",
			tax_id_number: "123456789",
			TaxIDNumber: "987654321",
			pan: "4111111111111111",
			ein: "12-3456789",
			otp: "123456",
			caseId: "CASE-1",
		});

		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);

		expect(parsed.phoneNumber).toBe("[REDACTED]");
		expect(parsed.email).toBe("[REDACTED]");
		expect(parsed.firstName).toBe("[REDACTED]");
		expect(parsed.birthDate).toBe("[REDACTED]");
		expect(parsed.tax_id_number).toBe("[REDACTED]");
		expect(parsed.TaxIDNumber).toBe("[REDACTED]");
		expect(parsed.pan).toBe("[REDACTED]");
		expect(parsed.ein).toBe("[REDACTED]");
		expect(parsed.otp).toBe("[REDACTED]");
		expect(parsed.caseId).toBe("CASE-1");
	});

	it("redacts the entire bureauSummary subtree", () => {
		const body = JSON.stringify({
			caseId: "CASE-1",
			bureauSummary: {
				fico: 720,
				scoreFactor1: "too many inquiries",
				repos: [{ amountPastDue: 400 }],
				aka: [{ firstName: "Ada" }],
			},
		});

		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.caseId).toBe("CASE-1");
		expect(parsed.bureauSummary).toBe("[REDACTED]");
	});

	it("redacts scoreCardV3 and scoreCardV4 via the card substring", () => {
		const body = JSON.stringify({
			scoreCardV3: 640,
			scoreCardV4: 655,
			passes: true,
		});

		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.scoreCardV3).toBe("[REDACTED]");
		expect(parsed.scoreCardV4).toBe("[REDACTED]");
		expect(parsed.passes).toBe(true);
	});

	it("redacts an address object detected by structure, under any key", () => {
		const body = JSON.stringify({
			mailingLocation: {
				street: "1 Main St",
				city: "Austin",
				state: "TX",
				zip: "78701",
			},
			workflowId: "WF-001",
		});

		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.mailingLocation).toBe("[REDACTED]");
		expect(parsed.workflowId).toBe("WF-001");
	});

	it("does not redact a lone state field (not an address object)", () => {
		const body = JSON.stringify({ state: "running", status: "ok" });
		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.state).toBe("running");
		expect(parsed.status).toBe("ok");
	});

	it("leaves non-sensitive operational keys untouched", () => {
		const body = JSON.stringify({
			caseId: "CASE-1",
			workflowId: "WF-001",
			status: "ok",
			statusCode: 200,
			capacity: 12,
		});

		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.caseId).toBe("CASE-1");
		expect(parsed.workflowId).toBe("WF-001");
		expect(parsed.status).toBe("ok");
		expect(parsed.statusCode).toBe(200);
		expect(parsed.capacity).toBe(12);
	});

	it("does not treat pan/ein as substrings of unrelated keys", () => {
		const body = JSON.stringify({ company: "Acme", being: "processed" });
		const result = requestSanitizer(makeRequest({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.company).toBe("Acme");
		expect(parsed.being).toBe("processed");
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

	it("redacts sensitive keys in a form-urlencoded body", () => {
		const result = requestSanitizer(
			makeRequest({
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: "email=a%40b.c&phoneNumber=%2B1555&workflowId=WF-001",
			}),
		);
		const params = new URLSearchParams(result.body);
		expect(params.get("email")).toBe("[REDACTED]");
		expect(params.get("phoneNumber")).toBe("[REDACTED]");
		expect(params.get("workflowId")).toBe("WF-001");
	});

	it("redacts non-JSON bodies", () => {
		const result = requestSanitizer(makeRequest({ body: "not json" }));
		expect(result.body).toBe("[REDACTED]");
	});

	it("redacts multipart bodies wholesale", () => {
		const result = requestSanitizer(
			makeRequest({
				headers: {
					"Content-Type": "multipart/form-data; boundary=----bound",
				},
				body: '------bound\r\nContent-Disposition: form-data; name="file"\r\n\r\nbinary\r\n------bound--',
			}),
		);
		expect(result.body).toBe("[REDACTED]");
	});

	it("leaves an undefined body untouched", () => {
		const result = requestSanitizer(makeRequest({ body: undefined }));
		expect(result.body).toBeUndefined();
	});

	it("sanitizes PII query params on the request URL", () => {
		const result = requestSanitizer(
			makeRequest({
				url: "https://cases-svc.test/address/autocomplete?q=1%20Main%20St&sessionToken=abc&limit=5",
			}),
		);
		const parsed = new URL(result.url);
		expect(parsed.searchParams.get("q")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("sessionToken")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("limit")).toBe("5");
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
		expect(result.headers["set-cookie"]).toBe("[REDACTED]");
	});

	it("redacts sensitive keys in a JSON response body", () => {
		const body = JSON.stringify({ token: "abc", status: "ok" });
		const result = responseSanitizer(makeResponse({ body }));
		const parsed = JSON.parse(result.body!);
		expect(parsed.token).toBe("[REDACTED]");
		expect(parsed.status).toBe("ok");
	});
});

describe("urlSanitizer", () => {
	it("redacts search, email and phone query params", () => {
		const sanitized = urlSanitizer(
			"https://admin.test/users?search=ada&email=a%40b.c&phone=%2B1555&page=1",
		);
		const parsed = new URL(sanitized);
		expect(parsed.searchParams.get("search")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("email")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("phone")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("page")).toBe("1");
	});

	it("redacts AWS/R2 presigned URL signature params", () => {
		const sanitized = urlSanitizer(
			"https://bucket.r2.cloudflarestorage.com/doc.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA%2F20260101&X-Amz-Signature=deadbeef&X-Amz-Security-Token=session",
		);
		const parsed = new URL(sanitized);
		expect(parsed.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
		expect(parsed.searchParams.get("X-Amz-Credential")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("X-Amz-Signature")).toBe("[REDACTED]");
		expect(parsed.searchParams.get("X-Amz-Security-Token")).toBe("[REDACTED]");
	});

	it("redacts the token segment of /access/{token}", () => {
		const sanitized = urlSanitizer(
			"https://cases.test/access/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9?lang=en",
		);
		const parsed = new URL(sanitized);
		expect(parsed.pathname).toBe("/access/[REDACTED]");
		expect(parsed.searchParams.get("lang")).toBe("en");
	});
});
