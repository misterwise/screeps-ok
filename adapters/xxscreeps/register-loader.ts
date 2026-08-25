// xxscreeps-only vitest setup: importing config/mods.js runs upstream's
// register('./nodejs.js'), which serves the engine's virtual xxscreeps:mods/*
// modules. setupFiles run before the suite dynamically imports the adapter
// (src/fixture.ts), so the loader is registered before the engine loads.
import 'xxscreeps/config/mods.js';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from 'xxscreeps/config/index.js';
import { warmRuntimeBundle } from './sandbox-runner.js';

// xxscreeps gates hosting its in-process local:// stores behind the file lock
// at config.database.lock (default ./screeps/.lock — one path shared by every
// test worker). A fork that loses the race demotes itself to a "sibling
// process" client and Database.connect fails: the test shard's local:// URLs
// configure no responder socket. Give each worker its own lock so parallel
// forks all host their own isolated in-memory stores.
config.database.lock = pathToFileURL(
	path.join(tmpdir(), `screeps-ok-xxscreeps-${process.pid}.lock`),
).href;

// Pay the isolated sandbox's one-time runtime compile here, not inside the
// first test that calls `player()`.
await warmRuntimeBundle();
