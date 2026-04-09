const DICE_REGEX = /^(\d+)d(\d+)([+-]\d+)?$/i

export function parseDice(notation) {
    if (typeof notation !== 'string') return null

    const match = notation.trim().match(DICE_REGEX)
    if (!match) return null

    const count = parseInt(match[1], 10)
    const sides = parseInt(match[2], 10)
    const modifier = match[3] ? parseInt(match[3], 10) : 0

    if (count < 1 || count > 100 || sides < 1 || sides > 100) return null

    return { count, sides, modifier }
}

export function rollDice(notation) {
    const parsed = parseDice(notation)
    if (!parsed) return null

    const { count, sides, modifier } = parsed
    const rolls = []

    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1)
    }

    const total = rolls.reduce((sum, r) => sum + r, 0) + modifier

    return { notation: notation.trim(), rolls, modifier, total }
}
