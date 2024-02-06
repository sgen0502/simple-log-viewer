const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const filePath = 'H:\\Project\\Javascript\\vite\\tail-viewer-server\\example.txt'; // Update this to your file's path


wss.on('connection', ws => {
    console.log('Client connected');
    let lastPosition = 0;
    const tailFile = () => {
        fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
            if (err) {
                console.log(err);
                return;
            }
            ws.send(data);
        });
    };

    tailFile();
    const fileWatcher = fs.watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
            tailFile();
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        fileWatcher.close();
    });
});

server.listen(3000, () => console.log('Server started on http://localhost:3000'));
