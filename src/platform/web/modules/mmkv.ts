/**
 * react-native-mmkv 的 Web/Electron 实现
 *
 * 底层使用 localStorage（数据持久化在 Chromium userData 目录），
 * API 面覆盖 mmkv 的常用读写方法与变更监听。
 */
import { useCallback, useEffect, useState } from "react";

type MMKVValue = string | number | boolean | Uint8Array;

interface IMMKVConfig {
    id: string;
    path?: string;
    encryptionKey?: string;
    mode?: string;
}

type ValueChangedListener = (key: string) => void;

const listenerMap = new Map<string, Set<ValueChangedListener>>();

export class MMKV {
    readonly id: string;
    private prefix: string;

    constructor(config: IMMKVConfig) {
        this.id = config?.id ?? "mmkv.default";
        this.prefix = `mmkv:${this.id}:`;
    }

    private notify(key: string) {
        const set = listenerMap.get(this.id);
        if (!set) {
            return;
        }
        for (const fn of set) {
            try {
                fn(key);
            } catch {}
        }
    }

    set(key: string, value: MMKVValue) {
        try {
            if (value instanceof Uint8Array) {
                // 二进制退化为 base64 字符串存储
                let binary = "";
                for (const byte of Array.from(value)) {
                    binary += String.fromCharCode(byte);
                }
                localStorage.setItem(
                    this.prefix + key,
                    JSON.stringify({ __t: "u8", v: btoa(binary) }),
                );
            } else {
                localStorage.setItem(
                    this.prefix + key,
                    JSON.stringify({ __t: typeof value, v: value }),
                );
            }
        } catch (e) {
            console.warn("[mmkv] set 失败", key, e);
            return;
        }
        this.notify(key);
    }

    private read(key: string): any {
        try {
            const raw = localStorage.getItem(this.prefix + key);
            if (raw === null) {
                return undefined;
            }
            const parsed = JSON.parse(raw);
            if (parsed?.__t === "u8") {
                const binary = atob(parsed.v);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                return bytes;
            }
            return parsed?.v;
        } catch {
            return undefined;
        }
    }

    getString(key: string): string | undefined {
        const value = this.read(key);
        return typeof value === "string" ? value : undefined;
    }

    getNumber(key: string): number | undefined {
        const value = this.read(key);
        return typeof value === "number" ? value : undefined;
    }

    getBoolean(key: string): boolean | undefined {
        const value = this.read(key);
        return typeof value === "boolean" ? value : undefined;
    }

    getBuffer(key: string): Uint8Array | undefined {
        const value = this.read(key);
        return value instanceof Uint8Array ? value : undefined;
    }

    contains(key: string): boolean {
        return localStorage.getItem(this.prefix + key) !== null;
    }

    delete(key: string) {
        localStorage.removeItem(this.prefix + key);
        this.notify(key);
    }

    getAllKeys(): string[] {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const full = localStorage.key(i);
            if (full && full.startsWith(this.prefix)) {
                keys.push(full.slice(this.prefix.length));
            }
        }
        return keys;
    }

    clearAll() {
        const keys = this.getAllKeys();
        for (const key of keys) {
            localStorage.removeItem(this.prefix + key);
        }
        keys.forEach(k => this.notify(k));
    }

    recryptKey() {
        // web 端不加密
    }

    addOnValueChangedListener(listener: ValueChangedListener) {
        let set = listenerMap.get(this.id);
        if (!set) {
            set = new Set();
            listenerMap.set(this.id, set);
        }
        set.add(listener);
        return {
            remove: () => {
                set!.delete(listener);
            },
        };
    }
}

/** 与 mmkv 一致的 [value, setValue] hook */
export function useMMKVObject<T>(
    key: string,
    instance?: MMKV,
): [T | undefined, (value: T | ((prev: T | undefined) => T)) => void] {
    const store = instance ?? defaultMMKV;

    const readValue = useCallback((): T | undefined => {
        const raw = store.getString(key);
        if (raw === undefined || raw === null || raw === "") {
            return undefined;
        }
        try {
            return JSON.parse(raw) as T;
        } catch {
            return undefined;
        }
    }, [store, key]);

    const [value, setValue] = useState<T | undefined>(readValue);

    useEffect(() => {
        setValue(readValue());
        const sub = store.addOnValueChangedListener(changedKey => {
            if (changedKey === key) {
                setValue(readValue());
            }
        });
        return () => sub.remove();
    }, [key, readValue]);

    const update = useCallback(
        (next: T | ((prev: T | undefined) => T)) => {
            setValue(prev => {
                const resolved =
                    typeof next === "function"
                        ? (next as (p: T | undefined) => T)(prev)
                        : next;
                store.set(key, JSON.stringify(resolved));
                return resolved;
            });
        },
        [store, key],
    );

    return [value, update];
}

export const defaultMMKV = new MMKV({ id: "mmkv.default" });

export default MMKV;
