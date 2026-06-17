const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;
let backendPort = null;

function getBackendPort() {
  return backendPort;
}

function createBackendProcess() {
  return new Promise((resolve, reject) => {
    const backendEntry = path.join(__dirname, '..', 'backend', 'src', 'index.js');
    const dbDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'igreja.db');
    const systemNode = process.platform === 'win32'
      ? 'C:\\Program Files\\nodejs\\node.exe'
      : process.execPath;
    const env = {
      ...process.env,
      DB_PATH: dbPath,
      PORT: '0',
      NODE_ENV: 'production'
    };
    console.log('[MAIN] Spawning backend with:', systemNode, backendEntry);
    backendProcess = spawn(systemNode, [backendEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..', 'backend')
    });
    let portResolved = false;
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[BACKEND STDOUT]', output.trim());
      const match = output.match(/rodando em http:\/\/localhost:(\d+)/);
      if (match && !portResolved) {
        backendPort = parseInt(match[1], 10);
        portResolved = true;
        console.log('[MAIN] Backend port resolved:', backendPort);
        resolve(backendPort);
      }
    });
    backendProcess.stderr.on('data', (data) => {
      console.error('[BACKEND STDERR]', data.toString().trim());
    });
    backendProcess.on('error', (err) => {
      console.error('[BACKEND PROCESS ERROR]', err);
      if (!portResolved) reject(err);
    });
    backendProcess.on('exit', (code, signal) => {
      console.log('[BACKEND] exited with code', code, 'signal', signal);
      if (!portResolved) reject(new Error('Backend exited before port resolved'));
    });
    setTimeout(() => {
      if (!portResolved) reject(new Error('Backend did not start in time'));
    }, 10000);
  });
}

function killBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    backendPort = null;
  }
}

async function createWindow() {
  try {
    await createBackendProcess();
  } catch (err) {
    dialog.showErrorBox('Backend Error', 'Failed to start backend: ' + err.message);
    app.quit();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: 'Igreja Fácil',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false
  });
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(frontendDist)) {
    await mainWindow.loadFile(frontendDist, {
      query: { backendPort: getBackendPort() }
    });
  } else {
    await mainWindow.loadURL(`http://localhost:${getBackendPort()}`);
  }
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  killBackend();
});

ipcMain.handle('get-backend-port', () => getBackendPort());