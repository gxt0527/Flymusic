/**
 * 导入歌单的编排层：
 *   解析结果 -> 新建歌单 -> 写入占位曲目 -> 在前 3 个歌源里逐首补全
 *
 * 状态放在模块级单例里，关掉面板/切到歌单详情页也不会中断匹配；
 * 面板通过 useImportTask() 订阅进度，歌曲行通过 IMusicItem 上的
 * $importKey / $importStatus 自己渲染状态，因此重启 App 后失败项仍是灰色。
 */
import { SortType } from "@/constants/commonConst";
import MusicSheet from "@/core/musicSheet";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { nanoid } from "nanoid";

import {
    clearSearchCache,
    findBestMatch,
    getMoreSources,
    getTopSources,
} from "./matcher";
import strings from "./strings";
import {
    IImportTask,
    IImportTrack,
    IParseResult,
    ImportItemStatus,
    IMPORT_KEY_FIELD,
    IMPORT_PLATFORM,
    IMPORT_QUERY_FIELD,
    IMPORT_STATUS_FIELD,
    MATCH_CONCURRENCY,
} from "./types";
import Toast from "@/utils/toast";

const taskAtom = atom<IImportTask | null>(null);

class ImportPlaylistService {
    private task: IImportTask | null = null;
    /** 正在匹配的 importKey，防止「重试」被连点重复发起 */
    private running = new Set<string>();

    useTask() {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- 类单例上暴露的订阅入口，调用方按 hook 约定命名
        return useAtomValue(taskAtom);
    }

    getTask() {
        return this.task;
    }

    private patch(partial: Partial<IImportTask>) {
        if (!this.task) {
            return;
        }
        this.task = { ...this.task, ...partial };
        getDefaultStore().set(taskAtom, this.task);
    }

    private setStatus(sheetId: string, key: string, status: ImportItemStatus) {
        if (!this.task || this.task.sheetId !== sheetId) {
            return;
        }
        const statuses = { ...this.task.statuses, [key]: status };
        const values = Object.values(statuses);
        const done = values.filter(
            s => s === "resolved" || s === "failed",
        ).length;
        this.patch({
            statuses,
            done,
            success: values.filter(s => s === "resolved").length,
            failed: values.filter(s => s === "failed").length,
            phase: done === this.task.total ? "done" : "matching",
        });
    }

    /** 解析完成后调用：建歌单 -> 写占位 -> 后台开始匹配 */
    async createAndMatch(
        result: IParseResult,
        sheetTitle: string,
    ): Promise<string> {
        clearSearchCache();
        const sheetId = await MusicSheet.addSheet(
            sheetTitle.trim() || result.sheetTitle || strings.namePlaceholder,
        );
        // 导入顺序即歌单顺序，别让默认排序规则（最新/标题…）把它打乱
        await MusicSheet.setSortType(sheetId, SortType.None);

        const keys: string[] = [];
        const placeholders: IMusic.IMusicItem[] = result.tracks.map(track => {
            const importKey = `imp-${nanoid()}`;
            keys.push(importKey);
            return {
                id: importKey,
                platform: IMPORT_PLATFORM,
                title: track.title,
                artist: track.artist || "",
                album: track.album || "",
                artwork: "",
                duration: 0,
                [IMPORT_KEY_FIELD]: importKey,
                [IMPORT_STATUS_FIELD]: "pending",
                [IMPORT_QUERY_FIELD]: {
                    title: track.title,
                    artist: track.artist || "",
                },
            } as unknown as IMusic.IMusicItem;
        });

        const statuses: Record<string, ImportItemStatus> = {};
        keys.forEach(key => (statuses[key] = "pending"));

        this.task = {
            sheetId,
            sheetTitle: sheetTitle.trim() || result.sheetTitle,
            platform: result.platform,
            total: keys.length,
            done: 0,
            success: 0,
            failed: 0,
            phase: "matching",
            statuses,
            searchingMore: false,
        };
        getDefaultStore().set(taskAtom, this.task);

        if (placeholders.length) {
            await MusicSheet.addMusic(sheetId, placeholders);
        }

        const sources = getTopSources();
        if (!sources.length) {
            Toast.warn(strings.noSearchablePlugin);
            await MusicSheet.markAllImportItemsFailed(sheetId);
            this.patch({
                statuses: Object.fromEntries(
                    keys.map(key => [key, "failed" as ImportItemStatus]),
                ),
                done: keys.length,
                success: 0,
                failed: keys.length,
                phase: "done",
            });
            return sheetId;
        }

        void this.runQueue(sheetId, keys, sources, false);
        return sheetId;
    }

    /** 并发池：一次最多 MATCH_CONCURRENCY 首，避免几十个请求同时打出去 */
    private async runQueue(
        sheetId: string,
        keys: string[],
        sources: ReturnType<typeof getTopSources>,
        more: boolean,
    ) {
        let cursor = 0;
        const worker = async () => {
            while (cursor < keys.length) {
                const key = keys[cursor++];
                await this.processOne(sheetId, key, sources, more);
            }
        };
        await Promise.all(
            Array.from(
                { length: Math.min(MATCH_CONCURRENCY, Math.max(1, keys.length)) },
                () => worker(),
            ),
        );
    }

    private findPlaceholder(sheetId: string, importKey: string) {
        const list = MusicSheet.getSortedMusicListBySheetId(sheetId).musicList;
        const item = list.find(it => it[IMPORT_KEY_FIELD] === importKey);
        if (!item) {
            return null;
        }
        const query =
            (item[IMPORT_QUERY_FIELD] as IImportTrack | undefined) ??
            ({ title: item.title, artist: item.artist } as IImportTrack);
        return query;
    }

    private async processOne(
        sheetId: string,
        importKey: string,
        sources: ReturnType<typeof getTopSources>,
        more: boolean,
    ) {
        if (this.running.has(importKey)) {
            return;
        }
        const query = this.findPlaceholder(sheetId, importKey);
        if (!query) {
            return;
        }

        this.running.add(importKey);
        if (more) {
            this.patch({ searchingMore: true });
        }
        this.setStatus(sheetId, importKey, "matching");
        await MusicSheet.updateImportItem(sheetId, importKey, {
            [IMPORT_STATUS_FIELD]: "matching",
        });

        let found: IMusic.IMusicItem | null = null;
        try {
            found = await findBestMatch(query, sources);
        } catch {
            found = null;
        }

        if (found) {
            // 替换成真实歌曲：去掉占位字段，保留歌单里的排序元数据
            await MusicSheet.updateImportItem(sheetId, importKey, found, true);
            this.setStatus(sheetId, importKey, "resolved");
        } else {
            await MusicSheet.updateImportItem(sheetId, importKey, {
                [IMPORT_STATUS_FIELD]: "failed",
            });
            this.setStatus(sheetId, importKey, "failed");
        }

        this.running.delete(importKey);
        if (more) {
            this.patch({ searchingMore: false });
        }
    }

    /** 行尾「重试」：重新在前 3 个歌源里找（清缓存，确保真的重新请求） */
    async retry(sheetId: string, importKey: string) {
        const sources = getTopSources();
        if (!sources.length) {
            Toast.warn(strings.noSearchablePlugin);
            return;
        }
        clearSearchCache();
        await this.processOne(sheetId, importKey, sources, false);
    }

    /** 行尾「在更多源中查找」：改用第 4 个及之后的全部歌源 */
    async searchMore(sheetId: string, importKey: string) {
        const sources = getMoreSources();
        if (!sources.length) {
            Toast.warn(strings.noMatchSources);
            return;
        }
        clearSearchCache();
        await this.processOne(sheetId, importKey, sources, true);
    }

    /** 顶部批量按钮：把所有未找到的曲目都丢到更多歌源里再找一遍 */
    async searchMoreAll(sheetId?: string) {
        const targetSheetId = sheetId ?? this.task?.sheetId;
        if (!targetSheetId) {
            return;
        }
        const sources = getMoreSources();
        if (!sources.length) {
            Toast.warn(strings.noMatchSources);
            return;
        }
        const list = MusicSheet.getSortedMusicListBySheetId(targetSheetId).musicList;
        const keys = list
            .filter(
                it =>
                    it[IMPORT_KEY_FIELD] &&
                    it[IMPORT_STATUS_FIELD] === "failed",
            )
            .map(it => it[IMPORT_KEY_FIELD] as string);
        if (!keys.length) {
            return;
        }
        clearSearchCache();
        this.patch({ searchingMore: true });
        await this.runQueue(targetSheetId, keys, sources, true);
        this.patch({ searchingMore: false });
    }
}

const ImportPlaylist = new ImportPlaylistService();
export default ImportPlaylist;
export { taskAtom as importTaskAtom };
