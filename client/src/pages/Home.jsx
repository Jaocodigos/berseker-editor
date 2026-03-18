import { Link } from "react-router-dom";

const steps = [
    {
        number: "01",
        title: "Crie seus Personagens",
        description:
            "Acesse a página de Personagens e clique no botão '+' para criar um novo personagem. Defina o nome, HP máximo e adicione até 3 pilares de mana.",
        detail: "Cada pilar representa uma fonte de energia mágica do personagem, com nome, tipo e capacidade de mana.",
        link: "/characters",
        linkLabel: "Ir para Personagens",
        icon: "⚔",
        color: "cyan",
    },
    {
        number: "02",
        title: "Configure as Habilidades",
        description:
            "Em cada card de personagem, clique no ícone de chama para gerenciar as habilidades vinculadas aos pilares.",
        detail: "Cada habilidade possui nome, descrição, dano e custo de mana. O custo é descontado do pilar correspondente ao ser usada.",
        link: "/characters",
        linkLabel: "Gerenciar Habilidades",
        icon: "🔥",
        color: "orange",
    },
    {
        number: "03",
        title: "Inicie a Aventura",
        description:
            "Na página de Aventura, adicione os personagens que participarão da sessão. Cada personagem tem seu próprio card de combate.",
        detail: "Os cards mostram HP atual, mana de cada pilar e os botões de ação disponíveis durante o combate.",
        link: "/adventure",
        linkLabel: "Ir para Aventura",
        icon: "🗺",
        color: "purple",
    },
];

const actions = [
    {
        icon: "🩸",
        title: "Receber Dano",
        description: "Informe o valor do dano recebido. O HP atual será reduzido automaticamente, sem ultrapassar zero.",
    },
    {
        icon: "✨",
        title: "Usar Habilidade",
        description: "Selecione uma habilidade do personagem. A mana do pilar associado será descontada se houver saldo suficiente.",
    },
    {
        icon: "🌙",
        title: "Descanso Curto",
        description: "Recupera metade do HP máximo e metade da mana máxima de cada pilar.",
    },
    {
        icon: "⭐",
        title: "Descanso Longo",
        description: "Recupera completamente o HP e toda a mana de todos os pilares do personagem.",
    },
];

export default function Home() {
    return (
        <div className="home-page">

            {/* Hero */}
            <section className="home-hero">
                <div className="home-hero-glow" />
                <p className="home-hero-eyebrow">Bem-vindo ao</p>
                <h1 className="home-hero-title">Bersekerlandia</h1>
                <p className="home-hero-subtitle">
                    Gerencie personagens, habilidades e sessões de RPG com controle total sobre HP e mana em tempo real.
                </p>
                <div className="home-hero-actions">
                    <Link to="/characters" className="home-cta-primary">Criar Personagem</Link>
                    <Link to="/adventure" className="home-cta-secondary">Iniciar Aventura</Link>
                </div>
            </section>

            {/* Guia passo a passo */}
            <section className="home-section">
                <h2 className="home-section-title">Como Começar</h2>
                <p className="home-section-sub">Siga os três passos abaixo para preparar sua sessão.</p>
                <div className="home-steps">
                    {steps.map((step) => (
                        <div key={step.number} className={`home-step home-step--${step.color}`}>
                            <div className="home-step-number">{step.number}</div>
                            <div className="home-step-icon">{step.icon}</div>
                            <h3 className="home-step-title">{step.title}</h3>
                            <p className="home-step-desc">{step.description}</p>
                            <p className="home-step-detail">{step.detail}</p>
                            <Link to={step.link} className="home-step-link">{step.linkLabel} →</Link>
                        </div>
                    ))}
                </div>
            </section>

            {/* Ações de combate */}
            <section className="home-section">
                <h2 className="home-section-title">Ações de Combate</h2>
                <p className="home-section-sub">Durante a aventura, cada personagem tem acesso às seguintes ações.</p>
                <div className="home-actions-grid">
                    {actions.map((action) => (
                        <div key={action.title} className="home-action-card">
                            <span className="home-action-icon">{action.icon}</span>
                            <h4 className="home-action-title">{action.title}</h4>
                            <p className="home-action-desc">{action.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Dicas */}
            <section className="home-section home-section--tips">
                <h2 className="home-section-title">Dicas Rápidas</h2>
                <ul className="home-tips-list">
                    <li>Personagens podem ser adicionados e removidos da aventura livremente sem perder seus dados.</li>
                    <li>Se um pilar não tiver mana suficiente, a habilidade vinculada a ele não poderá ser usada.</li>
                    <li>O Descanso Longo restaura tudo — use-o com sabedoria entre encontros difíceis.</li>
                    <li>Crie habilidades com custos variados para ter mais estratégia durante o combate.</li>
                </ul>
            </section>

        </div>
    );
}
