import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import AvatarUpload from "./AvatarUpload";
import logger, { API_URL } from "../logger";
import {
    SHAPE_OPTIONS, SIZE_OPTIONS, DEFAULT_SHAPE, DEFAULT_SIZE,
    resolveDimensions, presetFromDims,
} from "../utils/mapPresets";

const MAP_BG_ENDPOINT = "/api/upload/map-background";

// Segmented control generico, no estilo dos pills de filtro.
function Segmented({ options, value, onChange, disabled, label }) {
    return (
        <div className="map-size-segmented" role="group" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    className={`map-size-option${value === o.value ? " active" : ""}`}
                    onClick={() => onChange(o.value)}
                    disabled={disabled}
                    aria-pressed={value === o.value}
                >
                    <span className="map-size-label">{o.label}</span>
                </button>
            ))}
        </div>
    );
}

// Seletor de formato + tamanho, com dica das dimensoes resultantes.
function ShapeSizePicker({ shape, size, onShape, onSize, disabled }) {
    const dims = resolveDimensions(shape, size);
    return (
        <div className="map-preset-picker">
            <Segmented options={SHAPE_OPTIONS} value={shape} onChange={onShape} disabled={disabled} label="Formato do mapa" />
            <Segmented options={SIZE_OPTIONS} value={size} onChange={onSize} disabled={disabled} label="Tamanho do mapa" />
            {dims && <p className="map-dims-hint">{dims.gridWidth}×{dims.gridHeight} células</p>}
        </div>
    );
}

export default function MapManager({ open, onClose, characters = [], onMapsChanged }) {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState("");
    const [newShape, setNewShape] = useState(DEFAULT_SHAPE);
    const [newSize, setNewSize] = useState(DEFAULT_SIZE);
    const [newBackground, setNewBackground] = useState(null);
    const [creating, setCreating] = useState(false);

    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editShape, setEditShape] = useState(DEFAULT_SHAPE);
    const [editSize, setEditSize] = useState(DEFAULT_SIZE);
    const [editBackground, setEditBackground] = useState(null);

    const [tokensMapId, setTokensMapId] = useState(null);
    const [tokensMap, setTokensMap] = useState(null); // detalhe com tokens
    const [addCharId, setAddCharId] = useState("");
    const [busy, setBusy] = useState(false);

    const fetchMaps = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/maps`);
            if (!res.ok) throw new Error("Falha ao carregar mapas");
            setMaps(await res.json());
        } catch (err) {
            logger.error("erro ao carregar mapas", { message: err.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) fetchMaps();
    }, [open, fetchMaps]);

    const fetchTokens = useCallback(async (mapId) => {
        try {
            const res = await fetch(`${API_URL}/api/maps/${mapId}`);
            if (!res.ok) throw new Error("Falha ao carregar tokens");
            setTokensMap(await res.json());
        } catch (err) {
            logger.error("erro ao carregar tokens", { message: err.message });
        }
    }, []);

    const createMap = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/api/maps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: newName.trim(), shape: newShape, size: newSize, backgroundUrl: newBackground }),
            });
            if (!res.ok) throw new Error("Falha ao criar mapa");
            setNewName("");
            setNewShape(DEFAULT_SHAPE);
            setNewSize(DEFAULT_SIZE);
            setNewBackground(null);
            await fetchMaps();
            onMapsChanged?.();
        } catch (err) {
            logger.error("erro ao criar mapa", { message: err.message });
            alert("Não foi possível criar o mapa.");
        } finally {
            setCreating(false);
        }
    };

    const startEdit = (map) => {
        const { shape, size } = presetFromDims(map.gridWidth, map.gridHeight);
        setEditId(map.id);
        setEditName(map.nome);
        setEditShape(shape);
        setEditSize(size);
        setEditBackground(map.backgroundUrl ?? null);
    };

    const saveEdit = async (id) => {
        setBusy(true);
        try {
            const res = await fetch(`${API_URL}/api/maps/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: editName.trim(), shape: editShape, size: editSize, backgroundUrl: editBackground }),
            });
            if (!res.ok) throw new Error("Falha ao editar mapa");
            setEditId(null);
            await fetchMaps();
            onMapsChanged?.();
        } catch (err) {
            logger.error("erro ao editar mapa", { message: err.message });
            alert("Não foi possível editar o mapa.");
        } finally {
            setBusy(false);
        }
    };

    const deleteMap = async (id) => {
        setBusy(true);
        try {
            const res = await fetch(`${API_URL}/api/maps/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Falha ao deletar mapa");
            if (tokensMapId === id) { setTokensMapId(null); setTokensMap(null); }
            await fetchMaps();
            onMapsChanged?.();
        } catch (err) {
            logger.error("erro ao deletar mapa", { message: err.message });
            alert("Não foi possível deletar o mapa.");
        } finally {
            setBusy(false);
        }
    };

    const activateMap = async (id) => {
        setBusy(true);
        try {
            const res = await fetch(`${API_URL}/api/maps/${id}/activate`, { method: "POST" });
            if (!res.ok) throw new Error("Falha ao ativar mapa");
            await fetchMaps();
            if (tokensMapId === id) await fetchTokens(id);
            onMapsChanged?.();
        } catch (err) {
            logger.error("erro ao ativar mapa", { message: err.message });
            alert("Não foi possível ativar o mapa.");
        } finally {
            setBusy(false);
        }
    };

    const toggleTokens = (mapId) => {
        if (tokensMapId === mapId) {
            setTokensMapId(null);
            setTokensMap(null);
        } else {
            setTokensMapId(mapId);
            setAddCharId("");
            fetchTokens(mapId);
        }
    };

    const addToken = async (mapId) => {
        if (!addCharId) return;
        setBusy(true);
        try {
            const res = await fetch(`${API_URL}/api/maps/${mapId}/tokens`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ characterId: Number(addCharId) }),
            });
            if (!res.ok) {
                if (res.status === 409) { alert("Personagem já tem token neste mapa."); return; }
                throw new Error("Falha ao adicionar token");
            }
            setAddCharId("");
            await fetchTokens(mapId);
        } catch (err) {
            logger.error("erro ao adicionar token", { message: err.message });
            alert("Não foi possível adicionar o token.");
        } finally {
            setBusy(false);
        }
    };

    const removeToken = async (tokenId, mapId) => {
        setBusy(true);
        try {
            const res = await fetch(`${API_URL}/api/tokens/${tokenId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Falha ao remover token");
            await fetchTokens(mapId);
        } catch (err) {
            logger.error("erro ao remover token", { message: err.message });
            alert("Não foi possível remover o token.");
        } finally {
            setBusy(false);
        }
    };

    // Personagens ainda sem token no mapa aberto.
    const charactersNotOnMap = useMemo(() => {
        const onMap = new Set((tokensMap?.tokens ?? []).map((t) => t.character.id));
        return characters.filter((c) => !onMap.has(c.id));
    }, [characters, tokensMap]);

    return (
        <Modal title="Gerenciar Mapas" open={open} onClose={onClose}>
            <form onSubmit={createMap} className="map-create-form">
                <div className="form-field">
                    <label>Novo mapa</label>
                    <input
                        type="text"
                        placeholder="Nome do mapa"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                </div>
                <div className="form-field">
                    <label>Formato e tamanho</label>
                    <ShapeSizePicker
                        shape={newShape}
                        size={newSize}
                        onShape={setNewShape}
                        onSize={setNewSize}
                        disabled={creating}
                    />
                </div>
                <div className="form-field">
                    <label>Fundo (opcional)</label>
                    <AvatarUpload
                        value={newBackground}
                        onChange={setNewBackground}
                        endpoint={MAP_BG_ENDPOINT}
                        variant="map"
                    />
                </div>
                <button type="submit" className="rpg-button save-button" disabled={creating || !newName.trim()}>
                    {creating ? "Criando…" : "Criar mapa"}
                </button>
            </form>

            <div className="map-list">
                {loading ? (
                    <p className="muted">Carregando mapas…</p>
                ) : maps.length === 0 ? (
                    <p className="muted">Nenhum mapa criado ainda.</p>
                ) : (
                    maps.map((m) => (
                        <div key={m.id} className={`map-item${m.active ? " active" : ""}`}>
                            <div className="map-item-head">
                                <div className="map-item-info">
                                    <strong>{m.nome}</strong>
                                    <span className="map-item-dims">{m.gridWidth}×{m.gridHeight}</span>
                                    {m.active && <span className="map-active-badge">Ativo</span>}
                                </div>
                                <div className="map-item-actions">
                                    <button className="rpg-button sm" onClick={() => activateMap(m.id)} disabled={busy || m.active}>
                                        Ativar
                                    </button>
                                    <button className="rpg-button sm neutral-button" onClick={() => toggleTokens(m.id)} disabled={busy}>
                                        Tokens
                                    </button>
                                    <button className="rpg-button sm neutral-button" onClick={() => startEdit(m)} disabled={busy}>
                                        Editar
                                    </button>
                                    <button className="rpg-button sm delete-button" onClick={() => deleteMap(m.id)} disabled={busy}>
                                        Excluir
                                    </button>
                                </div>
                            </div>

                            {editId === m.id && (
                                <div className="map-edit">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Nome do mapa"
                                    />
                                    <ShapeSizePicker
                                        shape={editShape}
                                        size={editSize}
                                        onShape={setEditShape}
                                        onSize={setEditSize}
                                        disabled={busy}
                                    />
                                    <AvatarUpload
                                        value={editBackground}
                                        onChange={setEditBackground}
                                        endpoint={MAP_BG_ENDPOINT}
                                        variant="map"
                                    />
                                    <div className="map-edit-actions">
                                        <button className="rpg-button sm save-button" onClick={() => saveEdit(m.id)} disabled={busy}>
                                            Salvar
                                        </button>
                                        <button className="rpg-button sm cancel-button" onClick={() => setEditId(null)} disabled={busy}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {tokensMapId === m.id && (
                                <div className="map-tokens">
                                    <div className="map-token-add">
                                        <select value={addCharId} onChange={(e) => setAddCharId(e.target.value)}>
                                            <option value="">Selecione um personagem…</option>
                                            {charactersNotOnMap.map((c) => (
                                                <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                        </select>
                                        <button className="rpg-button sm neutral-button" onClick={() => addToken(m.id)} disabled={busy || !addCharId}>
                                            + Token
                                        </button>
                                    </div>
                                    {(tokensMap?.tokens ?? []).length === 0 ? (
                                        <p className="muted">Nenhum token neste mapa.</p>
                                    ) : (
                                        <ul className="map-token-list">
                                            {tokensMap.tokens.map((t) => (
                                                <li key={t.id}>
                                                    <span>{t.character.nome}</span>
                                                    <button
                                                        className="rpg-button sm delete-button"
                                                        onClick={() => removeToken(t.id, m.id)}
                                                        disabled={busy}
                                                        aria-label={`Remover ${t.character.nome}`}
                                                    >
                                                        ✖
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
}
