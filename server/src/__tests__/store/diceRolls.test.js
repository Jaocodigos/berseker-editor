import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveRoll, getRolls, clearAll } from '../../store/diceRolls.js'

describe('diceRolls store', () => {
    beforeEach(() => {
        clearAll()
    })

    it('saves and retrieves a roll', () => {
        const rollData = { abilityName: 'Fireball', notation: '2d6+3', rolls: [4, 2], modifier: 3, total: 9 }
        saveRoll(1, rollData)

        const result = getRolls([1])
        expect(result[1]).toMatchObject(rollData)
        expect(result[1].at).toBeGreaterThan(0)
    })

    it('returns empty object for unknown character', () => {
        const result = getRolls([99])
        expect(result).toEqual({})
    })

    it('returns only requested characters', () => {
        saveRoll(1, { abilityName: 'A', notation: '1d6', rolls: [3], modifier: 0, total: 3 })
        saveRoll(2, { abilityName: 'B', notation: '1d8', rolls: [5], modifier: 0, total: 5 })

        const result = getRolls([1])
        expect(result[1]).toBeDefined()
        expect(result[2]).toBeUndefined()
    })

    it('overwrites previous roll for same character', () => {
        saveRoll(1, { abilityName: 'A', notation: '1d6', rolls: [3], modifier: 0, total: 3 })
        saveRoll(1, { abilityName: 'B', notation: '1d8', rolls: [5], modifier: 0, total: 5 })

        const result = getRolls([1])
        expect(result[1].abilityName).toBe('B')
    })

    it('expires rolls after 15 seconds', () => {
        saveRoll(1, { abilityName: 'A', notation: '1d6', rolls: [3], modifier: 0, total: 3 })

        vi.useFakeTimers()
        vi.advanceTimersByTime(16000)

        const result = getRolls([1])
        expect(result).toEqual({})

        vi.useRealTimers()
    })

    it('keeps rolls within 15 seconds', () => {
        vi.useFakeTimers()
        const now = Date.now()
        saveRoll(1, { abilityName: 'A', notation: '1d6', rolls: [3], modifier: 0, total: 3 })

        vi.advanceTimersByTime(10000)

        const result = getRolls([1])
        expect(result[1]).toBeDefined()

        vi.useRealTimers()
    })
})
