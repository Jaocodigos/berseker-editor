const isDev = process.env.NODE_ENV !== 'production'

const C = {
    reset:  '\x1b[0m',
    dim:    '\x1b[2m',
    cyan:   '\x1b[36m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m',
}

const LEVEL_COLOR = {
    debug: C.cyan,
    info:  C.green,
    warn:  C.yellow,
    error: C.red,
}

function timestamp() {
    return new Date().toTimeString().slice(0, 8)
}

function prettyExtras(data) {
    return Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${C.dim}${k}=${C.reset}${v}`)
        .join('  ')
}

function write(level, message, data = {}) {
    if (isDev) {
        const color = LEVEL_COLOR[level]
        const ts    = `${C.dim}${timestamp()}${C.reset}`
        const tag   = `${color}[${level.toUpperCase().padEnd(5)}]${C.reset}`
        const extras = prettyExtras(data)
        const line  = `${ts}  ${tag}  ${message}${extras ? '  ' + extras : ''}`
        level === 'error' ? console.error(line) : console.log(line)
    } else {
        const entry = JSON.stringify({ level, ts: new Date().toISOString(), message, ...data })
        level === 'error' ? console.error(entry) : console.log(entry)
    }
}

const logger = {
    debug: (msg, data) => write('debug', msg, data),
    info:  (msg, data) => write('info',  msg, data),
    warn:  (msg, data) => write('warn',  msg, data),
    error: (msg, data) => write('error', msg, data),
}

export default logger
