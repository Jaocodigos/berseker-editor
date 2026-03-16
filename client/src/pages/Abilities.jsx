import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import {TrashIcon, EyeIcon, PlusIcon} from "@heroicons/react/16/solid/index.js";

export default function Abilities({ onRefresh }) {
    const { characterId } = useParams(); // pega o ID do personagem da URL
    const [character, setCharacter] = useState(null);

    // Controle de estado da habilidade
    const [selectedAbility, setSelectedAbility] = useState(null);
    const [openDropdownId, setOpenDropdownId] = useState(null);

    // Modals
    const [showDescription, setShowDescription] = useState(false);
    const [openAddAbility, setOpenAddAbility] = useState(false);

    useEffect(() => {

        fetchCharacter();

        function handleClickOutside(e) {
            // fecha se clicar fora de qualquer dropdown
            if (!e.target.closest(".dropdown")) {
                setOpenDropdownId(null);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    // Pegar user
    async function fetchCharacter() {
        try {
            const res = await fetch(`http://localhost:3001/api/characters/${characterId}`);
            const data = await res.json();
            setCharacter(data);
        } catch (err) {
            console.error("Erro ao buscar personagem:", err);
        }
    }



    // Criar habilidade
    async function createAbility(abilityData) {
        try {

            console.log(`Criando habilidade: ${JSON.stringify(abilityData)}`);

            const res = await fetch(`http://localhost:3001/api/abilities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...abilityData
                })
            });

            if (!res.ok) throw new Error("Erro ao criar habilidade");

            return await res.json();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    // Deletar habilidades
    async function deleteAbility(abilityId) {
        try {

            console.log(`Deletando habilidade: ${abilityId}`);

            const res = await fetch(`http://localhost:3001/api/abilities/${abilityId}`, {
                method: "DELETE"
            });

            if (res.status !== 204) throw new Error("Falha ao deletar habilidade");

            fetchCharacter()

            return  "Habilidade deletada com sucesso!";
        } catch (err) {
            console.error(err);
            throw err;
        }
    }



    function AbilityRow({ pillar, ability, openDropdownId, setOpenDropdownId }) {
        const isOpen = openDropdownId === ability.id;

        return (
            <tr>
                <td>{ability.nome}</td>
                <td>{pillar.tipo}</td>
                <td>{ability.dano}</td>
                <td>{ability.custo}</td>
                <td>
                    <div className="dropdown">
                        <button
                            className="small"
                            onClick={() =>
                                setOpenDropdownId(isOpen ? null : ability.id)
                            }
                        >
                            ⋮
                        </button>
                        {isOpen && (
                            <div className="dropdown-menu">
                                <div className="dropdown-item">
                                    <button
                                        onClick={() => {
                                            setOpenDropdownId(null); // fecha dropdown
                                            setShowDescription(true);
                                            setSelectedAbility(ability);
                                        }}
                                    >
                                        <EyeIcon className="size-6 text-blue-500 rpg-icon" /> Ver descrição
                                    </button>
                                </div>
                                <div className="dropdown-item">
                                    <button
                                        onClick={() => {
                                            setOpenDropdownId(null); // fecha dropdown
                                            deleteAbility(ability.id);
                                        }}
                                    >
                                        <TrashIcon className="size-6 text-blue-500 rpg-icon" /> Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </td>
            </tr>
        );
    }



    if (!character) return <p>Carregando...</p>;

    return (

        <div className="abilities-page">
            <h3>Habilidades de {character.nome}</h3>
            {/*Novas habilidades*/}
            <button style={{ marginTop: "10px", display: "flex", alignItems: "center"}} className="rpg-button add-button" onClick={() => setOpenAddAbility(true)}>
                <PlusIcon className="size-6 text-blue-500 rpg-icon bg" />
            </button>
            <Modal
                title="Nova Habilidade"
                open={openAddAbility}
                onClose={() => setOpenAddAbility(false)}
            >
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();

                        const ability = {
                            nome: e.target.nome.value,
                            descricao: e.target.descricao.value,
                            dano: e.target.dano.value,
                            custo: Number(e.target.custo.value),
                            pillarId:  Number(e.target.pillarId.value)
                        };

                        try {
                            await createAbility(ability);
                            await fetchCharacter();

                            e.target.reset();
                            setOpenAddAbility(false);

                            onRefresh && onRefresh();
                        } catch {
                            alert("Não foi possível criar a habilidade.");
                        }
                    }}
                >
                    <input name="nome" type="text" placeholder="Nome" required />

                    <input name="dano" type="text" placeholder="Dano" required />
                    <input name="custo" type="number" placeholder="Custo de mana" required />
                    <select name="pillarId" required defaultValue="">
                        {character.pillars.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.nome} ({p.tipo})
                            </option>
                        ))}
                    </select>

                    <textarea name="descricao" placeholder="Descrição" />

                    <button type="submit" className="rpg-button save-button">
                        Salvar
                    </button>
                </form>
            </Modal>
            <table className="rpg-table">
                <thead>
                <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Dano</th>
                    <th>Custo</th>
                    <th>Ações</th>

                </tr>
                </thead>
                <tbody>
                    {character.pillars?.flatMap(p =>
                        p.abilities.map(a => (
                            <AbilityRow key={a.id} pillar={p} ability={a} openDropdownId={openDropdownId}
                                        setOpenDropdownId={setOpenDropdownId} />
                        ))
                    )}
                </tbody>

            </table>
            <Modal
                title={selectedAbility?.nome}
                open={!!selectedAbility}
                onClose={() => setSelectedAbility(null)}
            >
                {selectedAbility && (
                    <>
                        <p><strong>Descrição:</strong></p>
                        <p>{selectedAbility.descricao || "Sem descrição"}</p>
                    </>
                )}
            </Modal>

        </div>
    );
}
