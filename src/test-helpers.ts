import { test } from './fixture.js';
import { hasDocumentedAdapterLimitation, type AdapterLimitation } from './limitations.js';

type TestFn = typeof test;

/**
 * Wrap a test so it skips when the active adapter reports the named
 * limitation. The decision is made at test-run time against the adapter
 * itself — not at module-import time — so the gating follows the adapter
 * wherever it lives. Consumers who copy the reference adapter inherit its
 * limitation declarations unchanged.
 *
 * A limitation says the engine implements the feature but misbehaves in
 * a way that would hang or corrupt the runner if the test ran. Distinct
 * from `capabilities`, which says the feature is disabled entirely.
 */
export function limitationGated(limitation: AdapterLimitation): TestFn {
	const gated = ((name: string, fn: (ctx: unknown) => unknown) => {
		// vitest requires the test callback's first argument to be an object
		// destructuring pattern (it inspects the function source). So we must
		// name the shape explicitly here rather than passing `ctx` through.
		return test(name, async ({ shard, task, skip }) => {
			if (await hasDocumentedAdapterLimitation(limitation)) {
				(task.meta as Record<string, unknown>).skipReason = `limitation:${limitation}`;
				skip();
				return;
			}
			return fn({ shard, task, skip });
		});
	}) as unknown as TestFn;
	return gated;
}
