import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Characters from "./pages/Characters";
import Adventure from "./pages/Adventure";
import Abilities from "./pages/Abilities";

export default function App() {
    return (
        <Router>
            <div className={ "rpg-app"}>
                {/* Navbar */}
                <nav className="rpg-nav">
                    <Link to="/">Home</Link>
                    <Link to="/characters">Characters</Link>
                    <Link to="/adventure">Adventure</Link>
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