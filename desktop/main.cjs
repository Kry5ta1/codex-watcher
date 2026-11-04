const fs = require("node:fs");
const { normalizeAppearance, themeTransparency } = require("./appearance.cjs");
const { normalizeContentSize, selectWorkArea, fitWindowLayout } = require("./window-layout.cjs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  dialog,
  nativeImage,
  screen
} = require("electron");

const DEV_URL = "http://127.0.0.1:3000/widget";
const START_PORT = 42173;

let mainWindow;
let tray;
let settings = {};
let saveTimer;
let isQuitting = false;
let contentSize = null;
let currentLayout = null;
let layoutTimer;
let applyingLayout = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName("Codex Watcher");

  app.on("second-instance", () => showWindow());
  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.whenReady().then(async () => {
    settings = loadSettings();
    registerIpc();
    applyLoginItemSetting();

    try {
      const appUrl = await resolveAppUrl();
      createWindow(appUrl);
      createTray();
    } catch (error) {
      dialog.showErrorBox("Codex Watcher", error.message);
      app.quit();
    }
  });

  app.on("activate", () => showWindow());
}

async function resolveAppUrl() {
  if (process.env.CODEX_WIDGET_DEV === "1") {
    return DEV_URL;
  }

  const standaloneDir = path.join(app.getAppPath(), ".next", "standalone");
  const serverPath = path.join(standaloneDir, "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error("没有找到 .next\\standalone\\server.js。请先执行 npm run build。");
  }

  const port = await findFreePort(START_PORT);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";
  process.env.PORT = String(port);

  require(serverPath);

  const url = `http://127.0.0.1:${port}/widget`;
  await waitForServer(url);
  return url;
}

function createWindow(appUrl) {
  const initial = calculateWindowLayout(settings.bounds);
  currentLayout = initial.layout;
  mainWindow = new BrowserWindow({
    ...initial.bounds,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: true,
    minHeight: initial.minimum.height,
    minWidth: initial.minimum.width,
    resizable: settings.locked !== true,
    show: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setSkipTaskbar(true);
  // Content measurements and native DIP sizes share a 1:1 CSS coordinate space.
  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  mainWindow.webContents.on("zoom-changed", () => mainWindow.webContents.setZoomFactor(1));
  applyWindowFlags();

  mainWindow.once("ready-to-show", () => showWindow());
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  const geometryChanged = () => {
    queueBoundsSave();
    if (!applyingLayout) scheduleLayout();
  };
  // Clamp after a Windows move gesture, not on every intermediate move event:
  // otherwise snapping back at the monitor edge can prevent crossing displays.
  mainWindow.on("move", queueBoundsSave);
  mainWindow.on("moved", geometryChanged);
  mainWindow.on("resize", geometryChanged);
  screen.on("display-metrics-changed", scheduleLayout);
  screen.on("display-added", scheduleLayout);
  screen.on("display-removed", scheduleLayout);
  mainWindow.on("closed", () => {
    clearTimeout(layoutTimer);
    clearTimeout(saveTimer);
    screen.removeListener("display-metrics-changed", scheduleLayout);
    screen.removeListener("display-added", scheduleLayout);
    screen.removeListener("display-removed", scheduleLayout);
  });
  mainWindow.webContents.on("did-fail-load", (_event, _code, description) => {
    dialog.showMessageBox(mainWindow, {
      message: "无法打开桌面卡片",
      detail:
        process.env.CODEX_WIDGET_DEV === "1"
          ? "请先运行 npm run dev，然后再运行 npm run desktop:dev。"
          : description,
      type: "error"
    });
  });

  mainWindow.loadURL(appUrl);
}

function createTray() {
  const icon = nativeImage
    .createFromPath(path.join(app.getAppPath(), "public", "app-icon.png"))
    .resize({ height: 16, width: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Codex Watcher");
  tray.on("click", () => showWindow());
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示卡片", click: showWindow },
      { label: "隐藏卡片", click: () => mainWindow?.hide() },
      {
        label: "刷新数据",
        click: () => mainWindow?.webContents.reloadIgnoringCache()
      },
      { type: "separator" },
      {
        label: "设置",
        submenu: [
          { label: `主题背景透明度：${currentTransparency()}%`, enabled: false },
          { type: "separator" },
          {
            checked: settings.alwaysOnTop === true,
            click: (item) => updateSetting("alwaysOnTop", item.checked),
            label: "窗口置顶",
            type: "checkbox"
          },
          {
            checked: settings.locked === true,
            click: (item) => updateSetting("locked", item.checked),
            label: "锁定位置",
            type: "checkbox"
          },
          {
            checked: currentOpenAtLogin(),
            click: (item) => updateSetting("openAtLogin", item.checked),
            label: "开机启动",
            type: "checkbox"
          }
        ]
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function registerIpc() {
  ipcMain.handle("widget:get-layout", () => currentLayout);
  ipcMain.handle("widget:report-content-size", (event, value) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return currentLayout;
    const next = normalizeContentSize(value);
    if (next && (!contentSize || next.width !== contentSize.width || next.height !== contentSize.height)) {
      contentSize = next;
      applyContentLayout();
    }
    return currentLayout;
  });
  ipcMain.handle("widget:get-appearance", () => settings.appearance ? normalizeAppearance(settings.appearance) : null);
  ipcMain.handle("widget:set-appearance", (_event, value) => {
    const next = normalizeAppearance(value);
    settings.appearance = next;
    saveSettings(settings);
    refreshTrayMenu();
    return next;
  });

}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  applyContentLayout();
  mainWindow.show();
  mainWindow.focus();
}

function updateSetting(key, value) {
  settings[key] = value;
  saveSettings(settings);

  if (key === "openAtLogin") {
    applyLoginItemSetting();
  } else {
    applyWindowFlags();
  }

  refreshTrayMenu();
}

function applyWindowFlags() {
  if (!mainWindow) {
    return;
  }
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop === true);
  mainWindow.setResizable(settings.locked !== true);
  if (typeof mainWindow.setMovable === "function") {
    mainWindow.setMovable(settings.locked !== true);
  }
}

function currentOpenAtLogin() {
  return app.getLoginItemSettings().openAtLogin || settings.openAtLogin === true;
}

function applyLoginItemSetting() {
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin === true });
}

function queueBoundsSave() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    settings.bounds = mainWindow.getBounds();
    saveSettings(settings);
  }, 250);
}

function calculateWindowLayout(bounds) {
  const area = selectWorkArea(bounds, screen.getAllDisplays(), screen.getPrimaryDisplay().id);
  return fitWindowLayout(bounds, area, contentSize);
}

function scheduleLayout() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(applyContentLayout, 60);
}

function applyContentLayout() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  const previousBounds = mainWindow.getBounds();
  const next = calculateWindowLayout(previousBounds);
  applyingLayout = true;
  try {
    const [minWidth, minHeight] = mainWindow.getMinimumSize();
    if (minWidth !== next.minimum.width || minHeight !== next.minimum.height) {
      mainWindow.setMinimumSize(next.minimum.width, next.minimum.height);
    }
    const actualBounds = mainWindow.getBounds();
    if (["x", "y", "width", "height"].some((key) => actualBounds[key] !== next.bounds[key])) {
      mainWindow.setBounds(next.bounds);
    }
    if (JSON.stringify(currentLayout) !== JSON.stringify(next.layout)) {
      currentLayout = next.layout;
      mainWindow.webContents.send("widget:layout-changed", currentLayout);
    }
  } finally {
    applyingLayout = false;
  }
  queueBoundsSave();
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(nextSettings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(nextSettings, null, 2));
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function currentTransparency() {
  return themeTransparency(settings.appearance?.theme);
}

async function findFreePort(start) {
  for (let port = start; port < start + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }
  throw new Error("没有找到可用的本地端口。");
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await canOpen(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("本地桌面服务启动超时。");
}

function canOpen(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(true);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}
