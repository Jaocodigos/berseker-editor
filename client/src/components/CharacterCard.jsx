import { useState } from "react";
import Modal from "./Modal";
import { FireIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


export default function CharacterCard({ character, onRefresh }) {
    const { authHeader } = useAuth()
    const pillars = character.pillars || [];
    const navigate = useNavigate();

    console.log(`ABILITIES: ${JSON.stringify(pillars)}`)

    const [openAbilities, setOpenAbilities] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    async function deleteCharacter(id) {
        try {
            const res = await fetch(`http://localhost:3001/api/characters/${id}`, {
                method: "DELETE",
                headers: { ...authHeader }
            });

            if (!res.ok) throw new Error("Falha ao deletar personagem");

            return res.status === 204 ? null : await res.json();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }


    return (
        <div className={`character-card${showDeleteModal ? " modal-open" : ""}`}>
            <h3>{character.nome}</h3>

            {pillars.length > 0 ? (
                <ul className="pillars-list">
                    {pillars.map((p) => (
                        <li key={p.id}>
                            <strong>{p.nome}</strong> ({p.tipo}) — Mana: {p.actualMana ?? p.maxMana ?? "--"}/{p.maxMana ?? "--"}
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
                                        onRefresh && onRefresh();
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
                                </li>
                            ))}
                        </ul>
                    );
                })()}
            </Modal>
        </div>
    );
}
