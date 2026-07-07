// Presets de tamanho de mapa. O client envia apenas `size`; o server traduz
// para dimensoes concretas. Proporcao ~3:2 (landscape) em todos.
export const MAP_PRESETS = {
    small: { gridWidth: 15, gridHeight: 10 },
    medium: { gridWidth: 20, gridHeight: 15 },
    large: { gridWidth: 30, gridHeight: 20 },
}

export const DEFAULT_SIZE = 'medium'

// Garante que uma coordenada caia dentro do grid [0, dim-1].
export function clamp(value, max) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(Math.trunc(n), max - 1))
}

// Clampa uma posicao {posX, posY} aos limites de um mapa.
export function clampPosition(posX, posY, gridWidth, gridHeight) {
    return {
        posX: clamp(posX, gridWidth),
        posY: clamp(posY, gridHeight),
    }
}
