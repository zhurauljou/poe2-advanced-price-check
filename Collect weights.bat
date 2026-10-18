@echo off
cd /d "%~dp0"
rem Сбор оценки весов модов по трейду, пока вы не за компьютером (scripts/collect-weights.js). Остановить — Ctrl+C или закрыть окно.
if not exist node_modules call npm install
title PoE 2 weights collector
node scripts/collect-weights.js %*
pause
