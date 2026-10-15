@echo off
cd /d "%~dp0"
rem VS Code и некоторые оболочки выставляют эту переменную — с ней Electron стартует как голый Node.
set ELECTRON_RUN_AS_NODE=
if not exist node_modules call npm install
start "" npx electron .
