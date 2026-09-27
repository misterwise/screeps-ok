export function testFileClaims(testsDir: string): { file: string; code: string; ids: Set<string> }[];
export function modifiedTests(claims: { file: string; code: string }[]): string[];
export function unkeyedTitles(claims: { file: string; code: string }[]): string[];
