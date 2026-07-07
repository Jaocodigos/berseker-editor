import { describe, it, expect } from 'vitest'
import { filterCharacters } from '../../utils/filterCharacters'

const chars = [
    { id: 1, nome: 'Aragorn', titleId: 10 },
    { id: 2, nome: 'Legolas', titleId: 11 },
    { id: 3, nome: 'Gimli', titleId: null },
    { id: 4, nome: 'Boromir', titleId: 10 },
]

describe('filterCharacters', () => {
    it('lista vazia retorna vazia', () => {
        expect(filterCharacters([], { name: '', titleIds: [] })).toEqual([])
    })

    it('sem filtros retorna a lista inteira', () => {
        expect(filterCharacters(chars, { name: '', titleIds: [] })).toEqual(chars)
    })

    it('filtra por nome (substring case-insensitive)', () => {
        const result = filterCharacters(chars, { name: 'ara', titleIds: [] })
        expect(result).toEqual([chars[0]])
    })

    it('filtra por titleId numerico', () => {
        const result = filterCharacters(chars, { name: '', titleIds: [10] })
        expect(result.map((c) => c.id)).toEqual([1, 4])
    })

    it('filtra por "null" retorna so quem tem titleId nulo', () => {
        const result = filterCharacters(chars, { name: '', titleIds: ['null'] })
        expect(result.map((c) => c.id)).toEqual([3])
    })

    it('multiplos IDs combinam por OR', () => {
        const result = filterCharacters(chars, { name: '', titleIds: [10, 11] })
        expect(result.map((c) => c.id)).toEqual([1, 2, 4])
    })

    it('mistura IDs numericos com "null" une os dois conjuntos', () => {
        const result = filterCharacters(chars, { name: '', titleIds: [11, 'null'] })
        expect(result.map((c) => c.id)).toEqual([2, 3])
    })

    it('nome + titulos combinam por AND', () => {
        const result = filterCharacters(chars, { name: 'bor', titleIds: [10] })
        expect(result.map((c) => c.id)).toEqual([4])
    })

    it('aceita titleId aninhado em character.title.id como fallback', () => {
        const nested = [
            { id: 1, nome: 'X', title: { id: 42 } },
            { id: 2, nome: 'Y', title: null },
        ]
        const result = filterCharacters(nested, { name: '', titleIds: [42] })
        expect(result.map((c) => c.id)).toEqual([1])
    })
})
