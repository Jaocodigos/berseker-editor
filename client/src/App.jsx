import { useState, useRef, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdventureProvider, useAdventure } from "./context/AdventureContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Adventure from "./pages/Adventure";
import Abilities from "./pages/Abilities";
import Login from "./pages/Login";
import Enemies from "./pages/Enemies";
import Titles from "./pages/Titles";
import AdventureSelect from "./pages/AdventureSelect";

function NavBar() {
    const { credentials, logout } = useAuth()
    const { currentAdventure, adventures, isMaster, deselectAdventure } = useAdventure()
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)
    const [advOpen, setAdvOpen] = useState(false)
    const advRef = useRef(null)

    useEffect(() => {
        if (!advOpen) return
        const onClickOutside = (e) => {
            if (advRef.current && !advRef.current.contains(e.target)) {
                setAdvOpen(false)
            }
        }
        const onKey = (e) => { if (e.key === 'Escape') setAdvOpen(false) }
        document.addEventListener('mousedown', onClickOutside)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClickOutside)
            document.removeEventListener('keydown', onKey)
        }
    }, [advOpen])

    const handleLogout = async () => {
        setMenuOpen(false)
        setAdvOpen(false)
        await logout()
        navigate('/login', { replace: true })
    }

    const handleSwitchAdventure = async () => {
        setMenuOpen(false)
        setAdvOpen(false)
        await deselectAdventure()
        navigate('/select-adventure', { replace: true })
    }

    const closeMenu = () => setMenuOpen(false)

    if (!credentials) return null

    return (
        <nav className="rpg-nav">
            <NavLink to="/" className="rpg-nav-brand" onClick={closeMenu}>
                <span className="rpg-nav-brand-icon">⚔</span>
                <span>Bersekerlandia</span>
            </NavLink>
            <button
                className={`rpg-nav-hamburger${menuOpen ? " open" : ""}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
            >
                <span />
                <span />
                <span />
            </button>
            <div className={`rpg-nav-links${menuOpen ? " open" : ""}`}>
                <NavLink to="/" end className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"} onClick={closeMenu}>Home</NavLink>
                <NavLink to="/characters" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"} onClick={closeMenu}>Personagens</NavLink>
                <NavLink to="/adventure" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"} onClick={closeMenu}>Aventura</NavLink>
                {isMaster && <NavLink to="/enemies" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"} onClick={closeMenu}>Inimigos</NavLink>}
                {isMaster && <NavLink to="/titles" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"} onClick={closeMenu}>Títulos</NavLink>}
                {currentAdventure && (
                    adventures.length > 1 ? (
                        <div className="rpg-nav-adv" ref={advRef}>
                            <button
                                type="button"
                                className={`rpg-nav-adv-trigger${advOpen ? " open" : ""}`}
                                onClick={() => setAdvOpen(o => !o)}
                                aria-haspopup="menu"
                                aria-expanded={advOpen}
                            >
                                <span className="rpg-nav-adv-name">{currentAdventure.nome}</span>
                                <span className="rpg-nav-adv-chevron" aria-hidden="true">▾</span>
                            </button>
                            {advOpen && (
                                <div className="rpg-nav-adv-menu" role="menu">
                                    <button type="button" className="rpg-nav-adv-item" role="menuitem" onClick={handleSwitchAdventure}>
                                        Trocar Aventura
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="rpg-nav-adv-static">{currentAdventure.nome}</span>
                    )
                )}
                <button className="rpg-nav-logout" onClick={handleLogout}>Sair</button>
            </div>
        </nav>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <AdventureProvider>
                <Router>
                    <div className="rpg-app">
                        <NavBar />

                        <main>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/select-adventure" element={
                                    <ProtectedRoute requireAdventure={false}><AdventureSelect /></ProtectedRoute>
                                } />
                                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                                <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
                                <Route path="/adventure" element={<ProtectedRoute><Adventure /></ProtectedRoute>} />
                                <Route path="/enemies" element={<ProtectedRoute masterOnly><Enemies /></ProtectedRoute>} />
                                <Route path="/titles" element={<ProtectedRoute masterOnly><Titles /></ProtectedRoute>} />
                                <Route path="/characters/:characterId/abilities" element={<ProtectedRoute><Abilities /></ProtectedRoute>} />
                            </Routes>
                        </main>

                        <footer></footer>
                    </div>
                </Router>
            </AdventureProvider>
        </AuthProvider>
    );
}
