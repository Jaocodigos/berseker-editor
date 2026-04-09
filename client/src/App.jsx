import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Adventure from "./pages/Adventure";
import Abilities from "./pages/Abilities";
import Login from "./pages/Login";
import Enemies from "./pages/Enemies";

function NavBar() {
    const { credentials, logout, isMaster } = useAuth()
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)

    const handleLogout = async () => {
        setMenuOpen(false)
        await logout()
        navigate('/login', { replace: true })
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
                <button className="rpg-nav-logout" onClick={handleLogout}>Sair</button>
            </div>
        </nav>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="rpg-app">
                    <NavBar />

                    <main>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                            <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
                            <Route path="/adventure" element={<ProtectedRoute><Adventure /></ProtectedRoute>} />
                            <Route path="/enemies" element={<ProtectedRoute masterOnly><Enemies /></ProtectedRoute>} />
                            <Route path="/characters/:characterId/abilities" element={<ProtectedRoute><Abilities /></ProtectedRoute>} />
                        </Routes>
                    </main>

                    <footer></footer>
                </div>
            </Router>
        </AuthProvider>
    );
}
