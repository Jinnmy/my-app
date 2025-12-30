const { contextBridge, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    openExternal: (url) => shell.openExternal(url)
});
