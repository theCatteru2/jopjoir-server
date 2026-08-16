const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`Servidor JopJoir corriendo en puerto ${PORT}`);
});

let clients = [];
let lobbyCountdown = null;
let timeLeft = 5;

wss.on('connection', (ws) => {
    // 1. Asignar slot libre (1 a 8)
    let assigned_slot = 1;
    const usedSlots = clients.map(c => c.slot);
    while (usedSlots.includes(assigned_slot) && assigned_slot <= 8) {
        assigned_slot++;
    }

    ws.slot = assigned_slot;
    clients.push(ws);
    console.log(`Jugador conectado -> Slot ${ws.slot}. Total: ${clients.length}`);

    ws.on('error', (err) => {
        console.log(`Error Slot ${ws.slot}:`, err.message);
    });

    // 2. Enviar inmediatamente el Paquete 0 con su Slot asignado
    try {
        const welcomeBuffer = Buffer.from([0, ws.slot]);
        ws.send(welcomeBuffer, { binary: true });
    } catch (e) {}

    // 3. Avisar a todos la cantidad actual
    broadcastLobby();

    // 4. Si hay 2 o más, arrancar la cuenta regresiva centralizada
    if (clients.length >= 2 && !lobbyCountdown) {
        timeLeft = 5;
        lobbyCountdown = setInterval(() => {
            timeLeft--;
            
            // Paquete 10: Actualizar tiempo a todos
            const syncTimeMsg = Buffer.from([10, clients.length, timeLeft]);
            broadcast(syncTimeMsg);

            if (timeLeft <= 0) {
                clearInterval(lobbyCountdown);
                lobbyCountdown = null;
                
                // Paquete 20: ¡INICIAR PARTIDA SIMULTÁNEA!
                const startMsg = Buffer.from([20]);
                broadcast(startMsg);
            }
        }, 1000);
    }

    // 5. Retransmisión de paquetes
    ws.on('message', (message) => {
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message, { binary: true });
                } catch (e) {}
            }
        });
    });

    // 6. Desconexión
    ws.on('close', () => {
        const deadMsg = Buffer.from([3, ws.slot]);
        broadcast(deadMsg);

        clients = clients.filter(c => c !== ws);
        console.log(`Jugador Slot ${ws.slot} desconectado. Quedan: ${clients.length}`);

        if (clients.length < 2 && lobbyCountdown) {
            clearInterval(lobbyCountdown);
            lobbyCountdown = null;
            timeLeft = 5;
        }

        broadcastLobby();
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

function broadcastLobby() {
    const lobbyMsg = Buffer.from([10, clients.length, timeLeft]);
    broadcast(lobbyMsg);
}
