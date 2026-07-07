import { io } from "socket.io-client";
import { API_URL } from "./logger";

// Conexao unica e preguicosa: so e criada quando alguem chama getSocket()
// (ou seja, quando o usuario abre o mapa). Cookies vao junto via withCredentials.
let socket = null;

export function getSocket() {
    if (!socket) {
        // API_URL vazio => mesma origem (proxy /socket.io no dev, mesmo host em prod).
        socket = io(API_URL || undefined, { withCredentials: true });
    }
    return socket;
}
