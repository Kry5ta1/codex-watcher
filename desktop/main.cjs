const fs = require("node:fs");
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
const TRANSPARENCY_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const WINDOW_DEFAULTS = { width: 420, height: 700 };

let mainWindow;
let tray;
let settings = {};
let saveTimer;
let isQuitting = false;

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
  mainWindow = new BrowserWindow({
    ...safeBounds(settings.bounds),
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: true,
    minHeight: 620,
    minWidth: 380,
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
  applyWindowFlags();

  mainWindow.once("ready-to-show", () => showWindow());
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("move", queueBoundsSave);
  mainWindow.on("resize", queueBoundsSave);
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
          {
            label: `透明度：${currentTransparency()}%`,
            submenu: transparencyOptions().map((value) => ({
              checked: currentTransparency() === value,
              click: () => updateTransparency(value),
              label: `${value}%`,
              type: "radio"
            }))
          },
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
  ipcMain.handle("widget:get-transparency", () =>
    Number.isFinite(Number(settings.transparency))
      ? currentTransparency()
      : null
  );
  ipcMain.handle("widget:set-transparency", (_event, value) => updateTransparency(value));
}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
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

function updateTransparency(value) {
  const nextTransparency = clampTransparency(value);
  settings.transparency = nextTransparency;
  saveSettings(settings);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("widget:transparency-changed", nextTransparency);
  }
  refreshTrayMenu();
  return nextTransparency;
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
    settings.bounds = mainWindow.getBounds();
    saveSettings(settings);
  }, 250);
}

function safeBounds(bounds) {
  if (
    !bounds ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height)
  ) {
    return WINDOW_DEFAULTS;
  }

  const area = screen.getPrimaryDisplay().workArea;
  const intersects =
    bounds.x < area.x + area.width &&
    bounds.x + bounds.width > area.x &&
    bounds.y < area.y + area.height &&
    bounds.y + bounds.height > area.y;

  return intersects
    ? bounds
    : {
        ...WINDOW_DEFAULTS,
        x: area.x + Math.round((area.width - WINDOW_DEFAULTS.width) / 2),
        y: area.y + Math.round((area.height - WINDOW_DEFAULTS.height) / 2)
      };
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
  return clampTransparency(settings.transparency);
}

function transparencyOptions() {
  const current = currentTransparency();
  return TRANSPARENCY_OPTIONS.includes(current)
    ? TRANSPARENCY_OPTIONS
    : [...TRANSPARENCY_OPTIONS, current].sort((left, right) => left - right);
}

function clampTransparency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 18;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
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
