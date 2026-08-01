import { useState, useEffect } from "react";
import CharacterCard from "../components/CharacterCard";
import CharacterFilter from "../components/CharacterFilter";
import { PlusIcon } from "@heroicons/react/16/solid";
import logger, { API_URL } from "../logger";
import { filterCharacters } from "../utils/filterCharacters";

export default function Enemies() {
    const [showModal, setShowModal] = useState(false);
    const [pillars, setPillars] = useState([]);
    const [characterName, setCharacterName] = useState("");
    const [characterMaxHp, setCharacterMaxHp] = useState("");
    const [characterXp, setCharacterXp] = useState("");
    const [characterLevel, setCharacterLevel] = useState("");
    const [characterPillarXp, setCharacterPillarXp] = useState("");
    const [characterPillarLevel, setCharacterPillarLevel] = useState("");
    const [characterTitleId, setCharacterTitleId] = useState("");
    const [enemies, setEnemies] = useState([]);
    const [titles, setTitles] = useState([]);
    const [filters, setFilters] = useState({ name: "", titleIds: [] });

    useEffect(() => {
        fetchEnemies();
        fetchTitles();
    }, []);

    const fetchTitles = async () => {
        try {
            const res = await fetch(`${API_URL}/api/titles`);
            if (!res.ok) return;
            const data = await res.json();
            setTitles(Array.isArray(data) ? data : []);
        } catch (err) {
            logger.error("erro ao carregar titulos", { message: err.message });
        }
    };

    const fetchEnemies = async () => {
        try {
            const res = await fetch(`${API_URL}/api/characters?type=enemy`);
            const data = await res.json();
            setEnemies(data);
        } catch (err) {
            logger.error("erro ao carregar inimigos", { message: err.message });
        }
    };

    const addPillar = () => {
        setPillars([...pillars, { name: "", type: "", maxMana: "" }]);
    };

    const removePillar = (index) => {
        const newPillars = [...pillars];
        newPillars.splice(index, 1);
        setPillars(newPillars);
    };

    const handlePillarChange = (index, field, value) => {
        const newPillars = [...pillars];
        newPillars[index][field] = value;
        setPillars(newPillars);
    };

    const handleToggleAdventure = async (enemy) => {
        const endpoint = enemy.inAdventure ? "leave-adventure" : "join-adventure";
        try {
            const res = await fetch(
                `${API_URL}/api/characters/${enemy.id}/${endpoint}`,
                { method: "POST" }
            );
            if (!res.ok) throw new Error("Falha ao alterar status na aventura");
            await fetchEnemies();
        } catch (err) {
            logger.error("erro ao alterar aventura", {
                enemyId: enemy.id,
                message: err.message,
            });
            alert("Nao foi possivel alterar o status na aventura.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const inimigo = {
            name: characterName,
            type: "enemy",
            titleId: characterTitleId === "" ? null : Number(characterTitleId),
            maxHp: characterMaxHp === "" ? undefined : Number(characterMaxHp),
            actualHp: characterMaxHp === "" ? undefined : Number(characterMaxHp),
            xp: characterXp === "" ? 0 : Number(characterXp),
            level: characterLevel === "" ? 1 : Number(characterLevel),
            pillarXp: characterPillarXp === "" ? 0 : Number(characterPillarXp),
            pillarLevel: characterPillarLevel === "" ? 1 : Number(characterPillarLevel),
            pillars: pillars.map((p) => ({
                name: p.name,
                type: p.type,
                maxMana: Number(p.maxMana),
                actualMana: Number(p.maxMana),
            })),
        };

        logger.info("criando inimigo", {
            nome: inimigo.name,
            pillars: inimigo.pillars.length,
        });

        try {
            const response = await fetch(`${API_URL}/api/characters`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(inimigo),
            });

            if (!response.ok) {
                throw new Error("Erro ao criar o inimigo.");
            }

            const data = await response.json();
            logger.info("inimigo criado", { id: data.id, nome: data.nome });

            e.target.reset();
            setCharacterName("");
            setPillars([]);
            setCharacterMaxHp("");
            setCharacterXp("");
            setCharacterLevel("");
            setCharacterPillarXp("");
            setCharacterPillarLevel("");
            setCharacterTitleId("");
            setShowModal(false);

            await fetchEnemies();
        } catch (error) {
            logger.error("erro ao criar inimigo", { message: error.message });
            alert("Nao foi possivel criar o inimigo.");
        }
    };

    return (
        <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>Gerencie as fichas de inimigos. Apenas o mestre pode ver esta pagina.</p>

            <button
                className="rpg-button add-button"
                aria-label="Adicionar inimigo"
                onClick={() => setShowModal(true)}
            >
                <PlusIcon className="size-6 rpg-icon bg add-icon" />
            </button>

            <CharacterFilter
                titles={titles}
                filters={filters}
                onFiltersChange={setFilters}
            />

            <div className="characters-list">
                {(() => {
                    const visible = filterCharacters(enemies, filters);
                    if (visible.length === 0) {
                        return <p className="filter-empty">Nenhum inimigo encontrado.</p>;
                    }
                    return visible.map((enemy) => (
                        <div key={enemy.id} className="enemy-card-wrapper">
                            <CharacterCard
                                character={enemy}
                                onRefresh={fetchEnemies}
                            />
                            <button
                                className={`rpg-button ${enemy.inAdventure ? "delete-button" : "save-button"} enemy-adventure-toggle`}
                                onClick={() => handleToggleAdventure(enemy)}
                            >
                                {enemy.inAdventure
                                    ? "Remover da Aventura"
                                    : "Enviar para Aventura"}
                            </button>
                        </div>
                    ));
                })()}
            </div>

            {showModal && (
                <div className="rpg-modal">
                    <div className="modal-body">
                        <button
                            className="close"
                            onClick={() => setShowModal(false)}
                        >
                            ✖
                        </button>

                        <h2>Adicionar Inimigo</h2>

                        <form onSubmit={handleSubmit}>
                            <div className="form-field">
                                <label>Nome</label>
                                <input
                                    type="text"
                                    placeholder="Nome do inimigo"
                                    value={characterName}
                                    onChange={(e) =>
                                        setCharacterName(e.target.value)
                                    }
                                />
                            </div>
                            <div className="form-field">
                                <label>Título</label>
                                <select
                                    value={characterTitleId}
                                    onChange={(e) => setCharacterTitleId(e.target.value)}
                                >
                                    <option value="">Sem título</option>
                                    {titles.map((t) => (
                                        <option key={t.id} value={t.id}>{t.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-field">
                                    <label>HP</label>
                                    <input
                                        type="number"
                                        placeholder="HP maximo"
                                        min="0"
                                        value={characterMaxHp}
                                        onChange={(e) =>
                                            setCharacterMaxHp(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label>XP</label>
                                    <input
                                        type="number"
                                        placeholder="XP"
                                        min="0"
                                        value={characterXp}
                                        onChange={(e) =>
                                            setCharacterXp(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Nivel</label>
                                    <input
                                        type="number"
                                        placeholder="Nivel"
                                        min="1"
                                        value={characterLevel}
                                        onChange={(e) =>
                                            setCharacterLevel(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-field">
                                    <label>XP de Pilar</label>
                                    <input
                                        type="number"
                                        placeholder="XP de Pilar"
                                        min="0"
                                        value={characterPillarXp}
                                        onChange={(e) =>
                                            setCharacterPillarXp(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Nivel de Pilar</label>
                                    <input
                                        type="number"
                                        placeholder="Nivel de Pilar"
                                        min="1"
                                        value={characterPillarLevel}
                                        onChange={(e) =>
                                            setCharacterPillarLevel(
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            {pillars.map((pillar, index) => (
                                <div key={index} className="pillar-form">
                                    <div className="form-field">
                                        <label>Nome do pilar</label>
                                        <input
                                            type="text"
                                            placeholder="Nome"
                                            value={pillar.name}
                                            onChange={(e) =>
                                                handlePillarChange(
                                                    index,
                                                    "name",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label>Tipo</label>
                                        <input
                                            type="text"
                                            placeholder="FUOR, ELEMUOR ou MUOR"
                                            value={pillar.type}
                                            onChange={(e) =>
                                                handlePillarChange(
                                                    index,
                                                    "type",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label>Mana</label>
                                        <input
                                            type="number"
                                            placeholder="Mana maxima"
                                            value={pillar.maxMana}
                                            onChange={(e) =>
                                                handlePillarChange(
                                                    index,
                                                    "maxMana",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removePillar(index)}
                                        className="rpg-button delete-button sm pillar"
                                    >
                                        ✖
                                    </button>
                                </div>
                            ))}

                            {pillars.length < 3 && (
                                <button
                                    type="button"
                                    onClick={addPillar}
                                    className="rpg-button character-button"
                                >
                                    + Pilar
                                </button>
                            )}

                            <button
                                type="submit"
                                className="rpg-button save-button"
                                style={{ marginTop: "1rem" }}
                            >
                                Salvar
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
