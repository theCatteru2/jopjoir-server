const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`Servidor JopJoir corriendo en puerto ${PORT}`);
});

let clients = [];

wss.on('connection', (ws) => {
    // 1. Asignar slot libre (1 a 254)
    let assigned_slot = 1;
    const usedSlots = clients.map(c => c.slot);
    while (usedSlots.includes(assigned_slot) && assigned_slot < 254) {
        assigned_slot++;
    }

    ws.slot = assigned_slot;
    clients.push(ws);
    console.log(`Jugador conectado con Slot ${ws.slot}. Total: ${clients.length}`);

    // Evitar que un error en este cliente tire abajo el servidor
    ws.on('error', (err) => {
        console.log(`Error en cliente Slot ${ws.slot}:`, err.message);
    });

    // 2. Enviar ID de Slot al recién llegado (Paquete ID 0)
    try {
        const welcomeBuffer = Buffer.from([0, ws.slot]);
        ws.send(welcomeBuffer);
    } catch (e) {
        console.log('Error enviando bienvenida:', e.message);
    }

    // 3. Avisar a todos la cantidad en lobby (Paquete ID 10)
    const lobbyMsg = Buffer.from([10, clients.length, 30]);
    broadcast(lobbyMsg);

    // 4. Retransmitir mensajes a los demás clientes
    ws.on('message', (message) => {
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message, { binary: true });
                } catch (e) {}
            }
        });
    });

    // 5. Desconexión limpia
    ws.on('close', () => {
        const deadMsg = Buffer.from([3, ws.slot]);
        broadcast(deadMsg);

        clients = clients.filter(c => c !== ws);
        console.log(`Jugador Slot ${ws.slot} desconectado. Total: ${clients.length}`);

        const updateMsg = Buffer.from([10, clients.length, 30]);
        broadcast(updateMsg);
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
