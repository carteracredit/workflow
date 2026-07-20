/**
 * XML well-formedness validation.
 *
 * Works in two environments:
 *   - Browser: delegates to the native DOMParser which has full XML support.
 *   - Node.js (code-generator, tests): uses a structural stack-based checker
 *     that covers the common cases (balanced tags, single root, basic syntax).
 *
 * Before validating, workflow interpolation tokens (${...}) are stripped so
 * that a template like <id>${node-1.id}</id> is treated as valid XML.
 */

/** Replace every ${...} token with a safe placeholder so the parser doesn't choke. */
function stripTokens(value: string): string {
	return value.replace(/\$\{[^}]*\}/g, "PLACEHOLDER");
}

/** Browser path: use DOMParser and check for <parsererror>. */
function isWellFormedXmlBrowser(value: string): boolean {
	const cleaned = stripTokens(value).trim();
	if (!cleaned) return false;
	const parser = new DOMParser();
	const doc = parser.parseFromString(cleaned, "application/xml");
	return doc.getElementsByTagName("parsererror").length === 0;
}

/**
 * Node path: lightweight stack-based checker.
 *
 * Covers:
 *   - Optional XML declaration (<?xml ... ?>)
 *   - Processing instructions (<?...?>)
 *   - Comments (<!-- ... -->)
 *   - CDATA sections (<![CDATA[...]]>)
 *   - Self-closing tags (<tag ... />)
 *   - Open/close tag pairs (balanced, single root)
 *   - Namespace prefixes (tag names may contain ':')
 *
 * Does NOT validate DTD, schemas, or entity declarations. That is intentional –
 * this is a structural/syntactic check only.
 */
function isWellFormedXmlNode(value: string): boolean {
	const cleaned = stripTokens(value).trim();
	if (!cleaned) return false;

	let pos = 0;
	const stack: string[] = [];
	let rootCount = 0;

	const peek = () => cleaned[pos] ?? "";
	const consume = (n = 1) => {
		pos += n;
	};
	const startsWith = (s: string) => cleaned.startsWith(s, pos);

	const skipWhitespace = () => {
		while (pos < cleaned.length && /\s/.test(cleaned[pos])) pos++;
	};

	// Read until a given string appears (exclusive of the terminator).
	const readUntil = (terminator: string): boolean => {
		const idx = cleaned.indexOf(terminator, pos);
		if (idx === -1) return false;
		pos = idx + terminator.length;
		return true;
	};

	// Read an XML name (tag name / attribute name).
	const readName = (): string => {
		const start = pos;
		while (pos < cleaned.length && /[a-zA-Z0-9_:.\-]/.test(cleaned[pos])) pos++;
		return cleaned.slice(start, pos);
	};

	// Skip attributes inside a tag (after tag name).
	const skipAttributes = (): boolean => {
		while (pos < cleaned.length) {
			skipWhitespace();
			if (peek() === ">" || startsWith("/>")) return true;
			if (peek() === "") return false;
			// attribute name
			const name = readName();
			if (!name) return false;
			skipWhitespace();
			if (peek() === "=") {
				consume();
				skipWhitespace();
				const quote = peek();
				if (quote !== '"' && quote !== "'") return false;
				consume();
				const end = cleaned.indexOf(quote, pos);
				if (end === -1) return false;
				pos = end + 1;
			}
		}
		return false;
	};

	try {
		while (pos < cleaned.length) {
			skipWhitespace();
			if (pos >= cleaned.length) break;

			if (peek() !== "<") {
				// Text content outside root is invalid (unless whitespace only)
				if (stack.length === 0) return false;
				// Skip text content inside an element
				while (pos < cleaned.length && peek() !== "<") pos++;
				continue;
			}

			// XML declaration or processing instruction
			if (startsWith("<?")) {
				consume(2);
				if (!readUntil("?>")) return false;
				continue;
			}

			// Comment
			if (startsWith("<!--")) {
				consume(4);
				if (!readUntil("-->")) return false;
				continue;
			}

			// CDATA
			if (startsWith("<![CDATA[")) {
				consume(9);
				if (!readUntil("]]>")) return false;
				continue;
			}

			// DOCTYPE
			if (startsWith("<!")) {
				consume(2);
				if (!readUntil(">")) return false;
				continue;
			}

			// Closing tag
			if (startsWith("</")) {
				consume(2);
				const name = readName();
				skipWhitespace();
				if (peek() !== ">") return false;
				consume();
				if (stack.length === 0 || stack[stack.length - 1] !== name)
					return false;
				stack.pop();
				continue;
			}

			// Opening tag (or self-closing)
			consume(); // '<'
			const name = readName();
			if (!name) return false;
			if (!skipAttributes()) return false;

			if (startsWith("/>")) {
				consume(2);
				if (stack.length === 0) rootCount++;
			} else if (peek() === ">") {
				consume();
				if (stack.length === 0) rootCount++;
				stack.push(name);
			} else {
				return false;
			}
		}

		return stack.length === 0 && rootCount === 1;
	} catch {
		return false;
	}
}

/**
 * Returns true if `value` is a well-formed XML document (after stripping
 * workflow interpolation tokens like ${node-1.id}).
 */
export function isWellFormedXml(value: string): boolean {
	if (typeof DOMParser !== "undefined") {
		return isWellFormedXmlBrowser(value);
	}
	return isWellFormedXmlNode(value);
}

/**
 * Returns true if `value` is valid JSON (after stripping workflow tokens).
 * Empty string returns false.
 */
export function isValidJson(value: string): boolean {
	const cleaned = stripTokens(value).trim();
	if (!cleaned) return false;
	try {
		JSON.parse(cleaned);
		return true;
	} catch {
		return false;
	}
}
