const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexWidget", {
  getAppearance: () => ipcRenderer.invoke("widget:get-appearance"),
  setAppearance: (value) => ipcRenderer.invoke("widget:set-appearance", value),
  getTransparency: () => ipcRenderer.invoke("widget:get-transparency"),
  onTransparencyChanged: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("widget:transparency-changed", listener);
    return () => ipcRenderer.removeListener("widget:transparency-changed", listener);
  },
  setTransparency: (value) => ipcRenderer.invoke("widget:set-transparency", value)
});
