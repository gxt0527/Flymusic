/**
 * 导入歌单的「歌源补全」匹配器。
 *
 * 规则（与需求一致）：
 *   - 默认只在**用户排序后的前 3 个可搜索歌源**里搜索；
 *   - 「在更多源中查找」才使用第 4 个及之后的歌源；
 *   - 用歌名 + 歌手做相似度打分，取最佳命中，避免把同名不同人的歌补错。
 */
import PluginManager from "@/core/pluginManager";
import minDistance from "@/utils/minDistance";
import { IImportTrack, TOP_SOURCE_COUNT } from "./types";

type SearchPlugin = ReturnType<
    typeof PluginManager.getSortedSearchablePlugins
>[number];

/** 用户拖拽排序后的前 3 个可搜索歌源 */
export function getTopSources(): SearchPlugin[] {
    return PluginManager.getSortedSearchablePlugins("music").slice(
        0,
        TOP_SOURCE_COUNT,
    );
}

/** 第 4 个及之后的全部可搜索歌源 */
export function getMoreSources(): SearchPlugin[] {
    return PluginManager.getSortedSearchablePlugins("music").slice(
        TOP_SOURCE_COUNT,
    );
}

/** 归一化：小写、去空白、去括号后缀（Live / DJ版 / feat.…）、去常见标点 */
function normalize(input?: string): string {
    if (!input) {
        return "";
    }
    return input
        .toLowerCase()
        .replace(/[（(【\[][^)）】\]]*[)）】\]]/g, "")
        .replace(/[\s·・'’"“”\-—_.,，、!！?？:：;；/\\|]/g, "")
        .trim();
}

/** 搜索关键词：去掉括号后缀，保留主标题，太短时补上歌手 */
function buildKeywords(query: IImportTrack): string[] {
    const mainTitle = (query.title || "")
        .replace(/[（(【\[][^)）】\]]*[)）】\]]/g, "")
        .trim();
    const artist = (query.artist || "").trim();
    const keywords = [mainTitle || query.title];
    if (artist && mainTitle) {
        keywords.push(`${mainTitle} ${artist}`);
    }
    return keywords.filter(Boolean);
}

/** 同一次导入里，相同的「歌源 + 关键词」只请求一次 */
const searchCache = new Map<string, IMusic.IMusicItem[]>();

export function clearSearchCache() {
    searchCache.clear();
}

async function searchPlugin(
    plugin: SearchPlugin,
    keyword: string,
): Promise<IMusic.IMusicItem[]> {
    const cacheKey = `${plugin.hash}|${keyword}`;
    const cached = searchCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    let items: IMusic.IMusicItem[] = [];
    try {
        const result = await plugin.methods.search(keyword, 1, "music");
        items = ((result?.data ?? []) as unknown as IMusic.IMusicItem[]).slice(
            0,
            10,
        );
    } catch {
        items = [];
    }
    searchCache.set(cacheKey, items);
    return items;
}

/** 计算候选与目标的匹配分，返回 null 表示明显不是同一首歌 */
function scoreCandidate(
    candidate: IMusic.IMusicItem,
    query: IImportTrack,
): number | null {
    const targetTitle = normalize(query.title);
    const candidateTitle = normalize(candidate.title);
    if (!targetTitle || !candidateTitle) {
        return null;
    }

    const titleDistance = minDistance(candidateTitle, targetTitle);
    const titleTolerance = Math.max(2, Math.ceil(targetTitle.length * 0.34));
    const titleMatched =
        candidateTitle === targetTitle ||
        candidateTitle.includes(targetTitle) ||
        targetTitle.includes(candidateTitle) ||
        titleDistance <= titleTolerance;
    if (!titleMatched) {
        return null;
    }

    const targetArtist = normalize(query.artist);
    const candidateArtist = normalize(candidate.artist);
    let artistScore = 0;
    if (targetArtist && candidateArtist) {
        if (
            candidateArtist.includes(targetArtist) ||
            targetArtist.includes(candidateArtist)
        ) {
            artistScore = 0;
        } else {
            const artistDistance = minDistance(candidateArtist, targetArtist);
            const artistTolerance = Math.max(
                2,
                Math.ceil(targetArtist.length * 0.5),
            );
            if (artistDistance > artistTolerance) {
                return null;
            }
            artistScore = artistDistance;
        }
    } else if (targetArtist && !candidateArtist) {
        // 不知道歌手，轻微惩罚但不至于排除
        artistScore = 2;
    }

    return titleDistance * 2 + artistScore * 3;
}

/**
 * 在给定歌源里为一首曲目找最佳匹配。
 * 完全命中（歌名+歌手都对上）会提前结束，减少请求数。
 */
export async function findBestMatch(
    query: IImportTrack,
    plugins: SearchPlugin[],
): Promise<IMusic.IMusicItem | null> {
    if (!plugins.length || !query.title) {
        return null;
    }

    const keywords = buildKeywords(query);
    let best: IMusic.IMusicItem | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const keyword of keywords) {
        const results = await Promise.all(
            plugins.map(plugin => searchPlugin(plugin, keyword)),
        );

        for (const items of results) {
            for (const item of items) {
                const score = scoreCandidate(item, query);
                if (score === null) {
                    continue;
                }
                if (score < bestScore) {
                    bestScore = score;
                    best = item;
                }
            }
        }

        // 基本确定命中就收手；否则再用「歌名 + 歌手」搜一轮，避免同名不同人的歌
        if (bestScore <= 2) {
            break;
        }
    }

    return best;
}
