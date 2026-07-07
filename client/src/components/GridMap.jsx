import { useEffect, useRef, useState, useCallback } from "react";
import { avatarSrc } from "./AvatarUpload";

const BG_COLOR = "#1c1c24";
const LINE_COLOR = "rgba(255, 255, 255, 0.08)";
const TOKEN_BORDER = "#38bdf8"; // PC (azul)
const ENEMY_BORDER = "#f43f5e"; // inimigo (vermelho)
const DRAG_BORDER = "#fbbf24"; // token sendo arrastado (âmbar)
const PLACEHOLDER_BG = "#2b2b38";

// Converte uma posicao em pixels para a celula mais proxima, com clamp aos limites.
export function snapToCell(px, py, cellSize, gridWidth, gridHeight) {
    const cellX = Math.max(0, Math.min(gridWidth - 1, Math.floor(px / cellSize)));
    const cellY = Math.max(0, Math.min(gridHeight - 1, Math.floor(py / cellSize)));
    return { cellX, cellY };
}

export default function GridMap({ map, tokens, onMove, canMove = true }) {
    const canvasRef = useRef(null);
    const imagesRef = useRef({}); // src -> HTMLImageElement
    const [imgVersion, setImgVersion] = useState(0); // forca redraw quando imagem carrega
    const [drag, setDrag] = useState(null); // { tokenId, px, py }

    const cellSize = map.cellSize || 40;
    const width = map.gridWidth * cellSize;
    const height = map.gridHeight * cellSize;

    // Garante que a imagem de um avatar esteja carregada (cache por src).
    const ensureImage = useCallback((src) => {
        if (!src) return null;
        const cache = imagesRef.current;
        if (cache[src]) return cache[src];
        const img = new Image();
        img.onload = () => setImgVersion((v) => v + 1);
        img.src = src;
        cache[src] = img;
        return img;
    }, []);

    // Coordenadas em pixels do evento, corrigindo a escala do canvas (CSS x resolucao).
    const eventToPixels = useCallback((e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            px: (e.clientX - rect.left) * scaleX,
            py: (e.clientY - rect.top) * scaleY,
        };
    }, []);

    const tokenAt = useCallback((px, py) => {
        const r = cellSize * 0.42;
        // itera de tras pra frente: o desenhado por ultimo (topo) ganha o hit
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            const cx = t.posX * cellSize + cellSize / 2;
            const cy = t.posY * cellSize + cellSize / 2;
            if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) return t;
        }
        return null;
    }, [tokens, cellSize]);

    // ---- Desenho ----
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, width, height);

        // fundo do mapa (imagem esticada para preencher o grid), se houver
        const bgSrc = avatarSrc(map.backgroundUrl);
        if (bgSrc) {
            const bg = ensureImage(bgSrc);
            if (bg && bg.complete && bg.naturalWidth > 0) {
                ctx.drawImage(bg, 0, 0, width, height);
            }
        }

        // linhas do grid
        ctx.strokeStyle = LINE_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= map.gridWidth; x++) {
            ctx.moveTo(x * cellSize + 0.5, 0);
            ctx.lineTo(x * cellSize + 0.5, height);
        }
        for (let y = 0; y <= map.gridHeight; y++) {
            ctx.moveTo(0, y * cellSize + 0.5);
            ctx.lineTo(width, y * cellSize + 0.5);
        }
        ctx.stroke();

        // tokens
        const r = cellSize * 0.42;
        for (const t of tokens) {
            const dragging = drag && drag.tokenId === t.id;
            const cx = dragging ? drag.px : t.posX * cellSize + cellSize / 2;
            const cy = dragging ? drag.py : t.posY * cellSize + cellSize / 2;
            const src = avatarSrc(t.character?.imageUrl);
            const img = src ? ensureImage(src) : null;

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
            } else {
                ctx.fillStyle = PLACEHOLDER_BG;
                ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
                ctx.fillStyle = "#cbd5e1";
                ctx.font = `${Math.floor(r)}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText((t.character?.nome || "?").charAt(0).toUpperCase(), cx, cy);
            }
            ctx.restore();

            const isEnemy = t.character?.type === "enemy";
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.lineWidth = dragging ? 3 : 2;
            ctx.strokeStyle = dragging ? DRAG_BORDER : isEnemy ? ENEMY_BORDER : TOKEN_BORDER;
            ctx.stroke();

            // nome acima do token (contorno escuro para legibilidade)
            const name = t.character?.nome;
            if (name) {
                ctx.font = `600 ${Math.max(10, Math.floor(cellSize * 0.3))}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                const ty = cy - r - 4;
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
                ctx.strokeText(name, cx, ty);
                ctx.fillStyle = "#f1f5f9";
                ctx.fillText(name, cx, ty);
            }
        }
    }, [map, tokens, drag, width, height, cellSize, ensureImage, imgVersion]);

    // ---- Interacao (Pointer Events: mouse + touch) ----
    const handlePointerDown = (e) => {
        if (!canMove) return;
        const { px, py } = eventToPixels(e);
        const t = tokenAt(px, py);
        if (!t) return;
        canvasRef.current.setPointerCapture(e.pointerId);
        setDrag({ tokenId: t.id, px, py });
    };

    const handlePointerMove = (e) => {
        if (!drag) return;
        const { px, py } = eventToPixels(e);
        setDrag((d) => (d ? { ...d, px, py } : d));
    };

    const handlePointerUp = (e) => {
        if (!drag) return;
        const { px, py } = eventToPixels(e);
        const { cellX, cellY } = snapToCell(px, py, cellSize, map.gridWidth, map.gridHeight);
        const token = tokens.find((t) => t.id === drag.tokenId);
        setDrag(null);
        try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        if (token && (token.posX !== cellX || token.posY !== cellY)) {
            onMove(drag.tokenId, cellX, cellY);
        }
    };

    return (
        <div className="grid-map-wrapper">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="grid-map-canvas"
                style={{ touchAction: "none", cursor: canMove ? "grab" : "default" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            />
        </div>
    );
}
