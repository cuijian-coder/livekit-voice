#!/bin/bash
set -e

echo "=== Step 1: Typecheck ==="
pnpm typecheck

echo "=== Step 2: Unit Tests ==="
pnpm test:run

echo "=== Step 3: Mocked E2E (CI fast) ==="
pnpm playwright test self-healing/e2e/mocked/

echo "=== Step 4: Real Browser E2E ==="
pnpm playwright test self-healing/e2e/real-browser/

echo "=== Step 5: Smoke Tests ==="
pnpm playwright test self-healing/e2e/smoke/

echo "=== All Checks Passed ==="