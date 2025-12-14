#!/usr/bin/env node

/**
 * Storybook build wrapper for CI/Chromatic.
 *
 * Important: don't enable --stats-json in CI; it can generate huge files.
 */

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
let outputDir = "storybook-static";
const passthroughArgs = [];

for (let i = 0; i < args.length; i++) {
	const arg = args[i];

	if (arg === "-o" || arg === "--output-dir") {
		const nextArg = args[i + 1];
		if (nextArg && !nextArg.startsWith("-")) {
			outputDir = nextArg;
			i++;
		}
		continue;
	}

	if (arg.startsWith("--output-dir=")) {
		const value = arg.split("=").slice(1).join("=");
		if (value) outputDir = value;
		continue;
	}

	// Guardrail: stats JSON can be enormous; avoid accidental usage in CI.
	if (arg === "--stats-json" || arg.startsWith("--stats-json=")) {
		if (process.env.CI || process.env.GITHUB_ACTIONS === "true") {
			console.warn(
				"Warning: --stats-json is not recommended in CI (can generate huge files). Ignoring.",
			);
			// If provided as `--stats-json path`, skip the path too.
			if (arg === "--stats-json") {
				const nextArg = args[i + 1];
				if (nextArg && !nextArg.startsWith("-")) i++;
			}
			continue;
		}
	}

	passthroughArgs.push(arg);
}

const env = {
	...process.env,
	// Force non-interactive behavior (prevents Storybook prompts in CI)
	CI: process.env.CI ?? "1",
	// Helps avoid interactive prompts / telemetry in CI environments
	STORYBOOK_DISABLE_TELEMETRY: process.env.STORYBOOK_DISABLE_TELEMETRY ?? "1",
	STORYBOOK_TELEMETRY_DISABLED: process.env.STORYBOOK_TELEMETRY_DISABLED ?? "1",
	// Some Storybook versions prompt for crash reports when a build fails; disable.
	STORYBOOK_DISABLE_CRASH_REPORTS:
		process.env.STORYBOOK_DISABLE_CRASH_REPORTS ?? "1",
	STORYBOOK_CRASH_REPORTS_DISABLED:
		process.env.STORYBOOK_CRASH_REPORTS_DISABLED ?? "1",
	NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max_old_space_size=4096",
};

const pnpmArgs = [
	"exec",
	"storybook",
	"build",
	"--output-dir",
	outputDir,
	...passthroughArgs,
];

const child = spawn("pnpm", pnpmArgs, {
	stdio: ["ignore", "pipe", "pipe"],
	env,
	// Create a new process group on POSIX so we can terminate the whole tree.
	detached: process.platform !== "win32",
});

let sawSuccess = false;
let sawOutputDir = false;
let lastOutputAt = Date.now();
let successKillTimer = null;
let hardTimeoutTimer = null;
let forcedSuccessExit = false;

let lineBuf = "";
function handleChunk(chunk) {
	lastOutputAt = Date.now();
	lineBuf += chunk.toString();
	const lines = lineBuf.split(/\r?\n/);
	lineBuf = lines.pop() ?? "";

	for (const line of lines) {
		if (!sawOutputDir && line.includes("Output directory:"))
			sawOutputDir = true;
		if (
			!sawSuccess &&
			line.includes("Storybook build completed successfully")
		) {
			sawSuccess = true;
			// If Storybook prints success but hangs, wait for a short idle window,
			// then kill and treat as success.
			if (!successKillTimer) {
				successKillTimer = setInterval(async () => {
					if (child.exitCode != null) return;
					// Once we’ve seen success, 2s of silence is enough to consider it done.
					if (Date.now() - lastOutputAt >= 2000) {
						forcedSuccessExit = true;
						await killProcessTree(child.pid);
						process.exit(0);
					}
				}, 250);
				successKillTimer.unref?.();
			}
		}
	}
}

child.stdout.on("data", (chunk) => {
	process.stdout.write(chunk);
	handleChunk(chunk);
});

child.stderr.on("data", (chunk) => {
	process.stderr.write(chunk);
	handleChunk(chunk);
});

child.on("error", () => {
	process.exit(1);
});

child.on("close", (code, signal) => {
	if (successKillTimer) clearInterval(successKillTimer);
	if (hardTimeoutTimer) clearTimeout(hardTimeoutTimer);
	// If we intentionally terminated a hung-but-successful build, treat it as success.
	if (forcedSuccessExit) process.exit(0);
	if (signal) process.exit(1);
	process.exit(typeof code === "number" ? code : 1);
});

// Hard timeout for CI safety (defaults to 20 minutes in CI, disabled locally unless CI is set)
const hardTimeoutMs =
	Number(process.env.STORYBOOK_BUILD_TIMEOUT_MS) ||
	(process.env.CI || process.env.GITHUB_ACTIONS === "true"
		? 20 * 60 * 1000
		: 0);

if (hardTimeoutMs > 0) {
	hardTimeoutTimer = setTimeout(async () => {
		if (child.exitCode != null) return;
		console.error(
			`Storybook build exceeded timeout (${hardTimeoutMs}ms). Terminating...`,
		);
		await killProcessTree(child.pid);
		process.exit(1);
	}, hardTimeoutMs);
	hardTimeoutTimer.unref?.();
}

async function killProcessTree(pid) {
	if (!pid) return;

	// Windows needs taskkill to terminate the full process tree.
	if (process.platform === "win32") {
		const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
			stdio: "ignore",
		});
		await new Promise((resolve) => killer.on("close", resolve));
		return;
	}

	// On POSIX, try to kill the whole process group first, then fall back to PID.
	try {
		process.kill(-pid, "SIGTERM");
	} catch {
		// ignore
	}
	await new Promise((r) => setTimeout(r, 2000));
	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// ignore
		}
	}
}
