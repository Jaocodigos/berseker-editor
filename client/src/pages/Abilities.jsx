import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import {TrashIcon, EyeIcon} from "@heroicons/react/16/solid/index.js";

export default function Abilities(onRefresh) {
    const { characterId } = useParams(); // pega o ID do personagem da URL
    const [character, setCharacter] = useState(null);

    // Controle de estado da habilidade
    const [selectedAbility, setSelectedAbility] = useState(null);

    // Modals
    const [showDescription, setShowDescription] = useState(false);

    // Deletar habilidades
    async function deleteAbility(id) {
        try {
            const res = await fetch(`http://localhost:3001/api/abilities/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Falha ao deletar habilidade");
            return await res.json();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    function AbilityRow({ ability }) {
        const [open, setOpen] = useState(false);

        return (
            <tr>
                <td>{ability.nome}</td>
                <td>{ability.descricao}</td>
                <td>{ability.dano}</td>
                <td>{ability.custo}</td>
                <td>
                    <div className="dropdown">
                        <button
                            className="small"
                            onClick={() => setOpen(!open)}
                        >
                            ⋮
                        </button>
                        {open && (
                            <div className="dropdown-menu">
                                <div className="dropdown-item">
                                    <button
                                        onClick={() => {
                                            setOpen(false); // fecha o dropdown
                                            setShowDescription(true); // abre o modal
                                            setSelectedAbility(ability);
                                        }}
                                    >
                                        <EyeIcon className="size-6 text-blue-500 rpg-icon" /> Ver descrição
                                    </button>
                                </div>
                                <div className="dropdown-item">
                                    <button onClick={() => deleteAbility(ability.id)}>
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

    useEffect(() => {

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

        fetchCharacter();
    }, [characterId]);

    if (!character) return <p>Carregando...</p>;

    return (

        <div className="abilities-page">
            <h3>Habilidades de {character.nome}</h3>
            <table className="rpg-table">
                <thead>
                <tr>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Dano</th>
                    <th>Custo</th>
                    <th>Ações</th>

                </tr>
                </thead>
                <tbody>
                    {character.pillars?.flatMap(p =>
                        p.abilities.map(a => (
                            <AbilityRow key={a.id} ability={a} onViewDescription={(ab) => setSelectedAbility(ab)} />
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
