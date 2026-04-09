import { describe, it, expect } from 'vitest'
import { parseDice, rollDice } from '../../utils/dice.js'

describe('parseDice', () => {
    it('parses NdX notation', () => {
        expect(parseDice('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 })
        expect(parseDice('1d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
    })

    it('parses NdX+M notation', () => {
        expect(parseDice('2d6+3')).toEqual({ count: 2, sides: 6, modifier: 3 })
        expect(parseDice('1d8+10')).toEqual({ count: 1, sides: 8, modifier: 10 })
    })

    it('parses NdX-M notation', () => {
        expect(parseDice('3d8-1')).toEqual({ count: 3, sides: 8, modifier: -1 })
    })

    it('is case insensitive', () => {
        expect(parseDice('2D6+3')).toEqual({ count: 2, sides: 6, modifier: 3 })
    })

    it('trims whitespace', () => {
        expect(parseDice('  2d6+3  ')).toEqual({ count: 2, sides: 6, modifier: 3 })
    })

    it('returns null for invalid notation', () => {
        expect(parseDice('texto')).toBeNull()
        expect(parseDice('especial')).toBeNull()
        expect(parseDice('')).toBeNull()
        expect(parseDice('d6')).toBeNull()
        expect(parseDice('2d')).toBeNull()
        expect(parseDice('2d6+3+1')).toBeNull()
    })

    it('returns null for non-string input', () => {
        expect(parseDice(null)).toBeNull()
        expect(parseDice(undefined)).toBeNull()
        expect(parseDice(123)).toBeNull()
    })

    it('returns null for out-of-range values', () => {
        expect(parseDice('0d6')).toBeNull()
        expect(parseDice('101d6')).toBeNull()
        expect(parseDice('1d0')).toBeNull()
        expect(parseDice('1d101')).toBeNull()
    })
})

describe('rollDice', () => {
    it('returns null for invalid notation', () => {
        expect(rollDice('texto')).toBeNull()
        expect(rollDice(null)).toBeNull()
    })

    it('returns correct structure for valid notation', () => {
        const result = rollDice('2d6+3')
        expect(result).toHaveProperty('notation', '2d6+3')
        expect(result).toHaveProperty('rolls')
        expect(result).toHaveProperty('modifier', 3)
        expect(result).toHaveProperty('total')
        expect(result.rolls).toHaveLength(2)
    })

    it('rolls are within valid range', () => {
        for (let i = 0; i < 50; i++) {
            const result = rollDice('1d6')
            expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
            expect(result.rolls[0]).toBeLessThanOrEqual(6)
        }
    })

    it('total equals sum of rolls plus modifier', () => {
        const result = rollDice('3d6+2')
        const sumOfRolls = result.rolls.reduce((a, b) => a + b, 0)
        expect(result.total).toBe(sumOfRolls + 2)
    })

    it('handles negative modifier', () => {
        const result = rollDice('1d6-1')
        expect(result.modifier).toBe(-1)
        expect(result.total).toBe(result.rolls[0] - 1)
    })

    it('handles zero modifier', () => {
        const result = rollDice('1d20')
        expect(result.modifier).toBe(0)
        expect(result.total).toBe(result.rolls[0])
    })
})
