const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexWidget", {
  getLayout: () => ipcRenderer.invoke("widget:get-layout"),
  reportContentSize: (value) => ipcRenderer.invoke("widget:report-content-size", value),
  onLayoutChanged: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("widget:layout-changed", listener);
    return () => ipcRenderer.removeListener("widget:layout-changed", listener);
  },
  getAppearance: () => ipcRenderer.invoke("widget:get-appearance"),
  setAppearance: (value) => ipcRenderer.invoke("widget:set-appearance", value)
});
