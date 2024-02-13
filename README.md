# Simple Log Viewer

[![Node.js Version](https://img.shields.io/node/v/package-name.svg)](https://nodejs.org/en/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub Issues](https://img.shields.io/github/issues/username/repository.svg)](https://github.com/username/repository/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/username/repository.svg)](https://github.com/username/repository/pulls)

This is a super lightweight application which let you read log files in the server.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)

## Installation
First, please create a .env  file with content like this 
```bash
TARGET_PATH=C:\log\,D:\log\ or /log/,app/application/log/
ALLOWED_EXT=txt
INIT_LOAD_SIZE=12000
DEBUG_LOGGING=false
```

## Usage
```bash
// clone this repo
npm install
node server.js
or if you wanna ran background
nohup node server.js & 
```
