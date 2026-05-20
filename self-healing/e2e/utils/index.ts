export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitForElement(
  page,
  testId: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(`[data-testid="${testId}"]`, { timeout })
}

export async function getElementText(
  page,
  testId: string
): Promise<string | null> {
  return page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null,
    testId
  )
}