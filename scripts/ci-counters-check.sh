#!/bin/sh
# CI / nightly: контрактные тесты counter-worker (E2E stack + slice baseline + drift unit tests).
set -e

cd "$(dirname "$0")/.."

echo "== build shared packages =="
npm run build -w @chat3/models -w @chat3/utils

echo "== counter stack E2E =="
npm run test:counter-stack

echo "== slice benchmark =="
npm run test:counter-benchmark

echo "== golden contract fixtures =="
node --experimental-vm-modules node_modules/jest/bin/jest.js packages-shared/utils/src/__tests__/counterGoldenFixtures.test.js

echo "== drift detection (unit) =="
node --experimental-vm-modules node_modules/jest/bin/jest.js packages-shared/utils/src/__tests__/reconcileCounterDrift.test.js

if [ -n "${MONGO_URI:-}" ]; then
  echo "== reconcile-counter-drift (live mongo) =="
  npm run reconcile-counter-drift
else
  echo "== skip live drift (MONGO_URI not set) =="
fi

echo "== ci-counters-check OK =="
