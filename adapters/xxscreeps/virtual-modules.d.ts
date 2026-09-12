// xxscreeps' mods overhaul moved mod constants/config/effects behind virtual
// `xxscreeps:mods/*` modules; pull in upstream's ambient declarations so tsc
// resolves them (config/nodejs.js serves them at runtime). Constants and the
// mod-contributed Room/RoomObject interfaces live in hand-written `xx.d.ts`
// files that tsc picks up through the tsconfig include glob.
/// <reference path="../../node_modules/xxscreeps/config/declarations/config.d.ts" />
/// <reference path="../../node_modules/xxscreeps/config/declarations/effects.d.ts" />
