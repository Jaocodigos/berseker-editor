import { useState } from "react";

export default function Characters() {
    const [showModal, setShowModal] = useState(false);

    const [pillars, setPillars] = useState([]);

    const [characterName, setCharacterName] = useState("");

    const addPillar = () => {
        setPillars([...pillars, { name: "", type: "", mana: "" }]);
    };

    const removePillar = (index) => {
        const newPillars = [...pillars];
        newPillars.splice(index, 1);
        setPillars(newPillars);
    };

    const handlePillarChange = (index, field, value) => {
        const newPillars = [...pillars];
        newPillars[index][field] = value;
        setPillars(newPillars);
    };



    // FORMULÁRIO
    const handleSubmit = async (e) => {
        e.preventDefault(); // evita reload da página

        // Montar objeto com os dados
        const personagem = {
            name: characterName,       // Nome do personagem
            pillars: pillars.map(p => ({     // Pilares
                name: p.name,
                type: p.type,
                mana: Number(p.mana)
            }))
        };

        console.log(`Criando personagem: ${JSON.stringify(personagem)}`);


        try {
            const response = await fetch("http://localhost:3001/api/characters", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(personagem)
            });

            if (!response.ok) {
                throw new Error("Erro ao criar o personagem.");
            }

            const data = await response.json();
            console.log("Personagem criado com sucesso:", data);

            // Limpar formulário e fechar modal
            e.target.reset();
            setPillars([]);
            setShowModal(false);

        } catch (error) {
            console.error(error);
            alert("Não foi possível criar o personagem.");
        }
    };

    return (
        <div style={{ textAlign: "center" }}>
            <h1>🧙‍♂️ Personagens</h1>
            <p>Veja a lista de heróis e vilões!</p>

            {/* Botão para abrir o modal */}
            <button onClick={() => setShowModal(true)} className={"rpg-button add-button"}>
                Adicionar Personagem
            </button>

            {/* Modal */}
            {showModal && (
                <div className={"rpg-modal"}>
                    <div className={"modal-body"}>

                        {/* Botão de fechar */}
                        <button className={'close'} onClick={() => setShowModal(false)}>
                            ✖
                        </button>

                        <h2>Adicionar Personagem</h2>

                        {/* Formulário */}
                        <form onSubmit={handleSubmit}>

                            <input type="text" placeholder="Nome do personagem"  value={characterName}
                                onChange={(e) => setCharacterName(e.target.value)}/>


                            {/* Lista de pilares */}
                            {pillars.map((pillar, index) => (
                                <div key={index} className={"pillar-form"}>
                                    <input
                                        type="text"
                                        placeholder="Nome do pilar"
                                        value={pillar.name}
                                        onChange={(e) => handlePillarChange(index, "name", e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tipo"
                                        value={pillar.type}
                                        onChange={(e) => handlePillarChange(index, "type", e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Mana"
                                        value={pillar.mana}
                                        onChange={(e) => handlePillarChange(index, "mana", e.target.value)}
                                    />
                                    <button type="button" onClick={() => removePillar(index)} className={"delete-button"}>
                                        X
                                    </button>
                                </div>
                            ))}


                            {/* Botão para adicionar pilar */}
                            <button type="button" onClick={addPillar} className={"rpg-button add-button"}>
                                Adicionar Pilar
                            </button>

                            <button type="submit" className={"rpg-button save-button"}>
                                Salvar
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}