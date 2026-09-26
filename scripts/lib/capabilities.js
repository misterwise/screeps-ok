// Capability flags read from source without loading an engine: the generators
// run where no engine is installed (the Pages build), and flags are literals.
import { readFileSync } from 'node:fs';

// An adapter's `capabilities` literal: name → declared value.
export function adapterCapabilities(adapterFile) {
	const source = readFileSync(adapterFile, 'utf8');
	const block = source.match(/readonly capabilities: AdapterCapabilities = \{\n([\s\S]*?)\n\t\};/);
	if (!block) throw new Error(`${adapterFile}: no \`readonly capabilities: AdapterCapabilities = { … };\` literal`);
	const declared = new Map();
	for (const line of block[1].replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').split('\n')) {
		if (line.trim() === '') continue;
		const m = line.match(/^\s*(\w+): (true|false),$/);
		if (!m) throw new Error(`${adapterFile}: capability line is not \`name: true|false,\`: ${line.trim()}`);
		declared.set(m[1], m[2] === 'true');
	}
	return declared;
}

// Each capability's first doc-comment sentence from the AdapterCapabilities interface.
export function capabilityDescriptions(adapterContractFile) {
	const source = readFileSync(adapterContractFile, 'utf8');
	const block = source.match(/export interface AdapterCapabilities \{\n([\s\S]*?)\n\}/);
	if (!block) throw new Error(`${adapterContractFile}: no AdapterCapabilities interface`);
	const described = new Map();
	for (const [, doc, name] of block[1].matchAll(/(?:\/\*\*([\s\S]*?)\*\/\s*)?(\w+): boolean;/g)) {
		if (!doc) throw new Error(`${adapterContractFile}: capability ${name} has no doc comment`);
		const text = doc.replace(/^\s*\*\s?/gm, '').replace(/\s+/g, ' ').trim();
		described.set(name, text.match(/^.*?\.(?=\s|$)/)?.[0] ?? text);
	}
	return described;
}

