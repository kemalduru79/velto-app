import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// This suite must never connect to an existing application database.
assert.equal(process.env.PGDATABASE, 'source_authority_ci');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PGPORT, '5432');
assert.equal(process.env.PGUSER, 'postgres');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
const psql = (sql) => execFileSync('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
assert.equal(psql('select current_database()'), 'source_authority_ci');
const owner = '00000000-0000-0000-0000-000000000001';
const project = '10000000-0000-0000-0000-000000000001';
const row = (digest, parent = null) => `jsonb_build_object('owner_user_id','${owner}','project_id','${project}','snapshot_digest','${digest}','parent_snapshot_digest',${parent ? `'${parent}'` : 'null'},'editorial_context','{}'::jsonb,'original_research_graph','{}'::jsonb,'initial_research_graph','{}'::jsonb,'research_graph_digest',repeat('c',64))`;
const begin = () => Number(psql(`set role service_role; select public.creator_begin_research_revision('${owner}','${project}')`));
const activate = (revision, digest, parent = null) => `select public.creator_activate_research_snapshot('${owner}','${project}',${revision},${parent ? `'${parent}'` : 'null'},${row(digest,parent)})`;
const start = (name, sql) => {
  const child = spawn('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: { ...process.env, PGAPPNAME: name }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => error += chunk);
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => resolve({ code, output, error })); });
  return { done, child };
};
async function awaitSleep(name) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (psql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep'`) === '1') return;
    await delay(30);
  }
  throw new Error(`Timed out waiting for synthetic session ${name}`);
}
const a = 'e'.repeat(64), b = 'f'.repeat(64), c = '1'.repeat(64), d = '2'.repeat(64);
const first = begin();
const stale = start('velto-stale-ci', `set role service_role; select pg_sleep(3); ${activate(first,a)}`);
await awaitSleep('velto-stale-ci');
const second = begin();
psql(`set role service_role; ${activate(second,b)}`);
const staleResult = await stale.done; assert.notEqual(staleResult.code, 0); assert.match(staleResult.error, /RESEARCH_REVISION_STALE/);
assert.equal(psql(`select active_research_snapshot_digest from public.velto_projects where id='${project}'`), b);
const winner = start('velto-winner-ci', `set role service_role; begin; ${activate(second,c,b)}; select pg_sleep(3); commit`);
await awaitSleep('velto-winner-ci');
const competing = start('velto-competing-ci', `set role service_role; ${activate(second,d,b)}`);
let observedLock = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (psql("select count(*) from pg_stat_activity where application_name='velto-competing-ci' and wait_event_type='Lock'") === '1') { observedLock = true; break; }
  await delay(30);
}
assert.equal(observedLock, true, 'competing augmentation must actually wait on the project row lock');
const [won, lost] = await Promise.all([winner.done, competing.done]);
assert.equal(won.code, 0, won.error); assert.notEqual(lost.code, 0); assert.match(lost.error, /RESEARCH_PARENT_STALE/);
assert.equal(psql(`select active_research_snapshot_digest from public.velto_projects where id='${project}'`), c);
assert.equal(psql(`select count(*) from public.creator_source_authority_snapshots where snapshot_digest='${d}'`), '0');
console.log('POSTGRES_TWO_SESSION_STALE_AND_COMPETING_AUGMENTATION=PASS');
