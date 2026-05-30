#!/usr/bin/env node
/**
 * Сверка drift счётчиков: UserDialogStats, MessageStatusStats, UserStats.
 * Exit code 1 при обнаружении расхождений (для CI / nightly).
 *
 * Usage:
 *   node scripts/reconcile-counter-drift.mjs [--tenant=tnt_default] [--max-dialogs=500]
 */
import connectDB from '@chat3/utils/databaseUtils.js';
import { reconcileCounterDrift } from '@chat3/utils/counterProcessor/reconcileCounterDrift.js';

function parseArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  const raw = hit.slice(prefix.length);
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

const tenantId = parseArg('tenant', undefined);
const maxUserDialogs = parseArg('max-dialogs', 500);
const maxMessages = parseArg('max-messages', 100);
const maxUsers = parseArg('max-users', 200);

await connectDB();

const result = await reconcileCounterDrift({
  ...(tenantId ? { tenantId } : {}),
  maxUserDialogs,
  maxMessages,
  maxUsers
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
