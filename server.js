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

app.use(express.json());
app.use(express.static('public'));

const port = process.env.PORT ?? 29999;
const debugLogging = process.env.DEBUG_LOGGING ?? false;
const directoryPath = process.env.TARGET_PATH;
const allowedExt = process.env.ALLOWED_EXT;
const chunkSize = process.env.INIT_LOAD_SIZE; // Size of the chunk to read at a time

function debugLogger(...param){
    debugLogging && console.log(...param);
}

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
        data:  lines
    }
    ws.send(JSON.stringify(data));
}

function addChunk(ws, chunkData) {
    // Split the chunk into lines and process in reverse order
    const lines = chunkData.split('\n');
    const data = {
        type: "add",
        data:  lines
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
                fs.close(fd, () => {}); // Close the file descriptor when done
            });
        });
    }

    function startWatch(){
        return fs.watch(filePath, (e, f) => {
            if(e === 'change'){
                const newPos  = fs.statSync(filePath).size;

                if(currentPosition >= newPos){
                    debugLogger("Same file. Not Doing anything!")
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

        if(request.type === 'file_change'){
            debugLogger(request);

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

        if(filePath){
            if(request.type === 'fetch'){
                const newPos  = fs.statSync(filePath).size;
                if(currentPosition >= newPos){
                    debugLogger("Not Doing anything!")
                }
                else{
                    read(currentPosition, newPos);
                    currentPosition = newPos;
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
        }
    })

    ws.on('close', () => {
        console.log('Client disconnected');
        if(watcher){
            watcher.close();
        }
    });
});

app.post('/download', function(req, res){
    if(!!req.body.file){
        const file = req.body.file;
        res.download(file); // Set disposition and send it.
    }

    console.error("No File Given!")
});

server.listen(port, () => console.log(`Server started on http://localhost:${port}`));
