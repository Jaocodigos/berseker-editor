import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login(username, password)
            navigate('/', { replace: true })
        } catch {
            setError('Usuário ou senha inválidos.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            {/* Background orbs animados */}
            <div className="login-bg" aria-hidden="true">
                <div className="login-orb login-orb-1" />
                <div className="login-orb login-orb-2" />
                <div className="login-orb login-orb-3" />
            </div>

            {/* Painel esquerdo decorativo (desktop) */}
            <div className="login-panel-left" aria-hidden="true">
                <div className="login-lore">
                    <span className="login-panel-sword">⚔</span>
                    <h2>Bersekerlandia</h2>
                    <p className="login-panel-tagline">O mundo aguarda seu retorno, mestre.</p>
                    <div className="login-panel-divider" />
                    <p className="login-panel-quote">
                        "Cada runa carregada de mana, cada pilar forjado em batalha.
                        A lenda começa aqui."
                    </p>
                    <div className="login-panel-runes">
                        <span>ᚠ</span>
                        <span>ᚢ</span>
                        <span>ᚦ</span>
                        <span>ᚨ</span>
                        <span>ᚱ</span>
                    </div>
                </div>
            </div>

            {/* Painel direito — formulário */}
            <div className="login-panel-right">
                <div className="login-form-wrapper">
                    <div className="login-form-header">
                        <div className="login-form-logo">⚔</div>
                        <h1>Bem-vindo de volta</h1>
                        <p>Entre com suas credenciais para acessar o editor</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="login-field">
                            <label htmlFor="username">Usuário</label>
                            <div className="login-input-wrapper">
                                <span className="login-input-icon">◈</span>
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="Seu usuário"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    autoFocus
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <label htmlFor="password">Senha</label>
                            <div className="login-input-wrapper">
                                <span className="login-input-icon">◉</span>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="Sua senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="login-error" key={error}>
                                <span className="login-error-icon">✕</span>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading && <span className="login-btn-spinner" />}
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
