import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';

dotenv.config();

// Se este arquivo for chamado por engano, ele delega a execução para o backend real
console.log('⚠️  Iniciando backend real a partir de ./backend/src/server.ts...');
const backendProcess = spawn('npx', ['tsx', 'src/server.ts'], {
  cwd: path.resolve(__dirname, '../backend'),
  stdio: 'inherit',
  shell: true
});

backendProcess.on('error', (err) => {
  console.error('Falha ao iniciar backend:', err);
});


