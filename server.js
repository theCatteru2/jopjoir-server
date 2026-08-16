const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`Servidor JopJoir corriendo en puerto ${PORT}`);
});

let clients = [];
let lobbyTimer = 0;
let lobbyInterval = null;

function broadcast(data) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(data, { binary: true });
            } catch (e) {}
        }
    });
}

function sendLobbyState() {
    // Paquete 10: [ID (10), Jugadores Conectados (u8), Tiempo Restante (u8)]
    const t = Math.max(0, Math.ceil(lobbyTimer));
    const buffer = Buffer.from([10, clients.length, t]);
    broadcast(buffer);
}

function updateLobbyLogic(playerJoined = false) {
    if (clients.length >= 2) {
        if (lobbyInterval === null) {
            // Arranca la cuenta en 15 segundos al llegar al 2do jugador
            lobbyTimer = 15;
            console.log(`Partida con ${clients.length} jugadores. Cuenta regresiva iniciada en 15s.`);
            
            lobbyInterval = setInterval(() => {
                lobbyTimer -= 1;
                sendLobbyState();

                if (lobbyTimer <= 0) {
                    clearInterval(lobbyInterval);
                    lobbyInterval = null;
                    console.log("¡Tiempo cumplido! Iniciando partida simultánea.");
                    
                    // Paquete 20: Iniciar partida a todos a la vez
                    const startBuffer = Buffer.from([20]);
                    broadcast(startBuffer);
                }
            }, 1000);
        } else if (playerJoined) {
            // Si ya estaba contando y entra uno nuevo, sumamos 5 segundos (tope 30s)
            lobbyTimer = Math.min(30, lobbyTimer + 5);
            console.log(`Nuevo jugador sumado. Tiempo extendido a: ${lobbyTimer}s`);
        }
    } else {
        // Si alguien se va y queda menos de 2, cancelamos la cuenta
        if (lobbyInterval !== null) {
            clearInterval(lobbyInterval);
            lobbyInterval = null;
            lobbyTimer = 0;
            console.log("Menos de 2 jugadores. Cuenta cancelada.");
        }
    }
    sendLobbyState();
}

wss.on('connection', (ws) => {
    let assigned_slot = 1;
    const usedSlots = clients.map(c => c.slot);
    while (usedSlots.includes(assigned_slot) && assigned_slot <= 30) {
        assigned_slot++;
    }

    ws.slot = assigned_slot;
    clients.push(ws);
    console.log(`Jugador conectado -> Slot ${ws.slot}. Total: ${clients.length}`);

    // Paquete 0: Asignación de Slot
    try {
        const welcome = Buffer.from([0, ws.slot]);
        ws.send(welcome, { binary: true });
    } catch (e) {}

    // Actualizar lobby y sumar tiempo
    updateLobbyLogic(true);

    ws.on('message', (message) => {
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message, { binary: true });
                } catch (e) {}
            }
        });
    });

    ws.on('close', () => {
        // Paquete 3: Muerte/desconexión
        const dead = Buffer.from([3, ws.slot]);
        broadcast(dead);

        clients = clients.filter(c => c !== ws);
        console.log(`Jugador desconectado -> Slot ${ws.slot}. Quedan: ${clients.length}`);

        updateLobbyLogic(false);
    });
});
