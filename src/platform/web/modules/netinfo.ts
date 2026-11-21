/**
 * NetInfo 的 Web/桌面实现。
 *
 * 为什么需要它：`@react-native-community/netinfo` 在浏览器里拿不到 connection type，
 * 会把状态归到 "unknown"，而业务侧 `Network.mapState()` 的 else 分支是 Cellular
 * —— 结果桌面版一播放就弹「当前非 WIFI 环境」的流量提醒并被拦下。
 *
 * 桌面端只有「在线 / 离线」两种语义，恒按 wifi 处理：
 * navigator.onLine 决定是否离线，其余一律视为不计流量的有线/无线网络。
 */

export interface INetInfoState {
    type: "wifi" | "none";
    isConnected: boolean;
    isInternetReachable: boolean;
    details: {
        isConnectionExpensive: boolean;
        ipAddress?: string | null;
    };
}

function currentState(): INetInfoState {
    const online =
        typeof navigator === "undefined" || navigator.onLine !== false;
    return {
        type: online ? "wifi" : "none",
        isConnected: online,
        isInternetReachable: online,
        details: {
            isConnectionExpensive: false,
            ipAddress: null,
        },
    };
}

type Listener = (state: INetInfoState) => void;

const listeners = new Set<Listener>();
let bound = false;

function ensureBound() {
    if (bound || typeof window === "undefined") {
        return;
    }
    bound = true;
    const emit = () => {
        const s = currentState();
        listeners.forEach(l => l(s));
    };
    window.addEventListener("online", emit);
    window.addEventListener("offline", emit);
}

const NetInfo = {
    async fetch(): Promise<INetInfoState> {
        return currentState();
    },
    addEventListener(listener: Listener) {
        ensureBound();
        listeners.add(listener);
        // 与原生一致：订阅后立即回调一次当前状态
        Promise.resolve().then(() => listener(currentState()));
        return () => {
            listeners.delete(listener);
        };
    },
    useNetInfo(): INetInfoState {
        return currentState();
    },
    async refresh(): Promise<INetInfoState> {
        return currentState();
    },
    configure() {
        // no-op
    },
};

export default NetInfo;
