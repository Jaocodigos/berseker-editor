const API_URL = import.meta.env.API_URL || 'http://localhost:3001'

export { API_URL }

function send(level, message, data = {}) {
    fetch(`${API_URL}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, data: { ...data, route: window.location.pathname } }),
    }).catch(() => {})
}

const logger = {
    debug: (msg, data) => send('debug', msg, data),
    info:  (msg, data) => send('info',  msg, data),
    warn:  (msg, data) => send('warn',  msg, data),
    error: (msg, data) => send('error', msg, data),
}

export default logger
