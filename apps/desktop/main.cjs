const { app, BrowserWindow } = require("electron");
const path = require("path");

const DEV_URL = process.env.KUROSHIRO_DEV_URL || "http://127.0.0.1:5173";

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 860,
    minWidth: 360,
    minHeight: 640,
    title: "黒白侵攻 Kuroshiro",
    backgroundColor: "#f3e6d0",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const useDev = !app.isPackaged || process.env.KUROSHIRO_DEV_URL;
  if (useDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "../web/dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
