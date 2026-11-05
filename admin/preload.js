const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
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
