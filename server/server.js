const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();
let supportAgent = null;

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'register':
                // Register client type (customer or agent)
                if (data.role === 'agent') {
                    supportAgent = ws;
                    ws.role = 'agent';
                    console.log('Support agent connected');
                } else {
                    const clientId = Math.random().toString(36).substring(7);
                    clients.set(clientId, ws);
                    ws.clientId = clientId;
                    ws.role = 'customer';
                    
                    // Send client ID back to the customer
                    ws.send(JSON.stringify({
                        type: 'registered',
                        clientId: clientId
                    }));
                    
                    // Notify agent about new customer
                    if (supportAgent) {
                        supportAgent.send(JSON.stringify({
                            type: 'newCustomer',
                            clientId: clientId
                        }));
                    }
                }
                break;

            case 'message':
                // Handle chat messages
                if (ws.role === 'customer' && supportAgent) {
                    // Customer message to agent
                    supportAgent.send(JSON.stringify({
                        type: 'message',
                        clientId: ws.clientId,
                        message: data.message
                    }));
                } else if (ws.role === 'agent' && clients.has(data.clientId)) {
                    // Agent message to specific customer
                    const client = clients.get(data.clientId);
                    client.send(JSON.stringify({
                        type: 'message',
                        message: data.message,
                        isAgent: true
                    }));
                }
                break;
        }
    });

    ws.on('close', () => {
        if (ws.role === 'customer') {
            clients.delete(ws.clientId);
            if (supportAgent) {
                supportAgent.send(JSON.stringify({
                    type: 'customerDisconnected',
                    clientId: ws.clientId
                }));
            }
        } else if (ws.role === 'agent') {
            supportAgent = null;
        }
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 