export interface ValidationCondition<Name extends string> {
	condition: Name;
	expectedRc: number;
}

export interface ValidationCase<CatalogId extends string, Name extends string> {
	catalogId: CatalogId;
	label: string;
	blockers: readonly Name[];
	expectedRc: number;
}

type Exclusion<Name extends string> = readonly [Name, Name];

function isExcluded<Name extends string>(
	left: Name,
	right: Name,
	exclusions: readonly Exclusion<Name>[],
): boolean {
	return exclusions.some(([a, b]) => a === left && b === right);
}

// Emit labels as a single alpha token (camelCase) so they match the framework's
// catalog-id regex (`:[a-zA-Z]+`). Conditions stay hyphenated for readability
// in the matrix definitions and test fixtures; only the generated label is
// transformed.
function toLabelToken(condition: string): string {
	const parts = condition.split('-');
	return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}

function capitalize(token: string): string {
	return token[0].toUpperCase() + token.slice(1);
}

export function makeValidationCases<CatalogId extends string, const Condition extends readonly ValidationCondition<string>[]>(
	catalogId: CatalogId,
	conditions: Condition,
	exclusions: readonly Exclusion<Condition[number]['condition']>[] = [],
): readonly ValidationCase<CatalogId, Condition[number]['condition']>[] {
	type Name = Condition[number]['condition'];
	const singles = conditions.map(condition => ({
		catalogId,
		label: toLabelToken(condition.condition),
		blockers: [condition.condition] as const,
		expectedRc: condition.expectedRc,
	}));
	const pairs: ValidationCase<CatalogId, Name>[] = [];
	for (let leftIndex = 0; leftIndex < conditions.length; leftIndex++) {
		for (let rightIndex = leftIndex + 1; rightIndex < conditions.length; rightIndex++) {
			const left = conditions[leftIndex];
			const right = conditions[rightIndex];
			if (isExcluded(left.condition, right.condition, exclusions)) continue;
			pairs.push({
				catalogId,
				label: `${toLabelToken(left.condition)}Before${capitalize(toLabelToken(right.condition))}`,
				blockers: [left.condition, right.condition],
				expectedRc: left.expectedRc,
			});
		}
	}
	return [...singles, ...pairs];
}
