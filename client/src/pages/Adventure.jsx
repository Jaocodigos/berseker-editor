import { useEffect, useMemo, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import Modal from "../components/Modal";

export default function Adventure() {
    const [availableCharacters, setAvailableCharacters] = useState([]);
    const [characters, setCharacters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCharacterId, setSelectedCharacterId] = useState("");
    const [damageTargetId, setDamageTargetId] = useState(null);
    const [damageValue, setDamageValue] = useState("");
    const [damageSavingId, setDamageSavingId] = useState(null);

    const availableOptions = useMemo(() => {
        const selectedIds = new Set(characters.map((character) => character.id));
        return availableCharacters.filter((character) => !selectedIds.has(character.id));
    }, [availableCharacters, characters]);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const fetchCharacters = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch("http://localhost:3001/api/characters", {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error("Falha ao carregar personagens.");
                }
                const data = await response.json();
                if (!isMounted) return;
                setAvailableCharacters(Array.isArray(data) ? data : []);
            } catch (err) {
                if (!isMounted) return;
                if (err.name !== "AbortError") {
                    setError("Nao foi possivel carregar os personagens.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchCharacters();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    const handleOpenAddModal = () => {
        if (availableOptions.length === 0) return;
        setSelectedCharacterId(String(availableOptions[0].id));
        setShowAddModal(true);
    };

    const handleConfirmAdd = () => {
        if (!selectedCharacterId) return;
        const selected = availableOptions.find(
            (character) => String(character.id) === String(selectedCharacterId)
        );
        if (!selected) return;
        setCharacters((prev) => [...prev, selected]);
        setShowAddModal(false);
    };

    const handleOpenDamage = (characterId) => {
        setDamageTargetId(characterId);
        setDamageValue("");
    };

    const handleApplyDamage = async (character) => {
        const parsedDamage = Number(damageValue);
        if (!Number.isFinite(parsedDamage) || parsedDamage <= 0) {
            alert("Informe um dano valido.");
            return;
        }
        const currentHp = Number(character.actualHp ?? character.maxHp ?? 0);
        const nextHp = Math.max(0, currentHp - parsedDamage);

        try {
            setDamageSavingId(character.id);
            const response = await fetch(`http://localhost:3001/api/characters/${character.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actualHp: nextHp }),
            });
            if (!response.ok) {
                throw new Error("Falha ao atualizar HP.");
            }
            setCharacters((prev) =>
                prev.map((entry) =>
                    entry.id === character.id ? { ...entry, actualHp: nextHp } : entry
                )
            );
            setDamageTargetId(null);
            setDamageValue("");
        } catch (err) {
            console.error(err);
            alert("Nao foi possivel aplicar o dano.");
        } finally {
            setDamageSavingId(null);
        }
    };

    const canAdd = availableOptions.length > 0 && !loading;

    return (
        <section className="adventure-page">
            <header className="adventure-header">
                <div className="adventure-title">
                    <h1>Adventure</h1>
                    <p className="adventure-subtitle">
                        Hora da sessao? Adicione personagens para comecar.
                    </p>
                </div>
                <button
                    className="rpg-button add-button adventure-add"
                    onClick={handleOpenAddModal}
                    disabled={!canAdd}
                    title={canAdd ? "Adicionar personagem" : "Nenhum personagem disponivel"}
                >
                    <PlusIcon className="size-6 text-blue-500 rpg-icon bg" />
                    <span>Adicionar</span>
                </button>
            </header>

            <div className="adventure-grid">
                {loading ? (
                    <div className="adventure-empty">
                        <h2>Carregando personagens...</h2>
                        <p>Aguarde um instante.</p>
                    </div>
                ) : error ? (
                    <div className="adventure-empty">
                        <h2>Erro ao carregar</h2>
                        <p>{error}</p>
                    </div>
                ) : characters.length === 0 ? (
                    <div className="adventure-empty">
                        <h2>Nenhum personagem na mesa</h2>
                        <p>Use o botao "Adicionar" para criar o espaco de um personagem.</p>
                    </div>
                ) : (
                    characters.map((character) => (
                        <article className="adventure-card" key={character.id}>
                            <div className="adventure-card-header">
                                <div>
                                    <h3>{character.nome || "Sem nome"}</h3>
                                    <p className="muted">Pronto para a sessao.</p>
                                </div>
                                <div className="adventure-hp">
                                    <span>HP</span>
                                    <strong>
                                        {character.actualHp ?? "--"}/{character.maxHp ?? "--"}
                                    </strong>
                                </div>
                                <button
                                    className="adventure-remove-icon"
                                    onClick={() =>
                                        setCharacters((prev) =>
                                            prev.filter((entry) => entry.id !== character.id)
                                        )
                                    }
                                    title="Remover da mesa"
                                    aria-label="Remover da mesa"
                                    type="button"
                                >
                                    <XMarkIcon className="size-6 rpg-icon" />
                                </button>
                            </div>

                            <div className="adventure-pillars">
                                {(character.pillars || []).length === 0 ? (
                                    <div className="adventure-pillar">
                                        <span className="pillar-name">Sem pilares</span>
                                        <span className="pillar-mana">0/0 Mana</span>
                                    </div>
                                ) : (
                                    character.pillars.map((pillar) => (
                                        <div key={pillar.id ?? pillar.nome} className="adventure-pillar">
                                            <span className="pillar-name">{pillar.nome}</span>
                                            <span className="pillar-mana">
                                                {pillar.actualMana ?? pillar.maxMana ?? 0}/{pillar.maxMana ?? 0} Mana
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="adventure-actions">
                                <button
                                    className="rpg-button delete-button"
                                    onClick={() => handleOpenDamage(character.id)}
                                >
                                    Receber Dano
                                </button>
                                <button className="rpg-button">Usar Habilidade</button>
                                <button className="rpg-button cancel-button">Descansar</button>
                            </div>
                            {damageTargetId === character.id && (
                                <div className="adventure-damage">
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Dano"
                                        value={damageValue}
                                        onChange={(event) => setDamageValue(event.target.value)}
                                    />
                                    <button
                                        className="rpg-button save-button"
                                        onClick={() => handleApplyDamage(character)}
                                        disabled={damageSavingId === character.id}
                                    >
                                        Aplicar
                                    </button>
                                    <button
                                        className="rpg-button cancel-button"
                                        onClick={() => setDamageTargetId(null)}
                                        disabled={damageSavingId === character.id}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </article>
                    ))
                )}
            </div>

            <Modal
                title="Adicionar personagem"
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        handleConfirmAdd();
                    }}
                >
                    <label htmlFor="adventure-character-select" className="muted">
                        Selecione um personagem
                    </label>
                    <select
                        id="adventure-character-select"
                        value={selectedCharacterId}
                        onChange={(event) => setSelectedCharacterId(event.target.value)}
                    >
                        {availableOptions.map((character) => (
                            <option key={character.id} value={character.id}>
                                {character.nome}
                            </option>
                        ))}
                    </select>
                    <div className="action-section">
                        <button
                            type="button"
                            className="rpg-button cancel-button"
                            onClick={() => setShowAddModal(false)}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="rpg-button save-button">
                            Adicionar
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
