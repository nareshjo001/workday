process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'vms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'm22-test-only-secret';

const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const name = 'vms_migration_ledger_test';
const config = { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD };
function migrate() { return new Promise((resolve, reject) => { const child = spawn(process.execPath, [path.join(__dirname, '../../src/migrations/run.js')], { env: { ...process.env, NODE_ENV: 'test', DB_NAME: name, JWT_SECRET: 'm22-migration-ledger-test-secret' }, stdio: 'pipe' }); let output = ''; child.stdout.on('data', (d) => { output += d; }); child.stderr.on('data', (d) => { output += d; }); child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output))); }); }

after(async () => { const admin = await mysql.createConnection(config); try { await admin.query(`DROP DATABASE IF EXISTS ${name}`); } finally { await admin.end(); } });

test('M22 migration ledger applies a clean schema once and validates a replay without rerunning SQL', { timeout: 60000 }, async () => {
  const admin = await mysql.createConnection(config); await admin.query(`DROP DATABASE IF EXISTS ${name}`); await admin.query(`CREATE DATABASE ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); await admin.end();
  await migrate();
  const connection = await mysql.createConnection({ ...config, database: name });
  const [[first]] = await connection.query('SELECT COUNT(*) count FROM schema_migrations');
  const [[files]] = await connection.query("SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema=? AND table_name IN ('users','payments','schema_migrations')", [name]);
  assert.ok(Number(first.count) >= 36); assert.equal(Number(files.count), 3);
  await connection.end();
  const rerun = await migrate(); assert.match(rerun, /"migrations_complete","applied":0/);
  const verify = await mysql.createConnection({ ...config, database: name }); const [[second]] = await verify.query('SELECT COUNT(*) count FROM schema_migrations'); await verify.end();
  assert.equal(Number(second.count), Number(first.count));
});
