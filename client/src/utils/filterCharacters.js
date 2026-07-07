export function filterCharacters(characters, filters) {
    return characters.filter((c) => {
        if (filters.name) {
            const q = filters.name.toLowerCase();
            if (!c.nome?.toLowerCase().includes(q)) return false;
        }
        if (filters.titleIds.length > 0) {
            const wantsUntitled = filters.titleIds.includes("null");
            const wantedIds = filters.titleIds.filter((v) => v !== "null");
            const charTitleId = c.titleId ?? c.title?.id ?? null;
            const matches =
                (charTitleId == null && wantsUntitled) ||
                (charTitleId != null && wantedIds.includes(charTitleId));
            if (!matches) return false;
        }
        return true;
    });
}
