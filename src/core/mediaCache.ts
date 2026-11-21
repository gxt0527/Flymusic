import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse } from "@/utils/jsonUtil";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import { exists, unlink } from "react-native-fs";

// Internal Method
const mediaCacheStore = getOrCreateMMKV("cache.MediaCache", true);

// 最多缓存800条数据
const maxCacheCount = 800;

/** 获取meta信息 */
const getMediaCache = (mediaItem: ICommon.IMediaBase) => {
    if (mediaItem.platform && mediaItem.id) {
        const cacheMediaItem = mediaCacheStore.getString(
            getMediaUniqueKey(mediaItem),
        );
        return cacheMediaItem
            ? safeParse<ICommon.IMediaBase>(cacheMediaItem)
            : null;
    }

    return null;
};

/** 设置meta信息 */
const setMediaCache = (mediaItem: ICommon.IMediaBase) => {
    if (mediaItem.platform && mediaItem.id) {
        const allKeys = mediaCacheStore.getAllKeys();
        if (allKeys.length >= maxCacheCount) {
            // TODO: 随机删一半
            for (let i = 0; i < maxCacheCount / 2; ++i) {
                const rawCacheMedia = mediaCacheStore.getString(allKeys[i]);
                const cacheData = rawCacheMedia
                    ? safeParse(rawCacheMedia)
                    : null;
                // 删记录前把关联的 .lrc 一起删掉，避免留下无主文件继续占着缓存统计
                clearLocalCaches(cacheData);

                mediaCacheStore.delete(allKeys[i]);
            }
        }

        mediaCacheStore.set(getMediaUniqueKey(mediaItem), JSON.stringify(mediaItem));
        return true;
    }

    return false;
};

/**
 * addFileScheme 原本从 fileUtils 引入；fileUtils 现在反过来要用 MediaCache，
 * 会形成循环依赖，这里保留等价实现。
 */
function addFileScheme(filePath: string) {
    return filePath.startsWith("/") ? `file://${filePath}` : filePath;
}

async function clearLocalCaches(cacheData: IMusic.IMusicItemCache | null) {
    if (!cacheData?.$localLyric) {
        return;
    }
    await Promise.all([
        checkPathAndRemove(cacheData.$localLyric.rawLrc),
        checkPathAndRemove(cacheData.$localLyric.translation),
    ]);
}

async function checkPathAndRemove(filePath?: string) {
    if (!filePath) {
        return;
    }
    try {
        const target = addFileScheme(filePath);
        if (await exists(target)) {
            await unlink(target);
        }
    } catch {
        // 文件已消失或被占用时，记录仍应正常淘汰
    }
}

/** 移除缓存信息：记录与它指向的本地歌词文件一起删，避免再次留下孤儿文件 */
const removeMediaCache = (mediaItem: ICommon.IMediaBase) => {
    if (mediaItem.platform && mediaItem.id) {
        clearLocalCaches(getMediaCache(mediaItem) as any);
        mediaCacheStore.delete(getMediaUniqueKey(mediaItem));
    }

    return false;
};

/**
 * 只清掉记录里的本地歌词指针，保留 source/quality 解析结果。
 * 「清除歌词缓存」删掉 .lrc 后必须同步调用，否则记录仍指向已删文件。
 */
const clearLyricCache = () => {
    for (const key of mediaCacheStore.getAllKeys()) {
        const raw = mediaCacheStore.getString(key);
        if (!raw) {
            continue;
        }
        const cacheData = safeParse<any>(raw);
        if (!cacheData?.$localLyric) {
            continue;
        }
        const next = { ...cacheData };
        delete next.$localLyric;
        mediaCacheStore.set(key, JSON.stringify(next));
    }
};

const MediaCache = {
    getMediaCache,
    setMediaCache,
    removeMediaCache,
    clearLyricCache,
};

export default MediaCache;
