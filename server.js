const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const gracefulFs = require('graceful-fs')
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
gracefulFs.gracefulify(fs);

app.use(express.static('public'));

const directoryPath = process.env.TARGET_PATH;
const allowedExt = process.env.ALLOWED_EXT;
const chunkSize = process.env.INIT_LOAD_SIZE; // Size of the chunk to read at a time

function sendFiles(ws, paths){
    const allFiles = [];
    paths.split(",").forEach(path => {
        // Log the list of files
        let filesInDir = [];
        const files = fs.readdirSync(path);
        files.forEach(file => {
            if(file.endsWith(allowedExt)){
                filesInDir.push(file);
            }
        })
        allFiles.push({
            dir: path,
            files: filesInDir
        })
    })

    const data = {
        type: "getFiles",
        data: allFiles
    }
    ws.send(JSON.stringify(data));
}

function processInitChunk(ws, chunkData) {
    // Drop first line as usually collapsed at Chunk Loading
    let lines = chunkData.split('\n');
    lines = lines.slice(1, lines.length);
    const data = {
        type: "add",
        data:  lines.reverse().join('\n')
    }
    ws.send(JSON.stringify(data));
}

function addChunk(ws, chunkData) {
    // Split the chunk into lines and process in reverse order
    const lines = chunkData.split('\n').reverse();
    const data = {
        type: "add",
        data:  lines.join('\n')
    }
    ws.send(JSON.stringify(data));
}

wss.on('connection', ws => {
    console.log('Client connected');
    let filePath;
    let currentPosition;

    function init() {
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

            fs.read(fd, buffer, 0, size, start, (err, bytesRead, buffer) => {
                if (err) {
                    console.error('Error reading file:', err);
                    fs.close(fd, () => {}); // Close the file descriptor on error
                    return;
                }

                // Convert buffer to string and process the chunk
                const data = buffer.toString('utf-8');
                processInitChunk(ws, data);
                fs.close(fd, () => {}); // Close the file descriptor when done
            });
        });
    }

    function read(start, to) {
        const size = to - start;
        // Create a buffer to hold the chunk
        const buffer = Buffer.alloc(size);

        fs.open(filePath, 'r', (err, fd) => {
            if (err) {
                console.error('Error opening file:', err);
                return;
            }

            fs.read(fd, buffer, 0, size, start, (err, bytesRead, buffer) => {
                if (err) {
                    console.error('Error reading file:', err);
                    fs.close(fd, () => {}); // Close the file descriptor on error
                    return;
                }

                // Convert buffer to string and process the chunk
                const data = buffer.toString('utf-8');
                addChunk(ws, data);
                fs.watch(filePath, event => {

                })
                fs.close(fd, () => {}); // Close the file descriptor when done
            });
        });
    }

    function startWatch(){
        return fs.watch(filePath, (e, f) => {
            if(e === 'change'){
                const newPos  = fs.statSync(filePath).size;
                console.log(currentPosition, newPos);
                if(currentPosition >= newPos){
                    console.log("Not Doing anything!")
                }
                else{
                    read(currentPosition, newPos);
                    currentPosition = newPos;
                }
            }
        })
    }

    sendFiles(ws, directoryPath);

    let watcher;

    ws.on('message', message => {
        const request = JSON.parse(message);

        if(request.type === 'fetch'){
            const newPos  = fs.statSync(filePath).size;
            if(currentPosition >= newPos){
                console.log("Not Doing anything!")
            }
            else{
                read(currentPosition, newPos);
                currentPosition = newPos;
            }
        }
        else if(request.type === 'file_change'){
            console.log(request);
            filePath = request.data.file;
            currentPosition = fs.statSync(filePath).size;
            init();

            if(request.data.watch){
                if(watcher){
                    watcher.close();
                }
                watcher = startWatch();
            }
        }
        else if(request.type === 'watch'){
            if(request.data.watch){
                watcher = startWatch();
            }
            else{
                if(watcher){
                    watcher.close();
                }
            }
        }
    })

    ws.on('close', () => {
        console.log('Client disconnected');
        if(watcher){
            watcher.close();
        }
    });
});

server.listen(12345, () => console.log('Server started on http://localhost:12345'));
