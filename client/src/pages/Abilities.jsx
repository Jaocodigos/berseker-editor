import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import {TrashIcon, EyeIcon, PlusIcon, PencilSquareIcon} from "@heroicons/react/16/solid/index.js";
import { useAuth } from "../context/AuthContext";
import logger, { API_URL } from "../logger";

export default function Abilities({ onRefresh }) {
    const { characterId } = useParams();
    const { authHeader } = useAuth()
    const [character, setCharacter] = useState(null);

    const [selectedAbility, setSelectedAbility] = useState(null);
    const [openDropdownId, setOpenDropdownId] = useState(null);

    const [showDescription, setShowDescription] = useState(false);
    const [openAddAbility, setOpenAddAbility] = useState(false);
    const [editingAbility, setEditingAbility] = useState(null);

    useEffect(() => {
        fetchCharacter();

        function handleClickOutside(e) {
            if (!e.target.closest(".dropdown")) {
                setOpenDropdownId(null);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    async function fetchCharacter() {
        try {
            const res = await fetch(`${API_URL}/api/characters/${characterId}`, {
                headers: { ...authHeader }
            });
            const data = await res.json();
            setCharacter(data);
        } catch (err) {
            logger.error('erro ao buscar personagem', { characterId, message: err.message });
        }
    }

    async function createAbility(abilityData) {
        try {
            logger.info('criando habilidade', { nome: abilityData.nome, pillarId: abilityData.pillarId });

            const res = await fetch(`${API_URL}/api/abilities`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeader
                },
                body: JSON.stringify({ ...abilityData })
            });

            if (!res.ok) throw new Error("Erro ao criar habilidade");

            const created = await res.json();
            logger.info('habilidade criada', { id: created.id, nome: created.nome });
            return created;
        } catch (err) {
            logger.error('erro ao criar habilidade', { message: err.message });
            throw err;
        }
    }

    async function updateAbility(abilityId, abilityData) {
        try {
            logger.info('atualizando habilidade', { abilityId });

            const res = await fetch(`${API_URL}/api/abilities/${abilityId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeader
                },
                body: JSON.stringify(abilityData)
            });

            if (!res.ok) throw new Error("Erro ao atualizar habilidade");

            const updated = await res.json();
            logger.info('habilidade atualizada', { id: updated.id });
            return updated;
        } catch (err) {
            logger.error('erro ao atualizar habilidade', { abilityId, message: err.message });
            throw err;
        }
    }

    async function deleteAbility(abilityId) {
        try {
            logger.info('deletando habilidade', { abilityId });

            const res = await fetch(`${API_URL}/api/abilities/${abilityId}`, {
                method: "DELETE",
                headers: { ...authHeader }
            });

            if (res.status !== 204) throw new Error("Falha ao deletar habilidade");

            fetchCharacter()
            logger.info('habilidade deletada', { abilityId });
            return "Habilidade deletada com sucesso!";
        } catch (err) {
            logger.error('erro ao deletar habilidade', { abilityId, message: err.message });
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
                                            setOpenDropdownId(null);
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
                                            setOpenDropdownId(null);
                                            setEditingAbility(ability);
                                        }}
                                    >
                                        <PencilSquareIcon className="size-6 text-blue-500 rpg-icon" /> Editar
                                    </button>
                                </div>
                                <div className="dropdown-item">
                                    <button
                                        onClick={() => {
                                            setOpenDropdownId(null);
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
            <button style={{ marginTop: "10px", display: "flex", alignItems: "center"}} className="rpg-button add-button" onClick={() => setOpenAddAbility(true)}>
                <PlusIcon className="size-6 rpg-icon bg add-icon" />
            </button>
            <Modal
                title="Nova Habilidade"
                open={openAddAbility}
                onClose={() => setOpenAddAbility(false)}
            >
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();

                        const fd = new FormData(e.target);
                        const ability = {
                            nome: fd.get('nome'),
                            descricao: fd.get('descricao'),
                            dano: fd.get('dano'),
                            custo: Number(fd.get('custo')),
                            pillarId: Number(fd.get('pillarId'))
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
                    <div className="form-field">
                        <label>Nome</label>
                        <input name="nome" type="text" placeholder="Nome da habilidade" required />
                    </div>
                    <div className="form-row">
                        <div className="form-field">
                            <label>Dano</label>
                            <input name="dano" type="text" placeholder="ex: 2d6" required />
                        </div>
                        <div className="form-field">
                            <label>Custo de mana</label>
                            <input name="custo" type="number" placeholder="0" required />
                        </div>
                    </div>
                    <div className="form-field">
                        <label>Pilar</label>
                        <select name="pillarId" required defaultValue="">
                            {character.pillars.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nome} ({p.tipo})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-field">
                        <label>Descrição</label>
                        <textarea name="descricao" placeholder="Descreva a habilidade..." />
                    </div>
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
            <Modal
                title="Editar Habilidade"
                open={!!editingAbility}
                onClose={() => setEditingAbility(null)}
            >
                {editingAbility && (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();

                            const fd = new FormData(e.target);
                            const abilityData = {
                                nome: fd.get('nome'),
                                descricao: fd.get('descricao'),
                                dano: fd.get('dano'),
                                custo: Number(fd.get('custo'))
                            };

                            try {
                                await updateAbility(editingAbility.id, abilityData);
                                await fetchCharacter();
                                setEditingAbility(null);
                                onRefresh && onRefresh();
                            } catch {
                                alert("Não foi possível atualizar a habilidade.");
                            }
                        }}
                    >
                        <div className="form-field">
                            <label>Nome</label>
                            <input name="nome" type="text" defaultValue={editingAbility.nome} required />
                        </div>
                        <div className="form-row">
                            <div className="form-field">
                                <label>Dano</label>
                                <input name="dano" type="text" defaultValue={editingAbility.dano} required />
                            </div>
                            <div className="form-field">
                                <label>Custo de mana</label>
                                <input name="custo" type="number" defaultValue={editingAbility.custo} required />
                            </div>
                        </div>
                        <div className="form-field">
                            <label>Descrição</label>
                            <textarea name="descricao" defaultValue={editingAbility.descricao} />
                        </div>
                        <button type="submit" className="rpg-button save-button">
                            Salvar
                        </button>
                    </form>
                )}
            </Modal>
        </div>
    );
}
