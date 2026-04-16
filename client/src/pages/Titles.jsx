import { useState, useEffect } from 'react'
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/16/solid'
import logger, { API_URL } from '../logger'

export default function Titles() {
    const [titles, setTitles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('#f1f5f9')

    const [editingId, setEditingId] = useState(null)
    const [editName, setEditName] = useState('')
    const [editColor, setEditColor] = useState('#f1f5f9')

    useEffect(() => { fetchTitles() }, [])

    const fetchTitles = async () => {
        try {
            const res = await fetch(`${API_URL}/api/titles`)
            if (!res.ok) throw new Error('falha ao carregar')
            setTitles(await res.json())
        } catch (err) {
            logger.error('erro ao carregar titulos', { message: err.message })
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        setError('')
        if (!newName.trim()) { setError('Nome obrigatório'); return }

        const res = await fetch(`${API_URL}/api/titles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: newName.trim(), color: newColor }),
        })
        if (!res.ok) { setError('Falha ao criar título'); return }

        const created = await res.json()
        setTitles((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)))
        setNewName('')
        setNewColor('#f1f5f9')
    }

    const startEdit = (title) => {
        setEditingId(title.id)
        setEditName(title.nome)
        setEditColor(title.color)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
        setEditColor('#f1f5f9')
    }

    const handleUpdate = async (id) => {
        if (!editName.trim()) return
        const res = await fetch(`${API_URL}/api/titles/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: editName.trim(), color: editColor }),
        })
        if (!res.ok) return

        const updated = await res.json()
        setTitles((prev) => prev.map(t => t.id === id ? updated : t).sort((a, b) => a.nome.localeCompare(b.nome)))
        cancelEdit()
    }

    const handleDelete = async (id) => {
        if (!confirm('Deletar este título? Os personagens que o usavam ficarão sem título.')) return
        const res = await fetch(`${API_URL}/api/titles/${id}`, { method: 'DELETE' })
        if (!res.ok) return
        setTitles((prev) => prev.filter(t => t.id !== id))
    }

    if (loading) return <div className="titles-page"><p>Carregando...</p></div>

    return (
        <div className="titles-page">
            <header className="titles-header">
                <h1>Títulos</h1>
                <p>Crie títulos para identificar seus personagens. A cor é aplicada ao texto nos cards.</p>
            </header>

            <form className="titles-create" onSubmit={handleCreate}>
                <input
                    type="text"
                    placeholder="Nome do título"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={60}
                />
                <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    title="Cor do título"
                />
                <button type="submit" className="titles-create-btn">
                    <PlusIcon width={16} height={16} /> Criar
                </button>
            </form>
            {error && <div className="titles-error">{error}</div>}

            {titles.length === 0 ? (
                <p className="titles-empty">Nenhum título cadastrado ainda.</p>
            ) : (
                <ul className="titles-list">
                    {titles.map((t) => (
                        <li key={t.id} className="titles-item">
                            {editingId === t.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        maxLength={60}
                                    />
                                    <input
                                        type="color"
                                        value={editColor}
                                        onChange={(e) => setEditColor(e.target.value)}
                                    />
                                    <div className="titles-item-actions">
                                        <button type="button" onClick={() => handleUpdate(t.id)} title="Salvar">
                                            <CheckIcon width={16} height={16} />
                                        </button>
                                        <button type="button" onClick={cancelEdit} title="Cancelar">
                                            <XMarkIcon width={16} height={16} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="titles-swatch" style={{ background: t.color }} aria-hidden="true" />
                                    <span className="titles-name" style={{ color: t.color }}>{t.nome}</span>
                                    <div className="titles-item-actions">
                                        <button type="button" onClick={() => startEdit(t)} title="Editar">
                                            <PencilIcon width={16} height={16} />
                                        </button>
                                        <button type="button" onClick={() => handleDelete(t.id)} title="Deletar" className="titles-delete">
                                            <TrashIcon width={16} height={16} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
