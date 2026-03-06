await Promise.all([
	Bun.$`bun --bun lefthook install --force`.quiet(),
	Bun.$`bun --bun effect-language-service patch`.quiet(),
]);
