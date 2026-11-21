/**
 * react-native-track-player 的 Web/Electron 实现
 *
 * 对齐 RNTP 4.x 的 API 面，底层使用单个 HTMLAudioElement。
 *
 * 关键约定（与 src/core/trackPlayer 的行为对齐）：
 * - 播放队列恒定是 [当前曲, fakeNextTrack] 两首
 * - 播放到末尾时触发 PlaybackActiveTrackChanged(index=1, lastIndex=0)，
 *   由业务层识别 fakeAudioUrl 后调用 skipToNext，避免适配器越权切歌
 * - `musicfree://` 开头的 url 是占位地址，不真正加载
 */
import { host } from "../host";

/* ------------------------------------------------------------------ */
/* 枚举                                                                */
/* ------------------------------------------------------------------ */

export enum State {
    None = "none",
    Ready = "ready",
    Playing = "playing",
    Paused = "paused",
    Stopped = "stopped",
    Buffering = "buffering",
    Loading = "loading",
    Error = "error",
    Ended = "ended",
}

export enum Event {
    PlaybackState = "playback-state",
    PlaybackError = "playback-error",
    PlaybackActiveTrackChanged = "playback-active-track-changed",
    PlaybackProgressUpdated = "playback-progress-updated",
    PlaybackQueueEnded = "playback-queue-ended",
    PlaybackPlayWhenReadyChanged = "playback-play-when-ready-changed",
    PlaybackMetadataReceived = "playback-metadata-received",
    RemotePlay = "remote-play",
    RemotePause = "remote-pause",
    RemoteStop = "remote-stop",
    RemoteNext = "remote-next",
    RemotePrevious = "remote-previous",
    RemoteSeek = "remote-seek",
    RemoteDuck = "remote-duck",
}

export enum Capability {
    Play = "play",
    Pause = "pause",
    Stop = "stop",
    SeekTo = "seek-to",
    SkipToNext = "skip-to-next",
    SkipToPrevious = "skip-to-previous",
}

export enum AppKilledPlaybackBehavior {
    ContinuePlayback = "continue-playback",
    StopPlaybackAndRemoveNotification = "stop-playback-and-remove-notification",
    PausePlayback = "pause-playback",
}

export enum RepeatMode {
    Off = 0,
    Track = 1,
    Queue = 2,
}

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export interface Track {
    id?: string;
    url: string | number;
    title?: string;
    artist?: string;
    album?: string;
    artwork?: any;
    duration?: number;
    headers?: Record<string, string>;
    [key: string]: any;
}

export type TrackMetadataBase = Partial<Track>;
export type PlaybackState = { state: State };
export type Progress = { position: number; duration: number; buffered: number };

/* ------------------------------------------------------------------ */
/* URL 解析                                                            */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_SCHEME = "musicfree://";

function isLocalPath(url: string) {
    return (
        /^[A-Za-z]:[\\/]/.test(url) || // Windows 盘符
        url.startsWith("/") || // POSIX 绝对路径
        url.startsWith("\\\\") // UNC
    );
}

/** 把业务层的 url 转成 <audio> 能播的地址 */
export function toPlayableUrl(url: string): string {
    if (!url) {
        return "";
    }
    if (url.startsWith(PLACEHOLDER_SCHEME)) {
        return "";
    }
    if (/^(https?:|data:|blob:|fly-media:)/.test(url)) {
        return url;
    }
    if (isLocalPath(url)) {
        if (host) {
            return `fly-media://local?path=${encodeURIComponent(url)}`;
        }
        return encodeURI(`file:///${url.replace(/\\/g, "/")}`);
    }
    return url;
}

/* ------------------------------------------------------------------ */
/* 事件总线                                                            */
/* ------------------------------------------------------------------ */

type Listener = (payload: any) => void;
const listeners = new Map<string, Set<Listener>>();

function emit(event: string, payload?: any) {
    const set = listeners.get(event);
    if (!set) {
        return;
    }
    for (const fn of [...set]) {
        try {
            fn(payload);
        } catch (e) {
            console.warn("[web-player] listener error", e);
        }
    }
}

/* ------------------------------------------------------------------ */
/* 播放器                                                              */
/* ------------------------------------------------------------------ */

class WebTrackPlayer {
    private audio: HTMLAudioElement | null = null;
    private queue: Track[] = [];
    private activeIndex = -1;
    private state: State = State.None;
    private rate = 1;
    private volume = 1;
    private progressTimer: any = null;
    private lastProgressSecond = -1;

    /* ---------------- 生命周期 ---------------- */

    async setupPlayer(_options?: any): Promise<void> {
        if (this.audio) {
            throw new Error(
                "The player has already been initialized via setupPlayer.",
            );
        }
        const audio = new Audio();
        audio.preload = "auto";
        this.audio = audio;
        this.bindAudioEvents(audio);
        this.setState(State.Ready);
    }

    async updateOptions(_options?: any): Promise<void> {
        // 桌面端无通知栏，忽略
    }

    async registerPlaybackService(_factory?: any): Promise<void> {
        // web 无后台播放服务
    }

    private bindAudioEvents(audio: HTMLAudioElement) {
        audio.addEventListener("playing", () => {
            this.setState(State.Playing);
        });
        audio.addEventListener("pause", () => {
            if (this.state !== State.Stopped && this.state !== State.Ended) {
                this.setState(State.Paused);
            }
        });
        audio.addEventListener("waiting", () => {
            this.setState(State.Buffering);
        });
        audio.addEventListener("canplay", () => {
            if (this.state === State.Buffering || this.state === State.Loading) {
                this.setState(audio.paused ? State.Paused : State.Playing);
            }
        });
        audio.addEventListener("timeupdate", () => {
            const second = Math.floor(audio.currentTime);
            if (second !== this.lastProgressSecond) {
                this.lastProgressSecond = second;
                emit(Event.PlaybackProgressUpdated, {
                    position: audio.currentTime,
                    duration: audio.duration || 0,
                    buffered: audio.buffered?.length
                        ? audio.buffered.end(audio.buffered.length - 1)
                        : 0,
                });
            }
        });
        audio.addEventListener("ended", () => {
            this.handleEnded();
        });
        audio.addEventListener("error", () => {
            // 占位轨不加载，不会走到这里
            const code = audio.error?.code;
            this.setState(State.Error);
            emit(Event.PlaybackError, {
                code: String(code ?? "unknown"),
                message: audio.error?.message || "audio-element-error",
            });
        });
    }

    /** 播放结束：推进到下一首占位轨并通知业务层 */
    private handleEnded() {
        const lastIndex = this.activeIndex;
        const nextIndex = lastIndex + 1;
        if (nextIndex >= this.queue.length) {
            this.setState(State.Ended);
            emit(Event.PlaybackQueueEnded, {
                position: this.audio?.currentTime ?? 0,
                track: lastIndex,
            });
            return;
        }
        this.activeIndex = nextIndex;
        const track = this.queue[nextIndex];
        this.setState(State.Ended);
        emit(Event.PlaybackActiveTrackChanged, {
            lastIndex,
            lastTrack: this.queue[lastIndex],
            index: nextIndex,
            track,
        });
    }

    private setState(next: State) {
        if (this.state === next) {
            return;
        }
        this.state = next;
        emit(Event.PlaybackState, { state: next });
    }

    /* ---------------- 队列 ---------------- */

    async setQueue(tracks: Track[]): Promise<void> {
        this.queue = (tracks ?? []).map(t => ({ ...t }));
        this.activeIndex = this.queue.length > 0 ? 0 : -1;
        this.loadActive(false);
    }

    async add(tracks: Track | Track[], insertBeforeIndex?: number): Promise<void> {
        const list = Array.isArray(tracks) ? tracks : [tracks];
        if (insertBeforeIndex === undefined || insertBeforeIndex < 0) {
            this.queue = this.queue.concat(list);
        } else {
            this.queue = [
                ...this.queue.slice(0, insertBeforeIndex),
                ...list,
                ...this.queue.slice(insertBeforeIndex),
            ];
        }
    }

    async remove(index: number | number[]): Promise<void> {
        const set = new Set(Array.isArray(index) ? index : [index]);
        this.queue = this.queue.filter((_, i) => !set.has(i));
        if (this.activeIndex >= this.queue.length) {
            this.activeIndex = this.queue.length - 1;
        }
    }

    async getQueue(): Promise<Track[]> {
        return this.queue;
    }

    async getActiveTrack(): Promise<Track | undefined> {
        return this.queue[this.activeIndex];
    }

    async getActiveTrackIndex(): Promise<number | undefined> {
        return this.activeIndex >= 0 ? this.activeIndex : undefined;
    }

    async getTrack(index: number): Promise<Track | undefined> {
        return this.queue[index];
    }

    async updateMetadataForTrack(
        index: number,
        metadata: TrackMetadataBase,
    ): Promise<void> {
        if (this.queue[index]) {
            this.queue[index] = { ...this.queue[index], ...metadata };
        }
    }

    /** 加载 activeIndex 对应的音频到 <audio> */
    private loadActive(autoplay: boolean) {
        const audio = this.audio;
        const track = this.queue[this.activeIndex];
        if (!audio || !track) {
            return;
        }
        const url = typeof track.url === "string" ? track.url : String(track.url);
        const playable = toPlayableUrl(url);
        if (!playable) {
            // 占位轨：清空源，保持静默
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
            this.setState(State.Ready);
            return;
        }
        audio.src = playable;
        audio.playbackRate = this.rate;
        audio.volume = this.volume;
        audio.load();
        this.setState(State.Loading);
        if (autoplay) {
            this.play().catch(() => void 0);
        }
    }

    async skip(index: number, initialPosition?: number): Promise<void> {
        if (index < 0 || index >= this.queue.length) {
            throw new Error(`[web-player] skip 越界: ${index}`);
        }
        const lastIndex = this.activeIndex;
        this.activeIndex = index;
        const track = this.queue[index];
        this.loadActive(!this.audio?.paused || this.state === State.Playing);
        if (initialPosition !== undefined) {
            this.seekTo(initialPosition);
        }
        emit(Event.PlaybackActiveTrackChanged, {
            lastIndex,
            lastTrack: this.queue[lastIndex],
            index,
            track,
        });
    }

    async skipToNext(): Promise<void> {
        await this.skip(this.activeIndex + 1);
    }

    async skipToPrevious(): Promise<void> {
        await this.skip(this.activeIndex - 1);
    }

    /* ---------------- 播放控制 ---------------- */

    async play(): Promise<void> {
        const audio = this.audio;
        if (!audio) {
            throw new Error("The player is not initialized. Call setupPlayer first.");
        }
        if (!audio.src) {
            this.loadActive(true);
            return;
        }
        try {
            await audio.play();
        } catch (e: any) {
            // 浏览器自动播放策略拦截
            if (e?.name === "NotAllowedError") {
                this.setState(State.Paused);
                return;
            }
            throw e;
        }
    }

    async pause(): Promise<void> {
        this.audio?.pause();
    }

    async stop(): Promise<void> {
        const audio = this.audio;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        this.setState(State.Stopped);
    }

    async reset(): Promise<void> {
        const audio = this.audio;
        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        }
        this.queue = [];
        this.activeIndex = -1;
        this.setState(State.None);
    }

    async seekTo(seconds: number): Promise<void> {
        const audio = this.audio;
        if (!audio) {
            return;
        }
        if (Number.isFinite(audio.duration) && seconds > audio.duration) {
            return;
        }
        audio.currentTime = Math.max(0, seconds);
    }

    async getProgress(): Promise<Progress> {
        const audio = this.audio;
        if (!audio) {
            return { position: 0, duration: 0, buffered: 0 };
        }
        return {
            position: audio.currentTime || 0,
            duration: Number.isFinite(audio.duration) ? audio.duration : 0,
            buffered: audio.buffered?.length
                ? audio.buffered.end(audio.buffered.length - 1)
                : 0,
        };
    }

    async getPlaybackState(): Promise<PlaybackState> {
        return { state: this.state };
    }

    async getRate(): Promise<number> {
        return this.rate;
    }

    async setRate(rate: number): Promise<void> {
        this.rate = rate;
        if (this.audio) {
            this.audio.playbackRate = rate;
        }
    }

    async setVolume(volume: number): Promise<void> {
        this.volume = volume;
        if (this.audio) {
            this.audio.volume = Math.min(1, Math.max(0, volume));
        }
    }

    async getVolume(): Promise<number> {
        return this.volume;
    }

    /* ---------------- 事件 ---------------- */

    addEventListener(event: Event | string, listener: Listener) {
        let set = listeners.get(event as string);
        if (!set) {
            set = new Set();
            listeners.set(event as string, set);
        }
        set.add(listener);
        return {
            remove: () => {
                set!.delete(listener);
            },
        };
    }

    /** 供 React hooks 直接读取 */
    getState() {
        return this.state;
    }
}

export const player = new WebTrackPlayer();

/* ------------------------------------------------------------------ */
/* React hooks                                                         */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";

export function usePlaybackState(): PlaybackState {
    const [value, setValue] = useState<PlaybackState>(() => ({
        state: player.getState(),
    }));
    useEffect(() => {
        const sub = player.addEventListener(Event.PlaybackState, (e: any) =>
            setValue({ state: e.state }),
        );
        setValue({ state: player.getState() });
        return () => sub.remove();
    }, []);
    return value;
}

export function useProgress(updateInterval = 1000): Progress {
    const [value, setValue] = useState<Progress>({
        position: 0,
        duration: 0,
        buffered: 0,
    });
    useEffect(() => {
        let alive = true;
        const tick = () => {
            player.getProgress().then(p => {
                if (alive) {
                    setValue(p);
                }
            });
        };
        tick();
        const id = setInterval(tick, Math.max(200, updateInterval));
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [updateInterval]);
    return value;
}

export function useIsPlaying() {
    const { state } = usePlaybackState();
    return {
        playing: state === State.Playing,
        buffering: state === State.Buffering || state === State.Loading,
    };
}

/* ------------------------------------------------------------------ */
/* 默认导出（对齐 RNTP default export）                                 */
/* ------------------------------------------------------------------ */

const RNTrackPlayer = {
    setupPlayer: player.setupPlayer.bind(player),
    updateOptions: player.updateOptions.bind(player),
    registerPlaybackService: player.registerPlaybackService.bind(player),
    setQueue: player.setQueue.bind(player),
    add: player.add.bind(player),
    remove: player.remove.bind(player),
    getQueue: player.getQueue.bind(player),
    getActiveTrack: player.getActiveTrack.bind(player),
    getActiveTrackIndex: player.getActiveTrackIndex.bind(player),
    getTrack: player.getTrack.bind(player),
    updateMetadataForTrack: player.updateMetadataForTrack.bind(player),
    skip: player.skip.bind(player),
    skipToNext: player.skipToNext.bind(player),
    skipToPrevious: player.skipToPrevious.bind(player),
    play: player.play.bind(player),
    pause: player.pause.bind(player),
    stop: player.stop.bind(player),
    reset: player.reset.bind(player),
    seekTo: player.seekTo.bind(player),
    getProgress: player.getProgress.bind(player),
    getPlaybackState: player.getPlaybackState.bind(player),
    getRate: player.getRate.bind(player),
    setRate: player.setRate.bind(player),
    setVolume: player.setVolume.bind(player),
    getVolume: player.getVolume.bind(player),
    addEventListener: player.addEventListener.bind(player),
};

export default RNTrackPlayer;
