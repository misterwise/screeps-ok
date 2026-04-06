// Type declarations for the four big canonical tables imported from
// @screeps/common rather than hand-maintained in this repo.

declare module '@screeps/common/lib/constants.js' {
	export const REACTIONS: Record<string, Record<string, string>>;

	export const BOOSTS: Record<string, Record<string, Record<string, number>>>;

	export const COMMODITIES: Record<string, {
		amount: number;
		cooldown: number;
		components: Record<string, number>;
		level?: number;
	}>;

	export const POWER_INFO: Record<number, {
		className: string;
		level: number[];
		cooldown: number;
		duration?: number;
		effect?: number[];
		range?: number;
		ops?: number;
		energy?: number;
		period?: number;
	}>;
}
