import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from '../../src/index.js';

/**
 * Central canonical list of engine parity gaps.
 *
 * A parity gap is a behavior where at least one engine disagrees with the
 * canonical vanilla reference. IDs are stable and adapter-neutral — the same
 * ID is reused across every engine that exhibits the same behavior.
 *
 * This file lists only the IDs and a short adapter-neutral summary. It does
 * not know which engines have which gaps. That mapping lives per-adapter in
 * a `parity.json` companion file next to the adapter entry module, so
 * downstream adapters can declare their own known gaps without editing any
 * file in the canonical test suite.
 *
 * When a new canonical gap is discovered:
 *   1. Add an entry here with a stable adapter-neutral id and a short
 *      summary of the behavioral difference.
 *   2. Tag the test body with `knownParityGap('id')`.
 *   3. Add the id to each affected adapter's `parity.json`
 *      (`expected_failures` array).
 */
export const PARITY_GAPS = {
	'creep-owner-undefined':
		'Creep.owner is undefined on the engine (the key exists but the value ' +
		'is undefined). Vanilla populates it as { username: string } per public ' +
		'docs.',
	'extension-rcl-capacity':
		'StructureExtension.store.getCapacity(energy) ignores the ' +
		'EXTENSION_ENERGY_CAPACITY table and always reports the RCL 8 ' +
		'maximum (200), so room.energyCapacityAvailable over-counts at ' +
		'sub-RCL-8 levels. isActive() and room.energyAvailable now honor ' +
		'CONTROLLER_STRUCTURES correctly for extensions at forbidden RCLs.',
	'describe-exits-topology':
		'Game.map.describeExits filters returned directions by which neighbor ' +
		'rooms exist in the current shard rather than returning all four ' +
		'coordinate-derived neighbors.',
	'pathfinder-suboptimal':
		'PathFinder.search returns a suboptimal (longer) path on open plains ' +
		'where vanilla finds a straight diagonal.',
	'tombstone-corpse-rate':
		'Tombstone stores are reduced by CREEP_CORPSE_RATE on both suicide and ' +
		'ticksToLive death, and no body energy is reclaimed on suicide at high ' +
		'remaining TTL.',
	'link-self-transfer':
		'StructureLink.transferEnergy allows self-transfer (returns OK) where ' +
		'vanilla returns ERR_INVALID_TARGET.',
	'link-cross-owner':
		'StructureLink.transferEnergy allows transfer to another player\'s link ' +
		'(returns OK) where vanilla returns ERR_NOT_OWNER.',
	'death-container-diversion':
		'Creep death does not divert carried resources into a same-tile container. ' +
		'Resources go directly to the tombstone after CREEP_CORPSE_RATE reduction.',
	'extractor-cooldown-off-by-one':
		'Extractor cooldown after harvest reports EXTRACTOR_COOLDOWN - 1 instead of ' +
		'EXTRACTOR_COOLDOWN. The xxscreeps formula uses #cooldownTime = Game.time + ' +
		'EXTRACTOR_COOLDOWN - 1, producing a getter value one less than vanilla.',
	'link-intent-after-idle-tick':
		'link.transferEnergy intents are silently dropped after an idle tick. ' +
		'The intent returns OK but the logistics processor never executes the ' +
		'transfer. Other structure intents (tower.attack, creep.move) are ' +
		'unaffected. xxscreeps has no upstream link processor tests.',
	'lab-unrestricted-mineral-capacity':
		'StructureLab.store.getCapacity(resource) returns LAB_MINERAL_CAPACITY ' +
		'for any mineral-type resource, even resources the lab cannot hold. ' +
		'Vanilla returns null for resources the lab is not currently assigned to.',
	'rampart-no-protection':
		'Ramparts do not absorb damage for objects on their tile. In vanilla, ' +
		'attacks targeting a creep or structure on a rampart tile deal damage to ' +
		'the rampart instead. xxscreeps applies damage directly to the target.',
	'renew-while-spawning':
		'Spawn.renewCreep returns OK while the spawn is actively spawning a creep. ' +
		'Vanilla returns ERR_BUSY.',
	'lab-cooldown-no-decrement':
		'Lab cooldown after runReaction/reverseReaction reports the full REACTION_TIME ' +
		'value instead of REACTION_TIME - 1. Vanilla decrements by one for the ' +
		'processing tick; xxscreeps does not.',
	'lab-not-owner-precedence':
		'Lab runReaction/reverseReaction on an unowned lab returns ERR_RCL_NOT_ENOUGH ' +
		'instead of ERR_NOT_OWNER. xxscreeps checks RCL/isActive before ownership.',
	'observer-room-always-visible':
		'All rooms in the xxscreeps shard are visible to all players regardless ' +
		'of observer usage. Vanilla only reveals rooms with owned objects or active observe.',
	'observer-not-owner-precedence':
		'Observer.observeRoom on an unowned observer returns ERR_RCL_NOT_ENOUGH ' +
		'instead of ERR_NOT_OWNER. xxscreeps checks RCL/isActive before ownership.',
	'mineral-regen-not-implemented':
		'xxscreeps does not process mineral regeneration. Depleted minerals remain ' +
		'at mineralAmount 0 indefinitely and ticksToRegeneration is always 0.',
	'road-decay-not-implemented':
		'xxscreeps does not process road decay. Roads remain at their initial hits ' +
		'indefinitely regardless of nextDecayTime.',
	'container-decay-not-implemented':
		'xxscreeps does not process container decay. Containers remain at their ' +
		'initial hits indefinitely regardless of nextDecayTime.',
	'safemode-concurrent-allowed':
		'xxscreeps allows activateSafeMode on a second controller while another ' +
		'owned controller already has safe mode active. Vanilla returns ERR_BUSY.',
	'destroy-ownership-bypass':
		'xxscreeps allows structure.destroy() even when the room controller is ' +
		'not owned by the calling player. Vanilla returns ERR_NOT_OWNER.',
	'notifyWhenAttacked-not-implemented':
		'xxscreeps does not implement structure.notifyWhenAttacked(). Calling it ' +
		'throws "not a function". Vanilla returns OK/ERR codes.',
	'eventlog-attack-missing':
		'xxscreeps getEventLog() does not include EVENT_ATTACK entries for ' +
		'combat actions. Vanilla records attack events with objectId, targetId, ' +
		'damage, and attackType.',
	'tough-boost-no-reduction':
		'xxscreeps does not apply damage reduction to boosted TOUGH body parts. ' +
		'Incoming damage is applied at full rate regardless of the TOUGH boost ' +
		'compound.',
	'boost-energy-cost-scales':
		'xxscreeps scales energy cost proportionally with boosted output for ' +
		'repair and upgrade. Vanilla charges 1 energy per WORK part per tick ' +
		'regardless of the boost multiplier.',
	'route-callback-ignored':
		'xxscreeps findRoute ignores the routeCallback option. Routes that ' +
		'should be blocked by returning Infinity from the callback are still ' +
		'found.',
	'rampart-decay-not-implemented':
		'xxscreeps does not process rampart decay. Ramparts remain at their ' +
		'initial hits indefinitely regardless of nextDecayTime.',
} as const;

export type ParityGapId = keyof typeof PARITY_GAPS;

/**
 * Shape of the `parity.json` companion file adapters drop next to their
 * entry module to declare which canonical gap IDs they currently exhibit.
 *
 * Example:
 *   {
 *     "expected_failures": [
 *       "creep-owner-undefined",
 *       "extension-rcl-capacity"
 *     ],
 *     "notes": {
 *       "creep-owner-undefined": "xxscreeps Creep does not populate .owner at all."
 *     }
 *   }
 *
 * The helper validates `expected_failures` at load time: unknown gap IDs
 * throw a clear error so typos or renamed gaps surface immediately.
 */
export interface AdapterParityFile {
	expected_failures?: ParityGapId[];
	notes?: Partial<Record<ParityGapId, string>>;
}

let cachedExpectedFailures: Set<ParityGapId> | undefined;

function loadExpectedFailuresForActiveAdapter(): Set<ParityGapId> {
	if (cachedExpectedFailures) return cachedExpectedFailures;

	const adapterPath = process.env.SCREEPS_OK_ADAPTER ?? '';
	if (!adapterPath) {
		cachedExpectedFailures = new Set();
		return cachedExpectedFailures;
	}

	const parityPath = resolve(dirname(adapterPath), 'parity.json');
	let rawContent: string;
	try {
		rawContent = readFileSync(parityPath, 'utf8');
	} catch {
		// No companion file → adapter declares no expected failures.
		cachedExpectedFailures = new Set();
		return cachedExpectedFailures;
	}

	let parsed: AdapterParityFile;
	try {
		parsed = JSON.parse(rawContent) as AdapterParityFile;
	} catch (error) {
		throw new Error(
			`parity-gaps: ${parityPath} is not valid JSON: ${(error as Error).message}`,
		);
	}

	const declared = parsed.expected_failures ?? [];
	const unknown = declared.filter(id => !(id in PARITY_GAPS));
	if (unknown.length > 0) {
		throw new Error(
			`parity-gaps: ${parityPath} declares unknown gap id(s) ` +
			`${unknown.map(id => `'${id}'`).join(', ')}. ` +
			`Register the gap in tests/support/parity-gaps.ts first.`,
		);
	}

	cachedExpectedFailures = new Set(declared);
	return cachedExpectedFailures;
}

/**
 * Prefix stamped onto test names when the active adapter's parity.json
 * lists the gap. This makes expected-failures visible in default console
 * output and parseable from the JSON reporter for dashboard generation.
 */
export const KNOWN_GAP_PREFIX = '[known-gap:';

/**
 * Parse a test fullName and return the gap id if it is a known-gap tagged
 * test, or null otherwise. Used by the dashboard generator to count
 * expected-failures distinct from genuine passes.
 */
export function parseKnownGapTitle(fullName: string): ParityGapId | null {
	const start = fullName.indexOf(KNOWN_GAP_PREFIX);
	if (start < 0) return null;
	const end = fullName.indexOf(']', start + KNOWN_GAP_PREFIX.length);
	if (end < 0) return null;
	const id = fullName.slice(start + KNOWN_GAP_PREFIX.length, end);
	return id in PARITY_GAPS ? (id as ParityGapId) : null;
}

/**
 * Returns the test function to use for a test that exercises a known engine
 * parity gap. The mapping "which engine has which gap" is read from the
 * active adapter's `parity.json` companion file; this function is purely a
 * lookup.
 *
 *   knownParityGap('creep-owner-undefined')('signController writes a sign', async ({ shard }) => {
 *     // body that proves the canonical vanilla behavior; fails on engines
 *     // whose parity.json lists 'creep-owner-undefined' as an expected failure.
 *   });
 *
 * Behavior:
 * - Adapter's parity.json lists the id → delegates to `test.fails` and
 *   prefixes the test name with `[known-gap:<id>] `. A failing body is
 *   reported as passed (expected failure); a passing body is reported as
 *   failed (unexpected pass, regression trap).
 * - Adapter does not list the id, or has no parity.json → delegates to
 *   the regular `test` function with an unchanged name.
 */
export function knownParityGap(id: ParityGapId): typeof test {
	if (!(id in PARITY_GAPS)) {
		throw new Error(`knownParityGap: unknown id '${id}'`);
	}
	if (!loadExpectedFailuresForActiveAdapter().has(id)) {
		return test;
	}
	const failsFn = test.fails as typeof test;
	// Prefix the title so expected-failures are visible in reporter output
	// and can be counted by reading the JSON report. The original title
	// remains after the prefix for traceability.
	return ((name: string, ...rest: unknown[]) =>
		(failsFn as unknown as (n: string, ...r: unknown[]) => void)(
			`${KNOWN_GAP_PREFIX}${id}] ${name}`,
			...rest,
		)) as typeof test;
}
