const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`Servidor JopJoir corriendo en puerto ${PORT}`);
});

let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);
    console.log(`Jugador conectado. Total: ${clients.length}`);

    // Avisar a todos cuántos jugadores hay
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
        clients = clients.filter(c => c !== ws);
        console.log(`Jugador desconectado. Total: ${clients.length}`);
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
