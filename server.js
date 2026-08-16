const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`Servidor JopJoir corriendo en puerto ${PORT}`);
});

let clients = [];

wss.on('connection', (ws) => {
    // 1. Asignar un slot único libre (del 1 al 8)
    let assigned_slot = 1;
    const usedSlots = clients.map(c => c.slot);
    while (usedSlots.includes(assigned_slot) && assigned_slot <= 8) {
        assigned_slot++;
    }

    ws.slot = assigned_slot;
    clients.push(ws);
    console.log(`Jugador conectado -> Slot ${ws.slot}. Total en sala: ${clients.length}`);

    ws.on('error', (err) => {
        console.log(`Error en cliente Slot ${ws.slot}:`, err.message);
    });

    // 2. ENVIAR INMEDIATAMENTE PAQUETE 0 (ASIGNACIÓN DE SLOT) AL JUGADOR
    try {
        const welcomeBuffer = Buffer.from([0, ws.slot]);
        ws.send(welcomeBuffer, { binary: true });
    } catch (e) {
        console.log("Error enviando paquete 0:", e.message);
    }

    // 3. ENVIAR A TODOS EL PAQUETE 10 (CANTIDAD DE JUGADORES CONECTADOS)
    const lobbyBuffer = Buffer.from([10, clients.length]);
    broadcast(lobbyBuffer);

    // 4. RETRANSMISIÓN DE PAQUETES DE JUEGO (Movimiento, Sonidos, etc.)
    ws.on('message', (message) => {
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message, { binary: true });
                } catch (e) {}
            }
        });
    });

    // 5. GESTIÓN DE DESCONEXIONES
    ws.on('close', () => {
        // Paquete 3: Notificar muerte/desconexión del slot
        const deadBuffer = Buffer.from([3, ws.slot]);
        broadcast(deadBuffer);

        clients = clients.filter(c => c !== ws);
        console.log(`Jugador desconectado -> Slot ${ws.slot}. Quedan: ${clients.length}`);

        // Actualizar contador del lobby
        const updateLobby = Buffer.from([10, clients.length]);
        broadcast(updateLobby);
    });
});

function broadcast(data) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(data, { binary: true });
            } catch (e) {}
        }
    });
}
