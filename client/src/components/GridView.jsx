import { useCallback, useEffect, useRef, useState } from "react";
import GridMap from "./GridMap";
import { getSocket } from "../socket";
import logger, { API_URL } from "../logger";

// Modo mapa da Aventura: mostra o mapa ativo com tokens em tempo real.
// Qualquer jogador pode mover qualquer token (sync via Socket.IO).
export default function GridView() {
    const [activeMap, setActiveMap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const mapIdRef = useRef(null);

    const loadActiveMap = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_URL}/api/maps`);
            if (!res.ok) throw new Error("falha ao listar mapas");
            const maps = await res.json();
            const active = maps.find((m) => m.active);
            if (!active) {
                setActiveMap(null);
                return;
            }
            const detail = await fetch(`${API_URL}/api/maps/${active.id}`);
            if (!detail.ok) throw new Error("falha ao carregar mapa");
            setActiveMap(await detail.json());
        } catch (err) {
            logger.error("erro ao carregar mapa ativo", { message: err.message });
            setError("Não foi possível carregar o mapa.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadActiveMap();
    }, [loadActiveMap]);

    // Socket: join na sala do mapa ativo + listeners de sincronizacao.
    useEffect(() => {
        const socket = getSocket();
        const mapId = activeMap?.id;
        mapIdRef.current = mapId;

        const onMoved = ({ tokenId, posX, posY }) => {
            setActiveMap((prev) =>
                prev ? { ...prev, tokens: prev.tokens.map((t) => (t.id === tokenId ? { ...t, posX, posY } : t)) } : prev
            );
        };
        const onAdded = ({ token }) => {
            setActiveMap((prev) =>
                prev && prev.id === token.gameMapId && !prev.tokens.some((t) => t.id === token.id)
                    ? { ...prev, tokens: [...prev.tokens, token] }
                    : prev
            );
        };
        const onRemoved = ({ tokenId }) => {
            setActiveMap((prev) => (prev ? { ...prev, tokens: prev.tokens.filter((t) => t.id !== tokenId) } : prev));
        };
        const onActivated = () => loadActiveMap();
        const onConnect = () => {
            if (mapIdRef.current) socket.emit("grid:join", { mapId: mapIdRef.current });
        };

        socket.on("grid:moved", onMoved);
        socket.on("grid:added", onAdded);
        socket.on("grid:removed", onRemoved);
        socket.on("grid:activated", onActivated);
        socket.on("connect", onConnect);

        if (mapId) socket.emit("grid:join", { mapId });

        return () => {
            if (mapId) socket.emit("grid:leave", { mapId });
            socket.off("grid:moved", onMoved);
            socket.off("grid:added", onAdded);
            socket.off("grid:removed", onRemoved);
            socket.off("grid:activated", onActivated);
            socket.off("connect", onConnect);
        };
    }, [activeMap?.id, loadActiveMap]);

    const handleMove = useCallback((tokenId, posX, posY) => {
        // Atualiza otimisticamente e propaga; o servidor rebroadcast confirma.
        setActiveMap((prev) =>
            prev ? { ...prev, tokens: prev.tokens.map((t) => (t.id === tokenId ? { ...t, posX, posY } : t)) } : prev
        );
        getSocket().emit("grid:move", { tokenId, posX, posY });
    }, []);

    if (loading) {
        return <div className="grid-empty"><p className="muted">Carregando mapa…</p></div>;
    }
    if (error) {
        return <div className="grid-empty"><p className="muted">{error}</p></div>;
    }
    if (!activeMap) {
        return (
            <div className="grid-empty">
                <h2>Nenhum mapa ativo</h2>
                <p className="muted">O mestre precisa criar e ativar um mapa em "Mapas".</p>
            </div>
        );
    }

    const tokens = activeMap.tokens ?? [];

    return (
        <div className="grid-view">
            <div className="grid-view-main">
                <GridMap map={activeMap} tokens={tokens} onMove={handleMove} />
            </div>
            <aside className="grid-sidebar">
                <h3 className="grid-sidebar-title">{activeMap.nome}</h3>
                {tokens.length === 0 ? (
                    <p className="muted">Sem tokens no mapa.</p>
                ) : (
                    <ul className="grid-sidebar-list">
                        {tokens.map((t) => (
                            <li key={t.id} className="grid-sidebar-item">
                                <span className="grid-sidebar-name">{t.character?.nome}</span>
                                <span className="grid-sidebar-hp">
                                    {t.character?.actualHp ?? "--"}/{t.character?.maxHp ?? "--"} HP
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>
        </div>
    );
}
