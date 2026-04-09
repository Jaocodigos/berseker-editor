const EXPIRY_MS = 15000

const recentRolls = new Map()

export function saveRoll(characterId, rollData) {
    recentRolls.set(characterId, { ...rollData, at: Date.now() })
}

export function getRolls(characterIds) {
    const now = Date.now()
    const result = {}
    for (const id of characterIds) {
        const roll = recentRolls.get(id)
        if (roll && now - roll.at < EXPIRY_MS) {
            result[id] = roll
        } else if (roll) {
            recentRolls.delete(id)
        }
    }
    return result
}

export function clearAll() {
    recentRolls.clear()
}
