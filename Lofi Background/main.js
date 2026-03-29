const { app, BrowserWindow, dialog, screen } = require('electron');
const path = require('path');

// Parse Windows screensaver command-line args
// Windows passes: /s (start), /c (configure), /p HWND (preview in settings pane)
const rawArgs = process.argv.slice(1).map(a => a.toLowerCase().replace(':', ''));
const mode = rawArgs.find(a => a.startsWith('/p') || a === '-p') ? 'preview'
            : rawArgs.find(a => a.startsWith('/c') || a === '-c') ? 'configure'
            : 'screensaver'; // /s or default → run fullscreen

function createScreensaver() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#030306',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile('index.html');
  win.setMenu(null);

  // Exit on any keyboard input
  win.webContents.on('before-input-event', () => {
    app.quit();
  });

  // Exit on mouse movement / click / scroll (standard screensaver behavior)
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      let _moveCount = 0;
      document.addEventListener('mousemove', () => {
        _moveCount++;
        if (_moveCount > 5) window.close();
      });
      document.addEventListener('mousedown', () => window.close());
      document.addEventListener('wheel', () => window.close());
    `);
  });

  win.on('closed', () => app.quit());
}

function showConfigure() {
  dialog.showMessageBoxSync({
    type: 'info',
    title: 'NeoRacer Screensaver',
    message: 'No settings available.\n\nNeobotics Foundation Inc.\nNeoRacer Interactive Screensaver',
    buttons: ['OK'],
  });
  app.quit();
}

app.whenReady().then(() => {
  switch (mode) {
    case 'configure':
      showConfigure();
      break;
    case 'preview':
      // Windows sends /p HWND to embed in the settings preview pane.
      // Electron can't embed into a native HWND, so just exit silently.
      // The user will see the screensaver when it actually triggers or via "Preview" button.
      app.quit();
      break;
    default:
      createScreensaver();
      break;
  }
});

app.on('window-all-closed', () => app.quit());
