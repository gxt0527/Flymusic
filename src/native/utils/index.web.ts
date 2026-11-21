/**
 * 原生工具 - Web/桌面端实现
 */

const NativeUtils = {
    exitApp: () => {
        window.close();
    },
    checkStoragePermission: async () => true,
    requestStoragePermission: () => {},
    getWindowDimensions: () => ({
        width: window.innerWidth,
        height: window.innerHeight,
    }),
};

export default NativeUtils;
