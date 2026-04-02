export type DocumentedAdapterLimitation =
	| 'headlessMultiPlayer';

function activeAdapterPath(): string {
	return process.env.SCREEPS_OK_ADAPTER ?? '';
}

function isBuiltInAdapter(name: 'vanilla' | 'xxscreeps'): boolean {
	const adapterPath = activeAdapterPath();
	return adapterPath.includes(`/adapters/${name}/`) || adapterPath.endsWith(`${name}.ts`) || adapterPath === name;
}

export function hasDocumentedAdapterLimitation(limitation: DocumentedAdapterLimitation): boolean {
	switch (limitation) {
		case 'headlessMultiPlayer':
			// Vanilla's mockup runtime disables users that own no room objects, so a
			// declared second player without an owned room cannot execute code there.
			return isBuiltInAdapter('vanilla');
	}
}
