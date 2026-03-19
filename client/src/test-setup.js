import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock padrão de fetch para evitar erros do logger.js em todos os testes
global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
})
