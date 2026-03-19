import { useState } from "react";
import Modal from "./Modal";
import { FireIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/16/solid'
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../logger";


export default function CharacterCard({ character, onRefresh }) {
    const { authHeader } = useAuth()
    const pillars = character.pillars || [];
    const navigate = useNavigate();

    console.log(`ABILITIES: ${JSON.stringify(pillars)}`)

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);
    const [deletedPillarIds, setDeletedPillarIds] = useState([]);
    const [editSaving, setEditSaving] = useState(false);

    function openEditModal() {
        setEditData({
            nome: character.nome,
            maxHp: character.maxHp ?? 0,
            actualHp: character.actualHp ?? 0,
            xp: character.xp ?? 0,
            pillars: pillars.map(p => ({
                id: p.id,
                nome: p.nome,
                tipo: p.tipo,
                maxMana: p.maxMana ?? 0,
                actualMana: p.actualMana ?? 0,
            })),
        });
        setDeletedPillarIds([]);
        setShowEditModal(true);
    }

    function updateEditField(field, value) {
        setEditData(prev => ({ ...prev, [field]: value }));
    }

    function updateEditPillar(index, field, value) {
        setEditData(prev => ({
            ...prev,
            pillars: prev.pillars.map((p, i) => i === index ? { ...p, [field]: value } : p),
        }));
    }

    function addEditPillar() {
        setEditData(prev => ({
            ...prev,
            pillars: [...prev.pillars, { id: null, nome: '', tipo: '', maxMana: 0, actualMana: 0 }],
        }));
    }

    function removeEditPillar(index) {
        const pillar = editData.pillars[index];
        if (pillar.id) {
            setDeletedPillarIds(prev => [...prev, pillar.id]);
        }
        setEditData(prev => ({
            ...prev,
            pillars: prev.pillars.filter((_, i) => i !== index),
        }));
    }

    async function saveEdit() {
        setEditSaving(true);
        try {
            await fetch(`${API_URL}/api/characters/${character.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({
                    name: editData.nome,
                    maxHp: Number(editData.maxHp),
                    actualHp: Number(editData.actualHp),
                    xp: Number(editData.xp),
                }),
            });

            for (const pillarId of deletedPillarIds) {
                await fetch(`${API_URL}/api/pillars/${pillarId}`, {
                    method: 'DELETE',
                    headers: { ...authHeader },
                });
            }

            for (const pillar of editData.pillars) {
                if (pillar.id) {
                    await fetch(`${API_URL}/api/pillars/${pillar.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...authHeader },
                        body: JSON.stringify({
                            nome: pillar.nome,
                            tipo: pillar.tipo,
                            maxMana: Number(pillar.maxMana),
                            actualMana: Number(pillar.actualMana),
                        }),
                    });
                } else {
                    await fetch(`${API_URL}/api/characters/${character.id}/pillars`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeader },
                        body: JSON.stringify({
                            name: pillar.nome,
                            type: pillar.tipo,
                            maxMana: Number(pillar.maxMana),
                            actualMana: Number(pillar.actualMana),
                        }),
                    });
                }
            }

            setShowEditModal(false);
            onRefresh && onRefresh();
        } catch {
            alert('Não foi possível salvar as alterações.');
        } finally {
            setEditSaving(false);
        }
    }

    async function deleteCharacter(id) {
        try {
            const res = await fetch(`${API_URL}/api/characters/${id}`, {
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
        <div className={`character-card${showDeleteModal || showEditModal ? " modal-open" : ""}`}>
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
                <button className="rpg-button ability-button" onClick={openEditModal}>
                    <PencilSquareIcon className="size-6 text-blue-500 rpg-icon" />
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
                title={`Editar ${character.nome}`}
                open={showEditModal}
                onClose={() => setShowEditModal(false)}
            >
                {editData && (
                    <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                        <div className="form-field">
                            <label>Nome</label>
                            <input
                                type="text"
                                placeholder="Nome do personagem"
                                value={editData.nome}
                                onChange={(e) => updateEditField('nome', e.target.value)}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-field">
                                <label>HP máximo</label>
                                <input
                                    type="number"
                                    placeholder="HP máx"
                                    min="0"
                                    value={editData.maxHp}
                                    onChange={(e) => updateEditField('maxHp', e.target.value)}
                                />
                            </div>
                            <div className="form-field">
                                <label>HP atual</label>
                                <input
                                    type="number"
                                    placeholder="HP atual"
                                    min="0"
                                    value={editData.actualHp}
                                    onChange={(e) => updateEditField('actualHp', e.target.value)}
                                />
                            </div>
                            <div className="form-field">
                                <label>XP</label>
                                <input
                                    type="number"
                                    placeholder="XP"
                                    min="0"
                                    value={editData.xp}
                                    onChange={(e) => updateEditField('xp', e.target.value)}
                                />
                            </div>
                        </div>

                        <p>Pilares</p>

                        {editData.pillars.map((pillar, index) => (
                            <div key={pillar.id ?? `new-${index}`} className="pillar-form pillar-form--edit">
                                <div className="form-field">
                                    <label>Nome</label>
                                    <input
                                        type="text"
                                        placeholder="Nome do pilar"
                                        value={pillar.nome}
                                        onChange={(e) => updateEditPillar(index, 'nome', e.target.value)}
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Tipo</label>
                                    <input
                                        type="text"
                                        placeholder="FUOR, ELEMUOR ou MUOR"
                                        value={pillar.tipo}
                                        onChange={(e) => updateEditPillar(index, 'tipo', e.target.value)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="rpg-button delete-button sm pillar"
                                    onClick={() => removeEditPillar(index)}
                                >
                                    ✖
                                </button>
                                <div className="form-field">
                                    <label>Mana máxima</label>
                                    <input
                                        type="number"
                                        placeholder="Mana máx"
                                        min="0"
                                        value={pillar.maxMana}
                                        onChange={(e) => updateEditPillar(index, 'maxMana', e.target.value)}
                                    />
                                </div>
                                <div className="form-field">
                                    <label>Mana atual</label>
                                    <input
                                        type="number"
                                        placeholder="Mana atual"
                                        min="0"
                                        value={pillar.actualMana}
                                        onChange={(e) => updateEditPillar(index, 'actualMana', e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}

                        {editData.pillars.length < 3 && (
                            <button type="button" className="rpg-button character-button" onClick={addEditPillar}>
                                + Pilar
                            </button>
                        )}

                        <div className="action-section">
                            <button
                                type="button"
                                className="rpg-button cancel-button"
                                onClick={() => setShowEditModal(false)}
                                disabled={editSaving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="rpg-button save-button"
                                disabled={editSaving}
                            >
                                {editSaving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
