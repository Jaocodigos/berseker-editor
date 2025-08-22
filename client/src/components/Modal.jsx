export default function Modal({ title, open, onClose, children }) {
    if (!open) return null;
    return (
        <div className="rpg-modal">
            <div className="modal-body">
                <button className="close" onClick={onClose}>✖</button>
                {title && <h2>{title}</h2>}
                {children}
            </div>
        </div>
    );
}