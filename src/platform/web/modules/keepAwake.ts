/**
 * expo-keep-awake 的 Web 实现
 *
 * 桌面端播放时通过 Screen Wake Lock API 阻止休眠（浏览器支持时生效）。
 */
import { useEffect } from "react";

let sentinel: any = null;
let refCount = 0;

async function acquire() {
    refCount += 1;
    if (sentinel || refCount > 1) {
        return;
    }
    try {
        const nav: any = navigator;
        if (nav?.wakeLock?.request) {
            sentinel = await nav.wakeLock.request("screen");
            sentinel.addEventListener?.("release", () => {
                sentinel = null;
            });
        }
    } catch {
        sentinel = null;
    }
}

async function release() {
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0) {
        return;
    }
    try {
        await sentinel?.release?.();
    } catch {}
    sentinel = null;
}

export function useKeepAwake(_tag?: string) {
    useEffect(() => {
        acquire();
        return () => {
            release();
        };
    }, []);
}

export async function activateKeepAwake(_tag?: string) {
    await acquire();
}

export async function deactivateKeepAwake(_tag?: string) {
    await release();
}

export default {
    useKeepAwake,
    activateKeepAwake,
    deactivateKeepAwake,
};
