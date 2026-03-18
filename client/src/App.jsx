import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Adventure from "./pages/Adventure";
import Abilities from "./pages/Abilities";

export default function App() {
    return (
        <Router>
            <div className="rpg-app">
                {/* Navbar */}
                <nav className="rpg-nav">
                    <NavLink to="/" className="rpg-nav-brand">
                        <span className="rpg-nav-brand-icon">⚔</span>
                        <span>Bersekerlandia</span>
                    </NavLink>
                    <div className="rpg-nav-links">
                        <NavLink to="/" end className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"}>Home</NavLink>
                        <NavLink to="/characters" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"}>Personagens</NavLink>
                        <NavLink to="/adventure" className={({ isActive }) => isActive ? "rpg-nav-link active" : "rpg-nav-link"}>Aventura</NavLink>
                    </div>
                </nav>

                {/* Conteúdo */}
                <main>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/characters" element={<Characters />} />
                        <Route path="/adventure" element={<Adventure />} />
                        <Route path="/characters/:characterId/abilities" element={<Abilities />} />
                    </Routes>
                </main>

                {/* Footer */}
                <footer></footer>
            </div>
        </Router>
    );
}