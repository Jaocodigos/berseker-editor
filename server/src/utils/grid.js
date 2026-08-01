// Presets de mapa em dois eixos independentes:
//   - shape (formato/proporcao): landscape | square | portrait
//   - size (escala): small | medium | large
// O client envia { shape, size }; o server traduz para dimensoes concretas.
// Largura (colunas) mantida sob controle para os tokens continuarem tocaveis
// no celular — so o "landscape large" (30) e claramente orientado a desktop.
export const MAP_DIMENSIONS = {
    landscape: {
        small: { gridWidth: 15, gridHeight: 10 },  // 3:2
        medium: { gridWidth: 21, gridHeight: 14 }, // 3:2
        large: { gridWidth: 30, gridHeight: 20 },  // 3:2
    },
    square: {
        small: { gridWidth: 12, gridHeight: 12 },  // 1:1
        medium: { gridWidth: 16, gridHeight: 16 }, // 1:1
        large: { gridWidth: 22, gridHeight: 22 },  // 1:1
    },
    portrait: {
        small: { gridWidth: 10, gridHeight: 15 },  // 2:3
        medium: { gridWidth: 14, gridHeight: 21 }, // 2:3
        large: { gridWidth: 20, gridHeight: 30 },  // 2:3
    },
}

export const DEFAULT_SHAPE = 'landscape'
export const DEFAULT_SIZE = 'medium'

export const MAP_SHAPES = Object.keys(MAP_DIMENSIONS)
export const MAP_SIZES = Object.keys(MAP_DIMENSIONS[DEFAULT_SHAPE])

// Resolve { shape, size } para { gridWidth, gridHeight }. Retorna null se
// qualquer eixo for invalido (o chamador responde 400).
export function resolveDimensions(shape = DEFAULT_SHAPE, size = DEFAULT_SIZE) {
    const byShape = MAP_DIMENSIONS[shape]
    if (!byShape) return null
    const dims = byShape[size]
    if (!dims) return null
    return { ...dims }
}

// Lookup reverso: descobre { shape, size } a partir das dimensoes salvas.
// Usado no PATCH para saber o eixo nao enviado. Retorna null se nao casar
// (ex.: mapas antigos com dimensoes fora da matriz atual).
export function dimensionsToPreset(gridWidth, gridHeight) {
    for (const shape of MAP_SHAPES) {
        for (const size of MAP_SIZES) {
            const d = MAP_DIMENSIONS[shape][size]
            if (d.gridWidth === gridWidth && d.gridHeight === gridHeight) {
                return { shape, size }
            }
        }
    }
    return null
}

// Include padrao de token nas respostas REST: dados minimos do personagem
// (avatar + HP + type para a sidebar/borda). Compartilhado por maps.js e tokens.js.
export const tokenInclude = {
    character: { select: { id: true, nome: true, type: true, imageUrl: true, actualHp: true, maxHp: true } },
}

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
