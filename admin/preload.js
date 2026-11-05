const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Настройка подключения к папке/репозиторию
  getSetupState: () => ipcRenderer.invoke("setup:getState"),
  pickFolder: (title) => ipcRenderer.invoke("dialog:pickFolder", title),
  useExistingFolder: (folder) => ipcRenderer.invoke("setup:useExistingFolder", folder),
  cloneRepo: (opts) => ipcRenderer.invoke("setup:cloneRepo", opts),
  getRemote: () => ipcRenderer.invoke("setup:getRemote"),
  setRemote: (url) => ipcRenderer.invoke("setup:setRemote", url),
  testConnection: () => ipcRenderer.invoke("setup:testConnection"),

  // Товары
  listProducts: () => ipcRenderer.invoke("products:list"),
  saveProduct: (product, newImagePath) => ipcRenderer.invoke("products:save", product, newImagePath),
  deleteProduct: (id) => ipcRenderer.invoke("products:delete", id),
  setVisible: (id, visible) => ipcRenderer.invoke("products:setVisible", id, visible),

  pickImage: () => ipcRenderer.invoke("dialog:pickImage"),
  toFileUrl: (absolutePath) => ipcRenderer.invoke("fs:toFileUrl", absolutePath),

  gitPull: () => ipcRenderer.invoke("git:pull"),
  gitPush: (message) => ipcRenderer.invoke("git:push", message),
  gitStatus: () => ipcRenderer.invoke("git:status"),

  getRepoRoot: () => ipcRenderer.invoke("app:getRepoRoot"),
});
