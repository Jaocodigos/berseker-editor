import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Adventure from "./pages/Adventure";
import Abilities from "./pages/Abilities";
import Login from "./pages/Login";

function NavBar() {
    const { credentials, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    if (!credentials) return null

    return (
        <nav className="rpg-nav">
            <NavLink to="/" className="rpg-nav-brand">
                <span className="rpg-nav-brand-icon">⚔</span>
                <span>Bersekerlandia</span>
            </NavLink>
            <div className="rpg-nav-links">
                <NavLink to="/" end className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"}>Home</NavLink>
                <NavLink to="/characters" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"}>Personagens</NavLink>
                <NavLink to="/adventure" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"}>Aventura</NavLink>
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
                            <Route path="/characters/:characterId/abilities" element={<ProtectedRoute><Abilities /></ProtectedRoute>} />
                        </Routes>
                    </main>

                    <footer></footer>
                </div>
            </Router>
        </AuthProvider>
    );
}
