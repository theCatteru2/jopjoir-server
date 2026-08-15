const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`Servidor JopJoir corriendo en puerto ${PORT}`);
});

let clients = [];

wss.on('connection', (ws) => {
    // 1. Buscar el primer ID de slot libre del 1 al 254 (sin repetir)
    let assigned_slot = 1;
    const usedSlots = clients.map(c => c.slot);
    while (usedSlots.includes(assigned_slot) && assigned_slot < 254) {
        assigned_slot++;
    }

    ws.slot = assigned_slot;
    clients.push(ws);
    console.log(`Jugador conectado con Slot ${ws.slot}. Total: ${clients.length}`);

    // 2. ENVIAR ID ÚNICO AL RECIÉN LLEGADO (Paquete ID 0: [0, slot])
    const welcomeBuffer = Buffer.from([0, ws.slot]);
    ws.send(welcomeBuffer);

    // 3. Avisar a todos cuántos jugadores hay en el lobby (Paquete ID 10)
    const lobbyMsg = Buffer.from([10, clients.length, 30]);
    broadcast(lobbyMsg);

    ws.on('message', (message) => {
        // Reenviar datos a todos los demás jugadores
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        // 4. Si el jugador se desconecta, avisar su muerte/salida para que desaparezca
        const deadMsg = Buffer.from([3, ws.slot]);
        broadcast(deadMsg);

        clients = clients.filter(c => c !== ws);
        console.log(`Jugador con Slot ${ws.slot} desconectado. Total: ${clients.length}`);
        
        const updateMsg = Buffer.from([10, clients.length, 30]);
        broadcast(updateMsg);
    });
});

function broadcast(data) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}
