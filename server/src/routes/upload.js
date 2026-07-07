import express from 'express'
import multer from 'multer'
import fs from 'fs'
import { randomUUID } from 'crypto'
import logger from '../logger.js'
import { AVATARS_DIR, MAPS_DIR } from '../config/paths.js'

const router = express.Router()

// Garante os diretorios no load (multer nao cria diretorios).
// Resolvem para o volume persistente em producao (UPLOADS_DIR).
fs.mkdirSync(AVATARS_DIR, { recursive: true })
fs.mkdirSync(MAPS_DIR, { recursive: true })

export { AVATARS_DIR, MAPS_DIR }

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
}

// Cria um handler de upload para um diretorio/subrota, com limite proprio.
// `publicPrefix` e o caminho publico (servido via /uploads) usado na URL de retorno.
function makeUploader({ dir, publicPrefix, maxSize }) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, dir),
        filename: (req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype] || ''}`),
    })
    const upload = multer({
        storage,
        limits: { fileSize: maxSize },
        fileFilter: (req, file, cb) => {
            if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('INVALID_TYPE'))
            cb(null, true)
        },
    })
    const maxMb = Math.round(maxSize / (1024 * 1024))

    return (req, res, next) => {
        upload.single('image')(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: `Imagem excede o tamanho maximo de ${maxMb}MB` })
                }
                if (err.message === 'INVALID_TYPE') {
                    return res.status(400).json({ error: 'Formato invalido. Use jpg, png ou webp' })
                }
                return next(err)
            }
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado (campo "image")' })
            }
            const imageUrl = `${publicPrefix}/${req.file.filename}`
            logger.info('imagem enviada', { imageUrl, size: req.file.size, requestId: req.requestId })
            res.status(201).json({ imageUrl })
        })
    }
}

const avatarUpload = makeUploader({ dir: AVATARS_DIR, publicPrefix: '/uploads/avatars', maxSize: 5 * 1024 * 1024 })
const mapUpload = makeUploader({ dir: MAPS_DIR, publicPrefix: '/uploads/maps', maxSize: 12 * 1024 * 1024 })

// Ambas as rotas recebem o arquivo no campo "image".
// POST /api/upload/avatar — avatar do personagem
router.post('/avatar', avatarUpload)
// POST /api/upload/map-background — fundo do mapa
router.post('/map-background', mapUpload)

export default router
