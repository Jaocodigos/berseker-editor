import { useState, useEffect } from "react";
import CharacterCard from "../components/CharacterCard";
import { TrashIcon } from '@heroicons/react/16/solid'
import {PlusIcon} from "@heroicons/react/16/solid/index.js";
import { useAuth } from "../context/AuthContext";
import logger from "../logger";

export default function Characters() {
    const { authHeader } = useAuth()
    const [showModal, setShowModal] = useState(false);
    const [pillars, setPillars] = useState([]);
    const [characterName, setCharacterName] = useState("");
    const [characterMaxHp, setCharacterMaxHp] = useState("");
    const [characters, setCharacters] = useState([]);

    useEffect(() => {
        fetchCharacters();
    }, []);

    const fetchCharacters = async () => {
        try {
            const res = await fetch("http://localhost:3001/api/characters", {
                headers: { ...authHeader }
            });
            const data = await res.json();
            setCharacters(data);
        } catch (err) {
            logger.error('erro ao carregar personagens', { message: err.message });
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        const personagem = {
            name: characterName,
            maxHp: characterMaxHp === "" ? undefined : Number(characterMaxHp),
            actualHp: characterMaxHp === "" ? undefined : Number(characterMaxHp),
            pillars: pillars.map(p => ({
                name: p.name,
                type: p.type,
                maxMana: Number(p.maxMana),
                actualMana: Number(p.maxMana)
            }))
        };

        logger.info('criando personagem', { nome: personagem.name, pillars: personagem.pillars.length });

        try {
            const response = await fetch("http://localhost:3001/api/characters", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeader
                },
                body: JSON.stringify(personagem)
            });

            if (!response.ok) {
                throw new Error("Erro ao criar o personagem.");
            }

            const data = await response.json();
            logger.info('personagem criado', { id: data.id, nome: data.nome });

            e.target.reset();
            setPillars([]);
            setCharacterMaxHp("");
            setShowModal(false);

            await fetchCharacters();

        } catch (error) {
            logger.error('erro ao criar personagem', { message: error.message });
            alert("Não foi possível criar o personagem.");
        }
    };

    return (
        <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>Veja a lista de personagens e crie habilidades.</p>

            <button className="rpg-button add-button" onClick={() => setShowModal(true)}>
                <PlusIcon className="size-6 rpg-icon bg add-icon" />
            </button>

            <div className="characters-list" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center", marginTop: "2rem" }}>
                {characters.map((char) => (
                    <CharacterCard key={char.id} character={char} onRefresh={fetchCharacters} />
                ))}
            </div>

            {showModal && (
                <div className={"rpg-modal"}>
                    <div className={"modal-body"}>
                        <button className={'close'} onClick={() => setShowModal(false)}>
                            ✖
                        </button>

                        <h2>Adicionar Personagem</h2>

                        <form onSubmit={handleSubmit}>
                            <input type="text" placeholder="Nome do personagem" value={characterName}
                                onChange={(e) => setCharacterName(e.target.value)}/>
                            <input
                                type="number"
                                placeholder="HP"
                                min="0"
                                value={characterMaxHp}
                                onChange={(e) => setCharacterMaxHp(e.target.value)}
                            />

                            {pillars.map((pillar, index) => (
                                <div key={index} className={"pillar-form"}>
                                    <input
                                        type="text"
                                        placeholder="Nome do pilar"
                                        value={pillar.name}
                                        onChange={(e) => handlePillarChange(index, "name", e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tipo"
                                        value={pillar.type}
                                        onChange={(e) => handlePillarChange(index, "type", e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Mana"
                                        value={pillar.maxMana}
                                        onChange={(e) => handlePillarChange(index, "maxMana", e.target.value)}
                                    />
                                    <button type="button" onClick={() => removePillar(index)} className={"rpg-button delete-button sm pillar"}>
                                        ✖
                                    </button>
                                </div>
                            ))}

                            <button type="button" onClick={addPillar} className={"rpg-button character-button"}>
                                + Pilar
                            </button>

                            <button type="submit" className={"rpg-button save-button"} style={{ marginTop: "1rem" }}>
                                Salvar
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
