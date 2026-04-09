/**
 * Shared catalog parser for behaviors.md.
 *
 * Extracts catalog entries with their IDs, sections, capabilities, and
 * oracle status. Used by generate-coverage.js and validate-capabilities.js.
 */
import { readFileSync } from 'node:fs';

const ID_RE = /`([A-Z]+-(?:[A-Z]+-)?[0-9]{3})`/;
const CLASS_RE = /`(behavior|matrix)`/;
const ORACLE_RE = /`(verified_vanilla|needs_vanilla_verification)`/;
const CAPABILITY_RE = /`capability:\s*(\w+)`/;
const SECTION_RE = /^(#{1,3})\s+(.+)/;

export function parseCatalog(behaviorsPath) {
	const lines = readFileSync(behaviorsPath, 'utf8').split('\n');
	const entries = [];
	let currentSection = '';
	let currentSubsection = '';
	let sectionCapability = null;
	let currentCapability = null;

	for (const line of lines) {
		const sectionMatch = line.match(SECTION_RE);
		if (sectionMatch) {
			const level = sectionMatch[1].length;
			const title = sectionMatch[2].trim();
			const capMatch = title.match(CAPABILITY_RE);
			if (level === 2) {
				currentSection = title.replace(CAPABILITY_RE, '').trim();
				currentSubsection = '';
				sectionCapability = capMatch ? capMatch[1] : null;
				currentCapability = sectionCapability;
			} else if (level === 3) {
				currentSubsection = title.replace(CAPABILITY_RE, '').trim();
				currentCapability = capMatch ? capMatch[1] : sectionCapability;
			}
			continue;
		}

		const idMatch = line.match(ID_RE);
		if (!idMatch) continue;

		const id = idMatch[1];
		const classMatch = line.match(CLASS_RE);
		const oracleMatch = line.match(ORACLE_RE);

		entries.push({
			id,
			section: currentSection,
			subsection: currentSubsection,
			capability: currentCapability,
			entryClass: classMatch ? classMatch[1] : null,
			oracle: oracleMatch ? oracleMatch[1] : null,
		});
	}

	return entries;
}
