/** One-shot script: upload populated env vars from apps/web/.env.local to
 * Vercel (production + preview + development). Skips empty values.
 *
 * Run via:  node scripts/vercel-env-sync.mjs
 * Requires: vercel CLI logged in (reads token from CLI auth.json) + linked.
 *
 * Never logs values — only key + which targets were applied.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(REPO_ROOT, 'apps', 'web', '.env.local');
const VERCEL_LINK = path.join(REPO_ROOT, 'apps', 'web', '.vercel', 'project.json');
const AUTH_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'xdg.data', 'com.vercel.cli', 'auth.json');

const KEYS_TO_SYNC = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'APP_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SENTRY_AUTH_TOKEN',
];

const PROD_URL_OVERRIDES = {
  APP_URL: 'https://geosight-web.vercel.app',
};

function parseEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    let val = raw.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadToken() {
  const raw = fs.readFileSync(AUTH_FILE, 'utf8');
  return JSON.parse(raw).token;
}

function loadLink() {
  const raw = fs.readFileSync(VERCEL_LINK, 'utf8');
  return JSON.parse(raw);
}

async function fetchExisting(token, projectId, teamId) {
  const url = `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&decrypt=false`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`list env failed: ${res.status} ${await res.text()}`);
  return (await res.json()).envs ?? [];
}

async function deleteEnv(token, projectId, teamId, envId) {
  const url = `https://api.vercel.com/v9/projects/${projectId}/env/${envId}?teamId=${teamId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete env ${envId} failed: ${res.status} ${await res.text()}`);
  }
}

async function createEnv(token, projectId, teamId, body) {
  const url = `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&upsert=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`create env failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const token = loadToken();
  const link = loadLink();
  const { projectId, orgId: teamId } = link;
  const envFromFile = parseEnv(fs.readFileSync(ENV_FILE, 'utf8'));

  console.info(`Project: ${link.projectName} (${projectId})`);
  console.info(`Source:  ${ENV_FILE}`);
  console.info('');

  // We want to fully control what's in Vercel for the keys we manage — delete
  // existing rows for those keys first, then create fresh.
  const existing = await fetchExisting(token, projectId, teamId);
  const targetKeys = new Set(KEYS_TO_SYNC);
  const toDelete = existing.filter((e) => targetKeys.has(e.key));
  for (const env of toDelete) {
    await deleteEnv(token, projectId, teamId, env.id);
    console.info(`  deleted existing: ${env.key} (${env.target.join('+')})`);
  }

  console.info('');

  const report = { synced: [], skipped: [] };

  for (const key of KEYS_TO_SYNC) {
    const localValue = envFromFile[key];
    if (!localValue) {
      report.skipped.push(key);
      console.info(`  SKIP   ${key.padEnd(38)}  (empty in .env.local)`);
      continue;
    }

    const isPublic = key.startsWith('NEXT_PUBLIC_');
    const type = isPublic ? 'plain' : 'encrypted';

    // For APP_URL we want a different value in production vs development.
    if (key === 'APP_URL') {
      // Production + preview → Vercel domain
      await createEnv(token, projectId, teamId, {
        key,
        value: PROD_URL_OVERRIDES.APP_URL,
        type,
        target: ['production', 'preview'],
      });
      // Development → keep local value (usually http://localhost:3000)
      await createEnv(token, projectId, teamId, {
        key,
        value: localValue,
        type,
        target: ['development'],
      });
      report.synced.push(`${key} (prod/preview=override, dev=local)`);
      console.info(`  SYNC   ${key.padEnd(38)}  prod=override, dev=local`);
      continue;
    }

    await createEnv(token, projectId, teamId, {
      key,
      value: localValue,
      type,
      target: ['production', 'preview', 'development'],
    });
    report.synced.push(key);
    console.info(
      `  SYNC   ${key.padEnd(38)}  type=${type.padEnd(9)}  targets=prod+preview+dev`,
    );
  }

  console.info('');
  console.info(`Summary: ${report.synced.length} synced, ${report.skipped.length} skipped`);
  if (report.skipped.length) {
    console.info('Skipped (empty locally):');
    for (const k of report.skipped) console.info('  - ' + k);
  }
}

main().catch((err) => {
  console.error('vercel-env-sync failed:', err.message);
  process.exit(1);
});
