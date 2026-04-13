import { test } from './fixture.js';
import type { DocumentedAdapterLimitation } from './limitations.js';
import { hasDocumentedAdapterLimitation } from './limitations.js';

type TestFn = typeof test;

export function limitationGated(limitation: DocumentedAdapterLimitation): TestFn {
	if (!hasDocumentedAdapterLimitation(limitation)) return test;
	const gated = ((name: string, _fn: unknown) => {
		return test(name, ({ task, skip }) => {
			(task.meta as Record<string, unknown>).skipReason = `limitation:${limitation}`;
			skip();
		});
	}) as unknown as TestFn;
	return gated;
}
