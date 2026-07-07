import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Diretorio base dos arquivos enviados (avatares, futuramente fundos de mapa).
// Em producao (Railway) aponta para o volume persistente via UPLOADS_DIR
// (ex.: /data). Localmente, usa server/uploads.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads')

export const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars')
export const MAPS_DIR = path.join(UPLOADS_DIR, 'maps')
