function readNewData(lastPosition, callback) {
    fs.stat(filePath, (err, stats) => {
        if (err) {
            return callback(err);
        }

        const newSize = stats.size;
        const sizeDifference = newSize - lastPosition;

        if (sizeDifference > 0) {
            const buffer = Buffer.alloc(sizeDifference);
            fs.open(filePath, 'r', (err, fd) => {
                if (err) {
                    return callback(err);
                }

                fs.read(fd, buffer, 0, sizeDifference, lastPosition, (err, bytesRead, buffer) => {
                    fs.close(fd, (err) => {
                        if (err) {
                            console.log('Error closing file', err);
                        }
                    });

                    if (err) {
                        return callback(err);
                    }

                    callback(null, buffer.toString(), newSize);
                });
            });
        } else {
            // No new data
            callback(null, '', lastPosition);
        }
    });
}

function tailFile(lastPosition, callBack) {
    readNewData(lastPosition, (err, newData, newPosition) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }

        if (newData) {
            console.log('New data:', newData);
        }

        lastPosition = newPosition; // Update the last read position

        // Continue tailing the file after a short delay
        setTimeout(tailFile, 1000); // Check for new data every second
    });
}