const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

let tray = null;
let isQuitting = false;

// Generic cloud icon (base64) - REMOVED
// const iconBase64 = '...'; 
// const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);

// Load icon from assets
const iconPath = path.join(__dirname, '../ui/public/assets/logo.ico');
const icon = nativeImage.createFromPath(iconPath);

const { startServer } = require('../server/server');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const fs = require('fs');

const createTray = () => {
  tray = new Tray(icon);
  tray.setToolTip('NAS 2.0');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      if (windows[0].isVisible()) {
        windows[0].hide();
      } else {
        windows[0].show();
      }
    } else {
      createWindow();
    }
  });
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Security best practice
      contextIsolation: true
    },
    autoHideMenuBar: true, // Make it look more like an app
    icon: icon // Set window icon
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return; // Let it close if we are quitting

    const isPackaged = app.isPackaged;
    let settingsPath = path.join(__dirname, '../server/config/settings.json');

    if (isPackaged) {
      settingsPath = path.join(app.getPath('userData'), 'settings.json');
    }

    let shouldMinimize = true; // Default

    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settings.minimizeToTray !== undefined) {
          shouldMinimize = settings.minimizeToTray;
        }
      }
    } catch (e) {
      console.error('Failed to read settings in main process:', e);
    }

    if (shouldMinimize) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  let configPath = path.join(__dirname, '../server/config/storage.json');
  if (app.isPackaged) {
    configPath = path.join(app.getPath('userData'), 'storage.json');
    console.log('Checking config at:', configPath);
  }

  if (fs.existsSync(configPath)) {
    // Setup complete, load the dashboard
    mainWindow.loadURL('http://localhost:3000/');
  } else {
    // No config found, load the setup wizard
    mainWindow.loadURL('http://localhost:3000/setup.html');
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  startServer(app); // Start the Express server with Electron app instance
  createTray();
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
