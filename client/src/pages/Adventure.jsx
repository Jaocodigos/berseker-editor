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
    const [abilityTargetId, setAbilityTargetId] = useState(null);
    const [selectedAbilityId, setSelectedAbilityId] = useState("");
    const [abilitySavingId, setAbilitySavingId] = useState(null);
    const [restTargetId, setRestTargetId] = useState(null);
    const [restSavingId, setRestSavingId] = useState(null);
    const [restHighlightId, setRestHighlightId] = useState(null);

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
        setAbilityTargetId(null);
        setRestTargetId(null);
    };

    const handleOpenRest = (characterId) => {
        setRestTargetId(characterId);
        setDamageTargetId(null);
        setAbilityTargetId(null);
    };

    const handleRest = async (character, type) => {
        try {
            setRestSavingId(character.id);
            const response = await fetch(
                `http://localhost:3001/api/characters/${character.id}/rest`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type }),
                }
            );
            if (!response.ok) throw new Error("Falha ao descansar.");
            const { character: updatedChar, pillars: updatedPillars } = await response.json();
            setCharacters((prev) =>
                prev.map((entry) =>
                    entry.id === character.id
                        ? {
                              ...entry,
                              actualHp: updatedChar.actualHp,
                              pillars: entry.pillars.map((p) => {
                                  const updated = updatedPillars.find((up) => up.id === p.id);
                                  return updated ? { ...p, actualMana: updated.actualMana } : p;
                              }),
                          }
                        : entry
                )
            );
            setRestTargetId(null);
            setRestHighlightId(character.id);
            setTimeout(() => setRestHighlightId(null), 1000);
        } catch (err) {
            console.error(err);
            alert("Nao foi possivel realizar o descanso.");
        } finally {
            setRestSavingId(null);
        }
    };

    const handleOpenAbility = (characterId, character) => {
        setAbilityTargetId(characterId);
        setDamageTargetId(null);
        setRestTargetId(null);
        const allAbilities = (character.pillars || []).flatMap((p) => p.abilities || []);
        setSelectedAbilityId(allAbilities.length > 0 ? String(allAbilities[0].id) : "");
    };

    const handleUseAbility = async (character) => {
        if (!selectedAbilityId) {
            alert("Selecione uma habilidade.");
            return;
        }
        try {
            setAbilitySavingId(character.id);
            const response = await fetch(
                `http://localhost:3001/api/characters/${character.id}/use-ability`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ abilityId: Number(selectedAbilityId) }),
                }
            );
            if (!response.ok) {
                const err = await response.json();
                if (response.status === 400 && err.error === "Mana insuficiente") {
                    alert("Mana insuficiente para usar esta habilidade.");
                    return;
                }
                throw new Error(err.error || "Falha ao usar habilidade.");
            }
            const { pillar } = await response.json();
            setCharacters((prev) =>
                prev.map((entry) =>
                    entry.id === character.id
                        ? {
                              ...entry,
                              pillars: entry.pillars.map((p) =>
                                  p.id === pillar.id ? { ...p, actualMana: pillar.actualMana } : p
                              ),
                          }
                        : entry
                )
            );
            setAbilityTargetId(null);
            setSelectedAbilityId("");
        } catch (err) {
            console.error(err);
            alert("Nao foi possivel usar a habilidade.");
        } finally {
            setAbilitySavingId(null);
        }
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
                    <h1>Aventura</h1>
                    <p className="adventure-subtitle">
                        Adicione personagens para iniciar e acompanhar seu progresso.
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
                                    <p className="muted">Pronto para a aventura.</p>
                                </div>
                                <div className={`adventure-hp${restHighlightId === character.id ? " rest-highlight" : ""}`}>
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
                                    ✖
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
                                        <div key={pillar.id ?? pillar.nome} className={`adventure-pillar${restHighlightId === character.id ? " rest-highlight" : ""}`}>
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
                                <button
                                    className="rpg-button adventure-ability-button"
                                    onClick={() => handleOpenAbility(character.id, character)}
                                >
                                    Usar Habilidade
                                </button>
                                <button
                                    className="rpg-button rest-button"
                                    onClick={() => handleOpenRest(character.id)}
                                >
                                    Descansar
                                </button>
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
                                        className="rpg-button neutral-button"
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
                            {abilityTargetId === character.id && (() => {
                                const allAbilities = (character.pillars || []).flatMap((p) =>
                                    (p.abilities || []).map((a) => ({
                                        ...a,
                                        pillarNome: p.nome,
                                    }))
                                );
                                return (
                                    <div className="adventure-damage">
                                        {allAbilities.length === 0 ? (
                                            <span className="muted">Nenhuma habilidade disponivel.</span>
                                        ) : (
                                            <select
                                                value={selectedAbilityId}
                                                onChange={(e) => setSelectedAbilityId(e.target.value)}
                                            >
                                                {allAbilities.map((a) => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.nome} — Custo: {a.custo} ({a.pillarNome})
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <button
                                            className="rpg-button neutral-button"
                                            onClick={() => handleUseAbility(character)}
                                            disabled={
                                                abilitySavingId === character.id ||
                                                allAbilities.length === 0
                                            }
                                        >
                                            Usar
                                        </button>
                                        <button
                                            className="rpg-button cancel-button"
                                            onClick={() => setAbilityTargetId(null)}
                                            disabled={abilitySavingId === character.id}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                );
                            })()}
                            {restTargetId === character.id && (
                                <div className="adventure-damage">
                                    <button
                                        className="rpg-button neutral-button"
                                        onClick={() => handleRest(character, "short")}
                                        disabled={restSavingId === character.id}
                                    >
                                        Descanso Curto
                                    </button>
                                    <button
                                        className="rpg-button"
                                        onClick={() => handleRest(character, "long")}
                                        disabled={restSavingId === character.id}
                                    >
                                        Descanso Longo
                                    </button>
                                    <button
                                        className="rpg-button cancel-button"
                                        onClick={() => setRestTargetId(null)}
                                        disabled={restSavingId === character.id}
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
                        <button type="submit" className="rpg-button save-button" style={{ width: "auto" }}>
                            Adicionar
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
