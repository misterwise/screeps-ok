// xxscreeps-only vitest setup: importing config/mods.js runs upstream's
// register('./nodejs.js'), which serves the engine's virtual xxscreeps:mods/*
// modules. setupFiles run before the suite dynamically imports the adapter
// (src/fixture.ts), so the loader is registered before the engine loads.
import 'xxscreeps/config/mods.js';
