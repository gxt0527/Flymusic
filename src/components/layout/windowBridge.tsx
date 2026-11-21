/**
 * 桌面端窗口能力桥接
 *
 * 1. 把「关闭按钮执行操作」配置同步给主进程（主进程在窗口 close 时就要拿到值）
 * 2. 接收托盘菜单的操作（播放/暂停、下一首）
 *
 * 只在 Electron 渲染进程（存在 window.flyHost）时生效，纯浏览器下是空组件。
 */
import { useEffect, useRef } from "react";

import { useAppConfig } from "@/core/appConfig";
import TrackPlayer, { useMusicState } from "@/core/trackPlayer";
import { host } from "@/platform/web/host";
import { musicIsPaused } from "@/utils/trackUtils";

export default function WindowBridge() {
    const closeAction = useAppConfig("basic.closeAction");
    const musicState = useMusicState();
    const musicStateRef = useRef(musicState);
    musicStateRef.current = musicState;

    // 配置变化即时同步给主进程，重启后主进程也能从自己的 JSON 里读到
    useEffect(() => {
        if (!host) {
            return;
        }
        host.invoke("win:setCloseAction", closeAction ?? "tray").catch(() => {});
    }, [closeAction]);

    // 托盘右键菜单
    useEffect(() => {
        if (!host) {
            return;
        }
        const offToggle = host.on("tray:toggle-play", () => {
            try {
                if (musicIsPaused(musicStateRef.current)) {
                    TrackPlayer.play();
                } else {
                    TrackPlayer.pause();
                }
            } catch {}
        });
        const offNext = host.on("tray:next", () => {
            try {
                TrackPlayer.skipToNext();
            } catch {}
        });
        return () => {
            offToggle?.();
            offNext?.();
        };
    }, []);

    return null;
}
