// Espelho da matriz de presets do servidor (server/src/utils/grid.js).
// Mapa em dois eixos: shape (formato/proporcao) x size (escala).
// Mantenha em sincronia com o backend.
export const MAP_DIMENSIONS = {
    landscape: {
        small: { gridWidth: 15, gridHeight: 10 },
        medium: { gridWidth: 21, gridHeight: 14 },
        large: { gridWidth: 30, gridHeight: 20 },
    },
    square: {
        small: { gridWidth: 12, gridHeight: 12 },
        medium: { gridWidth: 16, gridHeight: 16 },
        large: { gridWidth: 22, gridHeight: 22 },
    },
    portrait: {
        small: { gridWidth: 10, gridHeight: 15 },
        medium: { gridWidth: 14, gridHeight: 21 },
        large: { gridWidth: 20, gridHeight: 30 },
    },
};

export const DEFAULT_SHAPE = "landscape";
export const DEFAULT_SIZE = "medium";

// Opcoes para os segmented controls (ordem = ordem de exibicao).
export const SHAPE_OPTIONS = [
    { value: "landscape", label: "Paisagem" },
    { value: "square", label: "Quadrado" },
    { value: "portrait", label: "Retrato" },
];

export const SIZE_OPTIONS = [
    { value: "small", label: "Pequeno" },
    { value: "medium", label: "Médio" },
    { value: "large", label: "Grande" },
];

// Resolve { shape, size } para { gridWidth, gridHeight } (ou null se invalido).
export function resolveDimensions(shape = DEFAULT_SHAPE, size = DEFAULT_SIZE) {
    const dims = MAP_DIMENSIONS[shape]?.[size];
    return dims ? { ...dims } : null;
}

// Descobre { shape, size } a partir das dimensoes salvas de um mapa.
// Retorna os defaults se as dimensoes nao casarem com a matriz (mapas antigos).
export function presetFromDims(gridWidth, gridHeight) {
    for (const shape of Object.keys(MAP_DIMENSIONS)) {
        for (const size of Object.keys(MAP_DIMENSIONS[shape])) {
            const d = MAP_DIMENSIONS[shape][size];
            if (d.gridWidth === gridWidth && d.gridHeight === gridHeight) {
                return { shape, size };
            }
        }
    }
    return { shape: DEFAULT_SHAPE, size: DEFAULT_SIZE };
}
