// xxscreeps' mods overhaul moved mod constants/config/effects behind virtual
// `xxscreeps:mods/*` modules; pull in upstream's ambient declarations so tsc
// resolves them (config/nodejs.js serves them at runtime).
/// <reference path="../../node_modules/xxscreeps/config/declarations/constants.d.ts" />
/// <reference path="../../node_modules/xxscreeps/config/declarations/config.d.ts" />
/// <reference path="../../node_modules/xxscreeps/config/declarations/effects.d.ts" />
