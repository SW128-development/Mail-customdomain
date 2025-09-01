// A tiny logger that gates console output using env flags
// Server: reads process.env.cf_debug / CF_DEBUG / NEXT_PUBLIC_CF_DEBUG
// Client: reads process.env.NEXT_PUBLIC_CF_DEBUG if inlined at build time

function parseBooleanFlag(value: unknown): boolean {
	if (typeof value !== "string") return false
	const lowered = value.toLowerCase()
	return lowered === "1" || lowered === "true" || lowered === "yes" || lowered === "on"
}

function resolveDebugEnabled(): boolean {
	try {
		// Prefer server env when available
		if (typeof process !== "undefined" && (process as any)?.env) {
			const env: any = (process as any).env
			const raw = env.cf_debug ?? env.CF_DEBUG ?? env.NEXT_PUBLIC_CF_DEBUG ?? env.NEXT_PUBLIC_cf_debug
			if (typeof raw === "string") return parseBooleanFlag(raw)
		}
		// Client-side: Next may inline NEXT_PUBLIC_* values; fallback to false
		if (typeof window !== "undefined") {
			const raw = (process as any)?.env?.NEXT_PUBLIC_CF_DEBUG ?? (process as any)?.env?.NEXT_PUBLIC_cf_debug
			if (typeof raw === "string") return parseBooleanFlag(raw)
		}
	} catch { /* ignore env access issues */ }
	return false
}

const debugEnabled = resolveDebugEnabled()

export const logger = {
	isEnabled: debugEnabled,
	debug: (...args: any[]) => {
		if (debugEnabled) console.log(...args)
	},
	info: (...args: any[]) => {
		if (debugEnabled) console.info(...args)
	},
	warn: (...args: any[]) => {
		if (debugEnabled) console.warn(...args)
	},
	error: (...args: any[]) => {
		// Always surface errors regardless of flag
		console.error(...args)
	},
} 