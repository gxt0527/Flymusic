/**
 * react-native-background-timer 的 Web 实现
 *
 * 浏览器/Electron 渲染进程在窗口最小化时仍会执行定时器（受节流影响），
 * 直接用原生定时器即可。
 */
const BackgroundTimer = {
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms) as any,
    clearTimeout: (id: any) => clearTimeout(id),
    setInterval: (fn: () => void, ms?: number) => setInterval(fn, ms) as any,
    clearInterval: (id: any) => clearInterval(id),
    start: (_ms?: number) => void 0,
    stop: () => void 0,
    runBackgroundTimer: (fn: () => void, ms: number) => setInterval(fn, ms) as any,
    stopBackgroundTimer: () => void 0,
};

export default BackgroundTimer;
