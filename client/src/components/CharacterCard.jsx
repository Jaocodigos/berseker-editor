import { useState } from "react";
import Modal from "./Modal";
import { FireIcon, TrashIcon, PencilIcon } from '@heroicons/react/16/solid'
import { useNavigate } from "react-router-dom";


export default function CharacterCard({ character, onRefresh }) {
    const pillars = character.pillars || [];

    const navigate = useNavigate();

    console.log(`ABILITIES: ${JSON.stringify(pillars)}`)

    const [openAbilities, setOpenAbilities] = useState(false);



    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [openEditAbility, setOpenEditAbility] = useState(false);



    async function deleteCharacter(id) {
        try {
            const res = await fetch(`http://localhost:3001/api/characters/${id}`, {
                method: "DELETE"
            });

            if (!res.ok) throw new Error("Falha ao deletar personagem");

            return await res.json();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }


    return (

        // Card do personagem
        <div className="character-card">
            <h3>{character.nome}</h3>

            {pillars.length > 0 ? (
                <ul className="pillars-list">
                    {pillars.map((p) => (
                        <li key={p.id}>
                            <strong>{p.nome}</strong> ({p.tipo}) — Mana: {p.mana}
                        </li>
                    ))}
                </ul>

            ) : (
                <p className="muted">Ainda sem pilares.</p>
            )}



            <div className="action-section">
                <button className="rpg-button ability-button" onClick={() => navigate(`/characters/${character.id}/abilities`)}>
                    <FireIcon className="size-6 text-blue-500 rpg-icon" />
                </button>
                <button className="rpg-button ability-button" onClick={() => setShowDeleteModal(true)}>
                    <TrashIcon className="size-6 text-blue-500 rpg-icon" />
                </button>
            </div>

            {/* Modal de confirmação de deleção */}
            {showDeleteModal && (
                <div className="rpg-modal">
                    <div className="modal-body">
                        <p>Tem certeza que deseja excluir <strong>{character.nome}</strong>?</p>
                        <div className="action-section">
                            <button
                                className="rpg-button cancel-button"
                                onClick={() => setShowDeleteModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="rpg-button delete-button"
                                onClick={async () => {
                                    try {
                                        await deleteCharacter(character.id);
                                        setShowDeleteModal(false);
                                        onRefresh && onRefresh(); // atualiza a lista no Characters.jsx
                                    } catch {
                                        alert("Não foi possível deletar o personagem.");
                                    }
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/*Abrir habilidades*/}
            <Modal
                title={`Habilidades de ${character.nome}`}
                open={openAbilities}
                onClose={() => setOpenAbilities(false)}
            >
                {(() => {
                    const abilities = (character.pillars || []).flatMap(p => p.abilities || []);
                    if (!abilities.length) return <p className="muted">Sem habilidades</p>;
                    return (
                        <ul style={{ width: "100%", padding: "0 1rem"}}>
                            {abilities.map(ab => (
                                <li key={ab.id} style={{ marginBottom: "8px", textAlign: "left" }}>
                                    <strong>{ab.nome}</strong> — dano: {ab.dano}, custo: {ab.custo}
                                    {ab.descricao && (
                                        <div className="muted">{ab.descricao}</div>
                                    )}
                                    <button className="rpg-button delete-button sm" onClick={() => handleDeleteAbility(ab.id)}>
                                        <TrashIcon className="size-6 text-blue-500 rpg-icon" />
                                    </button>

                                </li>
                            ))}
                        </ul>
                    );
                })()}

            </Modal>
        </div>
    );
}