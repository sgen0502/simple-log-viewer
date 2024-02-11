const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const readline = require('readline');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const filePath = 'H:\\Project\\Javascript\\vite\\tail-viewer-server\\example.txt'; // Update this to your file's path


wss.on('connection', ws => {
    console.log('Client connected');

    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity // Recognize all instances of CR LF ('\r\n') as a single line break.
    });

    rl.on('line', (line) => {
        ws.send(line);
    });

    // Event listener for the 'close' event, triggered when the file is fully read
    rl.on('close', () => {
        console.log('Finished reading the file');
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        fileWatcher.close();
    });
});

server.listen(3000, () => console.log('Server started on http://localhost:3000'));
