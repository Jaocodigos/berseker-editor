import { useRef, useState } from "react";
import logger, { API_URL } from "../logger";

// Resolve a URL publica de um arquivo enviado (vem como "/uploads/...").
export function avatarSrc(imageUrl) {
    if (!imageUrl) return null;
    return imageUrl.startsWith("http") ? imageUrl : `${API_URL}${imageUrl}`;
}

// Campo de upload de imagem com preview. Faz o POST no `endpoint` assim que o
// arquivo e escolhido e devolve a URL via onChange.
// variant: "avatar" (preview circular) | "map" (preview retangular).
export default function AvatarUpload({
    value,
    onChange,
    endpoint = "/api/upload/avatar",
    variant = "avatar",
}) {
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploading(true);
        try {
            const form = new FormData();
            form.append("image", file);
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: "POST",
                body: form,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Falha no upload");
            }
            const { imageUrl } = await res.json();
            onChange(imageUrl);
        } catch (err) {
            logger.error("erro no upload de imagem", { message: err.message });
            setError(err.message);
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const src = avatarSrc(value);

    return (
        <div className="avatar-upload">
            <div className={`avatar-preview avatar-preview--${variant}`} aria-hidden="true">
                {src ? (
                    <img src={src} alt="" />
                ) : (
                    <span className="avatar-placeholder">?</span>
                )}
            </div>
            <div className="avatar-upload-controls">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFile}
                    disabled={uploading}
                />
                {value && (
                    <button
                        type="button"
                        className="rpg-button cancel-button sm"
                        onClick={() => onChange(null)}
                        disabled={uploading}
                    >
                        Remover
                    </button>
                )}
                {uploading && <span className="avatar-status muted">Enviando…</span>}
                {error && <span className="avatar-status error">{error}</span>}
            </div>
        </div>
    );
}
