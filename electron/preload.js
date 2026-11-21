/**
 * Electron preload：向渲染进程暴露受控的原生能力
 *
 * 渲染进程只能通过 window.flyHost 访问这些能力，
 * 不开启 nodeIntegration，保持上下文隔离。
 */
const { contextBridge, ipcRenderer } = require("electron");

const paths = ipcRenderer.sendSync("app:paths");

contextBridge.exposeInMainWorld("flyHost", {
    platform: "electron",
    appDataPath: paths.appDataPath,
    cacheRoot: paths.cacheRoot,
    installPath: paths.installPath,
    networkCachePath: paths.networkCachePath,
    tempPath: paths.tempPath,
    picturesPath: paths.picturesPath,
    musicPath: paths.musicPath,
    appVersion: paths.appVersion,

    invoke(channel, payload) {
        return ipcRenderer.invoke(channel, payload);
    },

    send(channel, payload) {
        ipcRenderer.send(channel, payload);
    },

    on(channel, listener) {
        const wrapped = (_event, payload) => listener(payload);
        ipcRenderer.on(channel, wrapped);
        return () => {
            ipcRenderer.removeListener(channel, wrapped);
        };
    },
});
