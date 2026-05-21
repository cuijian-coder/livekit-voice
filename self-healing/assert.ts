const INVARIANT_ENABLED = (() => {
  try {
    return (globalThis as any).process?.env?.DISABLE_INVARIANTS !== 'true'
  } catch {
    return true
  }
})()

export function invariant(
  condition: unknown,
  message: string
): asserts condition {
  if (INVARIANT_ENABLED && !condition) {
    throw new Error(`[Invariant Failed] ${message}`)
  }
}

export function assertNotNull<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (INVARIANT_ENABLED && value == null) {
    throw new Error(`[Invariant Failed] ${message}`)
  }
}

export function assertEqual<T>(
  actual: T,
  expected: T,
  message: string
): void {
  if (INVARIANT_ENABLED && actual !== expected) {
    throw new Error(`[Invariant Failed] ${message}\n  Expected: ${expected}\n  Actual: ${actual}`)
  }
}