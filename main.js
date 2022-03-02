/* SPDX-License-Identifier: MIT */
/* SnippetCopyrightText: Copyright © 2022 peanut inventory, muchirijohn */

const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {

  const remoteMain = require("@electron/remote/main")
  remoteMain.initialize()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    minWidth: 1200,
    webPreferences: {
      //enableRemoteModule: true,
      nodeIntegration: true,
      disableDialogs: false,
      contextIsolation: false,
      autoHideMenuBar: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.

  mainWindow.setMenuBarVisibility(false);

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  remoteMain.enable(mainWindow.webContents);

  mainWindow.loadFile('./app/inv_main.html');
}

app.allowRendererProcessReuse = false;
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {  
  createWindow()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
app.on('closed', _ => {
  mainWindow = null;
});