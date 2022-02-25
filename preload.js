// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
/*const { contextBridge } = require('electron')
dialog = require('electron').remote.dialog;*/

window.addEventListener('DOMContentLoaded', () => {
  /*const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    console.log(`${type}-version`, process.versions[type]);
  }*/
  //mainWindow.setMenuBarVisibility(false);
});


/*contextBridge.exposeInMainWorld(
  'electron',
  {
    dialog_: dialog
  }
);*/


