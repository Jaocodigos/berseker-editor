import { useState } from "react";
import { FunnelIcon } from "@heroicons/react/16/solid";

export default function CharacterFilter({ titles, filters, onFiltersChange }) {
    const [open, setOpen] = useState(false);
    const activeCount =
        (filters.name ? 1 : 0) + (filters.titleIds.length > 0 ? 1 : 0);

    const toggleTitle = (value) => {
        const next = filters.titleIds.includes(value)
            ? filters.titleIds.filter((v) => v !== value)
            : [...filters.titleIds, value];
        onFiltersChange({ ...filters, titleIds: next });
    };

    return (
        <div className="character-filter">
            <button
                type="button"
                className={`rpg-button filter-button ${activeCount > 0 ? "active" : ""}`}
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label="Filtrar"
            >
                <FunnelIcon className="size-4 rpg-icon" />
                <span>Filtrar</span>
                {activeCount > 0 && (
                    <span className="filter-badge">{activeCount}</span>
                )}
            </button>

            {open && (
                <div className="filter-panel">
                    <div className="form-field">
                        <label>Nome</label>
                        <input
                            type="text"
                            placeholder="Buscar por nome"
                            value={filters.name}
                            onChange={(e) =>
                                onFiltersChange({
                                    ...filters,
                                    name: e.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="form-field">
                        <label>Títulos</label>
                        <div className="filter-title-list">
                            <label className="filter-title-option">
                                <input
                                    type="checkbox"
                                    checked={filters.titleIds.includes("null")}
                                    onChange={() => toggleTitle("null")}
                                />
                                <span>Sem título</span>
                            </label>
                            {titles.map((t) => (
                                <label
                                    key={t.id}
                                    className="filter-title-option"
                                >
                                    <input
                                        type="checkbox"
                                        checked={filters.titleIds.includes(
                                            t.id,
                                        )}
                                        onChange={() => toggleTitle(t.id)}
                                    />
                                    <span style={{ color: t.color }}>
                                        {t.nome}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rpg-button filter-clear"
                        onClick={() =>
                            onFiltersChange({ name: "", titleIds: [] })
                        }
                    >
                        Limpar
                    </button>
                </div>
            )}
        </div>
    );
}
