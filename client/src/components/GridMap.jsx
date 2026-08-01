import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowsPointingInIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
} from "@heroicons/react/16/solid";
import { avatarSrc } from "./AvatarUpload";

const BG_COLOR = "#1c1c24";
const LINE_COLOR = "rgba(255, 255, 255, 0.08)";
const TOKEN_BORDER = "#38bdf8";
const ENEMY_BORDER = "#f43f5e";
const DRAG_BORDER = "#fbbf24";
const PLACEHOLDER_BG = "#2b2b38";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;
const EMPTY_CAMERA = { zoom: 1, x: 0, y: 0 };

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Converte uma posição em pixels para a célula correspondente, com clamp aos limites.
export function snapToCell(px, py, cellSize, gridWidth, gridHeight) {
    const cellX = Math.max(0, Math.min(gridWidth - 1, Math.floor(px / cellSize)));
    const cellY = Math.max(0, Math.min(gridHeight - 1, Math.floor(py / cellSize)));
    return { cellX, cellY };
}

export default function GridMap({ map, tokens, onMove, canMove = true }) {
    const viewportRef = useRef(null);
    const canvasRef = useRef(null);
    const imagesRef = useRef({});
    const pointersRef = useRef(new Map());
    const gestureRef = useRef(null);
    const dragRef = useRef(null);
    const cameraRef = useRef(EMPTY_CAMERA);
    const [imgVersion, setImgVersion] = useState(0);
    const [drag, setDrag] = useState(null);
    const [camera, setCamera] = useState(EMPTY_CAMERA);
    const [isNavigating, setIsNavigating] = useState(false);

    const cellSize = map.cellSize || 40;
    const width = map.gridWidth * cellSize;
    const height = map.gridHeight * cellSize;

    const getViewportMetrics = useCallback(() => {
        const viewport = viewportRef.current;
        const canvas = canvasRef.current;
        if (!viewport || !canvas) return null;

        const viewportRect = viewport.getBoundingClientRect();
        const viewportWidth = viewport.clientWidth || viewportRect.width;
        const viewportHeight = viewport.clientHeight || viewportRect.height;
        const baseWidth = canvas.offsetWidth || canvas.clientWidth;
        const baseHeight = canvas.offsetHeight || canvas.clientHeight;

        if (!viewportWidth || !viewportHeight || !baseWidth || !baseHeight) return null;
        return { viewportRect, viewportWidth, viewportHeight, baseWidth, baseHeight };
    }, []);

    const fitZoomForViewport = useCallback(() => {
        const metrics = getViewportMetrics();
        if (!metrics) return 1;
        const { viewportWidth, viewportHeight, baseWidth, baseHeight } = metrics;
        return clamp(Math.min(1, viewportWidth / baseWidth, viewportHeight / baseHeight), 0.1, 1);
    }, [getViewportMetrics]);

    const constrainCamera = useCallback((nextCamera) => {
        const metrics = getViewportMetrics();
        const fitZoom = fitZoomForViewport();
        const zoom = clamp(nextCamera.zoom, Math.min(MIN_ZOOM, fitZoom), MAX_ZOOM);
        if (!metrics) return { ...nextCamera, zoom };

        const { viewportWidth, viewportHeight, baseWidth, baseHeight } = metrics;
        const renderedWidth = baseWidth * zoom;
        const renderedHeight = baseHeight * zoom;
        const x = renderedWidth <= viewportWidth
            ? (viewportWidth - renderedWidth) / 2
            : clamp(nextCamera.x, viewportWidth - renderedWidth, 0);
        const y = renderedHeight <= viewportHeight
            ? (viewportHeight - renderedHeight) / 2
            : clamp(nextCamera.y, viewportHeight - renderedHeight, 0);

        return { zoom, x, y };
    }, [fitZoomForViewport, getViewportMetrics]);

    const commitCamera = useCallback((nextOrUpdater) => {
        const current = cameraRef.current;
        const proposed = typeof nextOrUpdater === "function" ? nextOrUpdater(current) : nextOrUpdater;
        const next = constrainCamera(proposed);
        cameraRef.current = next;
        setCamera((previous) => (
            previous.zoom === next.zoom && previous.x === next.x && previous.y === next.y
                ? previous
                : next
        ));
        return next;
    }, [constrainCamera]);

    const fitMap = useCallback(() => {
        commitCamera({ zoom: fitZoomForViewport(), x: 0, y: 0 });
    }, [commitCamera, fitZoomForViewport]);

    const zoomAt = useCallback((requestedZoom, clientX, clientY) => {
        const metrics = getViewportMetrics();
        const current = cameraRef.current;
        const fitZoom = fitZoomForViewport();
        const nextZoom = clamp(requestedZoom, Math.min(MIN_ZOOM, fitZoom), MAX_ZOOM);

        if (!metrics) {
            commitCamera({ ...current, zoom: nextZoom });
            return;
        }

        const { viewportRect, viewportWidth, viewportHeight } = metrics;
        const anchorX = Number.isFinite(clientX) ? clientX - viewportRect.left : viewportWidth / 2;
        const anchorY = Number.isFinite(clientY) ? clientY - viewportRect.top : viewportHeight / 2;
        const contentX = (anchorX - current.x) / current.zoom;
        const contentY = (anchorY - current.y) / current.zoom;

        commitCamera({
            zoom: nextZoom,
            x: anchorX - contentX * nextZoom,
            y: anchorY - contentY * nextZoom,
        });
    }, [commitCamera, fitZoomForViewport, getViewportMetrics]);

    // Reenquadra ao trocar de mapa e quando a área muda, inclusive em tela cheia.
    useEffect(() => {
        cameraRef.current = EMPTY_CAMERA;
        setCamera(EMPTY_CAMERA);
        const frame = requestAnimationFrame(fitMap);
        return () => cancelAnimationFrame(frame);
    }, [map.id, width, height, fitMap]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return undefined;

        const handleResize = () => fitMap();
        let observer;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(handleResize);
            observer.observe(viewport);
        }
        window.addEventListener("resize", handleResize);
        document.addEventListener("fullscreenchange", handleResize);

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", handleResize);
            document.removeEventListener("fullscreenchange", handleResize);
        };
    }, [fitMap]);

    // Garante que a imagem de um avatar esteja carregada (cache por src).
    const ensureImage = useCallback((src) => {
        if (!src) return null;
        const cache = imagesRef.current;
        if (cache[src]) return cache[src];
        const img = new Image();
        img.onload = () => setImgVersion((version) => version + 1);
        img.src = src;
        cache[src] = img;
        return img;
    }, []);

    // Coordenadas do evento na resolução interna do canvas, já considerando a câmera.
    const eventToPixels = useCallback((event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width || canvas.width);
        const scaleY = canvas.height / (rect.height || canvas.height);
        return {
            px: (event.clientX - rect.left) * scaleX,
            py: (event.clientY - rect.top) * scaleY,
        };
    }, []);

    const tokenAt = useCallback((px, py) => {
        const radius = cellSize * 0.42;
        // Itera de trás para frente: o token desenhado por último ganha o hit.
        for (let index = tokens.length - 1; index >= 0; index--) {
            const token = tokens[index];
            const centerX = token.posX * cellSize + cellSize / 2;
            const centerY = token.posY * cellSize + cellSize / 2;
            if ((px - centerX) ** 2 + (py - centerY) ** 2 <= radius * radius) return token;
        }
        return null;
    }, [tokens, cellSize]);

    // Desenho do mapa, grid e tokens.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");

        context.fillStyle = BG_COLOR;
        context.fillRect(0, 0, width, height);

        const backgroundSrc = avatarSrc(map.backgroundUrl);
        if (backgroundSrc) {
            const background = ensureImage(backgroundSrc);
            if (background && background.complete && background.naturalWidth > 0) {
                context.drawImage(background, 0, 0, width, height);
            }
        }

        context.strokeStyle = LINE_COLOR;
        context.lineWidth = 1;
        context.beginPath();
        for (let x = 0; x <= map.gridWidth; x++) {
            context.moveTo(x * cellSize + 0.5, 0);
            context.lineTo(x * cellSize + 0.5, height);
        }
        for (let y = 0; y <= map.gridHeight; y++) {
            context.moveTo(0, y * cellSize + 0.5);
            context.lineTo(width, y * cellSize + 0.5);
        }
        context.stroke();

        const radius = cellSize * 0.42;
        for (const token of tokens) {
            const dragging = drag && drag.tokenId === token.id;
            const centerX = dragging ? drag.px : token.posX * cellSize + cellSize / 2;
            const centerY = dragging ? drag.py : token.posY * cellSize + cellSize / 2;
            const src = avatarSrc(token.character?.imageUrl);
            const image = src ? ensureImage(src) : null;

            context.save();
            context.beginPath();
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.closePath();
            context.clip();
            if (image && image.complete && image.naturalWidth > 0) {
                context.drawImage(image, centerX - radius, centerY - radius, radius * 2, radius * 2);
            } else {
                context.fillStyle = PLACEHOLDER_BG;
                context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
                context.fillStyle = "#cbd5e1";
                context.font = `${Math.floor(radius)}px sans-serif`;
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText((token.character?.nome || "?").charAt(0).toUpperCase(), centerX, centerY);
            }
            context.restore();

            const isEnemy = token.character?.type === "enemy";
            context.beginPath();
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.lineWidth = dragging ? 3 : 2;
            context.strokeStyle = dragging ? DRAG_BORDER : isEnemy ? ENEMY_BORDER : TOKEN_BORDER;
            context.stroke();

            const name = token.character?.nome;
            if (name) {
                context.font = `600 ${Math.max(10, Math.floor(cellSize * 0.3))}px sans-serif`;
                context.textAlign = "center";
                context.textBaseline = "bottom";
                const textY = centerY - radius - 4;
                context.lineWidth = 3;
                context.strokeStyle = "rgba(0, 0, 0, 0.85)";
                context.strokeText(name, centerX, textY);
                context.fillStyle = "#f1f5f9";
                context.fillText(name, centerX, textY);
            }
        }
    }, [map, tokens, drag, width, height, cellSize, ensureImage, imgVersion]);

    // Pointer Events unifica mouse, toque e caneta.
    const beginPinch = () => {
        const points = [...pointersRef.current.entries()].slice(0, 2);
        if (points.length < 2) return;

        const [[firstId, first], [secondId, second]] = points;
        const metrics = getViewportMetrics();
        const viewportRect = metrics?.viewportRect || { left: 0, top: 0 };
        const centerX = (first.clientX + second.clientX) / 2 - viewportRect.left;
        const centerY = (first.clientY + second.clientY) / 2 - viewportRect.top;
        const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        const current = cameraRef.current;

        dragRef.current = null;
        setDrag(null);
        gestureRef.current = {
            type: "pinch",
            pointerIds: [firstId, secondId],
            startDistance: Math.max(distance, 1),
            startZoom: current.zoom,
            contentX: (centerX - current.x) / current.zoom,
            contentY: (centerY - current.y) / current.zoom,
        };
        setIsNavigating(true);
    };

    const handlePointerDown = (event) => {
        event.preventDefault();
        pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* noop */ }

        if (pointersRef.current.size >= 2) {
            beginPinch();
            return;
        }

        const { px, py } = eventToPixels(event);
        const token = canMove ? tokenAt(px, py) : null;
        if (token) {
            const nextDrag = { tokenId: token.id, px, py };
            dragRef.current = nextDrag;
            gestureRef.current = { type: "token", pointerId: event.pointerId };
            setDrag(nextDrag);
            return;
        }

        gestureRef.current = {
            type: "pan",
            pointerId: event.pointerId,
            lastX: event.clientX,
            lastY: event.clientY,
        };
        setIsNavigating(true);
    };

    const handlePointerMove = (event) => {
        if (!pointersRef.current.has(event.pointerId)) return;
        pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        const gesture = gestureRef.current;
        if (!gesture) return;

        if (gesture.type === "token" && gesture.pointerId === event.pointerId) {
            const { px, py } = eventToPixels(event);
            const nextDrag = dragRef.current ? { ...dragRef.current, px, py } : null;
            dragRef.current = nextDrag;
            setDrag(nextDrag);
            return;
        }

        if (gesture.type === "pan" && gesture.pointerId === event.pointerId) {
            const dx = event.clientX - gesture.lastX;
            const dy = event.clientY - gesture.lastY;
            gestureRef.current = { ...gesture, lastX: event.clientX, lastY: event.clientY };
            commitCamera((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
            return;
        }

        if (gesture.type === "pinch") {
            const [first, second] = gesture.pointerIds.map((id) => pointersRef.current.get(id));
            if (!first || !second) return;

            const metrics = getViewportMetrics();
            const viewportRect = metrics?.viewportRect || { left: 0, top: 0 };
            const centerX = (first.clientX + second.clientX) / 2 - viewportRect.left;
            const centerY = (first.clientY + second.clientY) / 2 - viewportRect.top;
            const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
            const fitZoom = fitZoomForViewport();
            const zoom = clamp(
                gesture.startZoom * (distance / gesture.startDistance),
                Math.min(MIN_ZOOM, fitZoom),
                MAX_ZOOM
            );
            commitCamera({
                zoom,
                x: centerX - gesture.contentX * zoom,
                y: centerY - gesture.contentY * zoom,
            });
        }
    };

    const finishPointer = (event, cancelled = false) => {
        const gesture = gestureRef.current;
        if (gesture?.type === "token" && gesture.pointerId === event.pointerId) {
            const currentDrag = dragRef.current;
            if (!cancelled && currentDrag) {
                const { px, py } = eventToPixels(event);
                const { cellX, cellY } = snapToCell(px, py, cellSize, map.gridWidth, map.gridHeight);
                const token = tokens.find((item) => item.id === currentDrag.tokenId);
                if (token && (token.posX !== cellX || token.posY !== cellY)) {
                    onMove?.(currentDrag.tokenId, cellX, cellY);
                }
            }
            dragRef.current = null;
            setDrag(null);
        }

        pointersRef.current.delete(event.pointerId);
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }

        if (gesture?.type === "pinch" && pointersRef.current.size >= 2) {
            beginPinch();
            return;
        }

        if (gesture?.type === "pinch" && pointersRef.current.size === 1) {
            const [[pointerId, point]] = pointersRef.current.entries();
            gestureRef.current = {
                type: "pan",
                pointerId,
                lastX: point.clientX,
                lastY: point.clientY,
            };
            return;
        }

        if (pointersRef.current.size === 0 || gesture?.type !== "pinch") {
            gestureRef.current = null;
            setIsNavigating(false);
        }
    };

    const handleWheel = (event) => {
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.0015);
        zoomAt(cameraRef.current.zoom * factor, event.clientX, event.clientY);
    };

    return (
        <div ref={viewportRef} className="grid-map-wrapper">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className={`grid-map-canvas${isNavigating ? " is-navigating" : ""}`}
                style={{
                    touchAction: "none",
                    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => finishPointer(event)}
                onPointerCancel={(event) => finishPointer(event, true)}
                onWheel={handleWheel}
            />
            <div className="grid-map-controls" aria-label="Controles do mapa">
                <button
                    type="button"
                    className="grid-map-control-button"
                    aria-label="Diminuir zoom"
                    title="Diminuir zoom"
                    onClick={() => zoomAt(cameraRef.current.zoom / ZOOM_STEP)}
                >
                    <MagnifyingGlassMinusIcon aria-hidden="true" />
                </button>
                <output className="grid-map-zoom-value" aria-label="Nível de zoom">
                    {Math.round(camera.zoom * 100)}%
                </output>
                <button
                    type="button"
                    className="grid-map-control-button"
                    aria-label="Aumentar zoom"
                    title="Aumentar zoom"
                    onClick={() => zoomAt(cameraRef.current.zoom * ZOOM_STEP)}
                >
                    <MagnifyingGlassPlusIcon aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="grid-map-control-button"
                    aria-label="Enquadrar mapa"
                    title="Enquadrar mapa"
                    onClick={fitMap}
                >
                    <ArrowsPointingInIcon aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
