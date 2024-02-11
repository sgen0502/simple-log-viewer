const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const gracefulFs = require('graceful-fs')
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
gracefulFs.gracefulify(fs);

app.use(express.static('public'));

const filePath = 'H:\\Project\\Javascript\\vite\\tail-viewer-server\\example.txt'; // Update this to your file's path
const chunkSize = 1024; // Size of the chunk to read at a time

function processChunk(ws, chunkData) {
    // Split the chunk into lines and process in reverse order
    const lines = chunkData.split('\n').reverse();
    // lines.forEach(line => {
    //     if (line) {
    //         console.log(line);
    //     }
    // });
    ws.send(lines.join('\n'));
}

wss.on('connection', ws => {
    console.log('Client connected');

    const fileSize = fs.statSync(filePath).size;
    let currentPosition = fileSize;
    let currentPointer;

    function readPreviousChunk() {
        // Adjust the start position and size for the last chunk of the file
        const start = Math.max(0, currentPosition - chunkSize);
        const size = Math.min(chunkSize, currentPosition);

        // Create a buffer to hold the chunk
        const buffer = Buffer.alloc(size);

        fs.open(filePath, 'r', (err, fd) => {
            if (err) {
                console.error('Error opening file:', err);
                return;
            }
            currentPointer = fd;
            fs.read(fd, buffer, 0, size, start, (err, bytesRead, buffer) => {
                if (err) {
                    console.error('Error reading file:', err);
                    fs.close(fd, () => {}); // Close the file descriptor on error
                    return;
                }

                // Convert buffer to string and process the chunk
                const data = buffer.toString('utf-8');
                processChunk(ws, data);

                currentPosition -= bytesRead; // Update the current position

                if (currentPosition > 0) {
                    readPreviousChunk(); // Read the previous chunk if not at the start
                } else {
                    fs.close(fd, () => {}); // Close the file descriptor when done
                    console.log('Reached the start of the file');
                }
            });
        });
    }

    readPreviousChunk();

    ws.on('close', () => {
        console.log('Client disconnected');
        // if(currentPointer){
        //     fs.closeSync(currentPointer);
        // }

    });
});

server.listen(3000, () => console.log('Server started on http://localhost:3000'));
