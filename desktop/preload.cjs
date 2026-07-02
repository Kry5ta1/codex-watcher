const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexWidget", {
  getTransparency: () => ipcRenderer.invoke("widget:get-transparency"),
  onTransparencyChanged: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("widget:transparency-changed", listener);
    return () => ipcRenderer.removeListener("widget:transparency-changed", listener);
  },
  setTransparency: (value) => ipcRenderer.invoke("widget:set-transparency", value)
});
