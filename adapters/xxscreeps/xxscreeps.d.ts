// xxscreeps doesn't emit .d.ts files. Ambient declarations for type checking.
declare module 'xxscreeps/game/index.js' {
	export type GameConstructor = any;
	export function initializeGameEnvironment(): void;
	export function runForUser(...args: any[]): any;
	export function runOneShot(...args: any[]): any;
	export function runWithState(...args: any[]): any;
	export class GameState { constructor(...args: any[]); }
	export const Game: any;
}

declare module 'xxscreeps/game/room/index.js' {
	export type Room = any;
}

declare module 'xxscreeps/game/position.js' {
	export const RoomPosition: {
		new(x: number, y: number, roomName: string): any;
		[key: string]: any;
	};
}

declare module 'xxscreeps/game/path-finder/index.js' {
	export const search: any;
	export const CostMatrix: any;
}

declare module 'xxscreeps/game/constants/index.js' {
	const constants: any;
	export = constants;
}

declare module 'xxscreeps/test/simulate.js' {
	export function simulate(rooms: Record<string, (room: any) => void>):
		(body: (refs: any) => Promise<void>) => Promise<void>;
}

declare module 'xxscreeps/mods/creep/creep.js' {
	export function create(pos: any, parts: any[], name: string, owner: string): any;
}

declare module 'xxscreeps/mods/spawn/spawn.js' {
	export function create(pos: any, owner: string, name: string): any;
}

declare module 'xxscreeps/mods/spawn/extension.js' {
	export function create(pos: any, level: number, owner: string): any;
}

declare module 'xxscreeps/mods/construction/construction-site.js' {
	export function create(pos: any, structureType: any, owner: string, name?: string | null): any;
}

declare module 'xxscreeps/mods/source/source.js' {
	export class Source { [key: string]: any; }
}

declare module 'xxscreeps/mods/mineral/mineral.js' {
	export class Mineral { [key: string]: any; }
}

declare module 'xxscreeps/mods/chemistry/lab.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/observer/observer.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/defense/tower.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/defense/rampart.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/defense/wall.js' {
	export function create(pos: any): any;
}

declare module 'xxscreeps/mods/logistics/storage.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/logistics/link.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/resource/container.js' {
	export function create(pos: any): any;
}

declare module 'xxscreeps/mods/road/road.js' {
	export function create(pos: any): any;
}

declare module 'xxscreeps/config/mods/index.js' {
	export function importMods(type: string): Promise<void>;
}

declare module 'xxscreeps/config/mods/import/game.js' {}

declare module 'xxscreeps/engine/processor/index.js' {
	export function initializeIntentConstraints(): void;
}

declare module 'xxscreeps/mods/market/terminal.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/factory/factory.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/mineral/extractor.js' {
	export function create(pos: any, owner: string): any;
}

declare module 'xxscreeps/mods/resource/resource.js' {
	export function create(pos: any, resourceType: any, amount: number): any;
}

declare module 'xxscreeps/mods/flag/game.js' {
	export function createFlag(name: string, posInt: number | null, color: any, secondaryColor: any): any;
}
