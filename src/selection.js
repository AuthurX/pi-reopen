export function isListIndex(input) {
	return /^\d+$/.test(String(input));
}

export function resolveListIndexes(inputs, items) {
	const ids = new Set();
	const invalid = [];
	for (const input of inputs) {
		const index = Number(input);
		if (!Number.isSafeInteger(index) || index < 1 || index > items.length) {
			invalid.push(String(input));
			continue;
		}
		ids.add(items[index - 1].entry?.sessionId ?? items[index - 1].sessionId);
	}
	return { ids: [...ids], invalid };
}

export function resolveOnlySelectors(selectors, items) {
	const indexes = selectors.filter(isListIndex);
	const resolved = resolveListIndexes(indexes, items);
	return {
		onlyIds: resolved.ids,
		only: selectors.filter((selector) => !isListIndex(selector)),
		invalid: resolved.invalid,
	};
}
