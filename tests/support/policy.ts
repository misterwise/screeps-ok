import type { AdapterCapabilities } from '../../src/adapter.js';

type CapabilityName = keyof AdapterCapabilities;

interface CapabilityAwareShard {
	capabilities: AdapterCapabilities;
}

export function requireCapability(
	shard: CapabilityAwareShard,
	skip: (message?: string) => never,
	capability: CapabilityName,
	reason?: string,
): void {
	if (shard.capabilities[capability]) return;
	skip(reason ?? `adapter capability '${capability}' is disabled`);
}
