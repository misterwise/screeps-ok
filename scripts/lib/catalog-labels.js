// A row's label holds against the vanilla adapter: `verified_vanilla` means
// vanilla runs the row green, so it can't need a capability vanilla lacks or a
// vanilla gap or skip, and a tested row vanilla does run green is
// `verified_vanilla` whatever other source it has.
// `vanilla` is { unsupported: Set<capability>, registered: Set<base id> }.
export function catalogLabelErrors(entries, tested, vanilla) {
	const errors = [];
	for (const entry of entries) {
		const unsupported = entry.capabilities.filter(capability => vanilla.unsupported.has(capability));
		const blockers = [
			...unsupported.map(capability => `needs \`${capability}\`, which vanilla lacks`),
			...vanilla.registered.has(entry.id) ? ['is registered in vanilla\'s parity.json'] : [],
		];
		if (entry.oracle === 'verified_vanilla' && blockers.length > 0) {
			errors.push(`${entry.id} is verified_vanilla but ${blockers.join(' and ')}: label it documented or reported`);
		} else if (entry.oracle !== 'verified_vanilla' && blockers.length === 0 && tested.has(entry.id)) {
			errors.push(`${entry.id} is ${entry.oracle} but vanilla runs it green: label it verified_vanilla`);
		}
	}
	return errors;
}
