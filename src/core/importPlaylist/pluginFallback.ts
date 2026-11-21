/**
 * 内置解析失败时的兜底：把链接交给已安装的「导入歌单」插件。
 *
 * 插件作者维护的接口通常比内置 HTTP 解析更抗平台变更；这里把插件返回的
 * 完整歌曲信息退化成「歌名 + 歌手」文本曲目，再走统一的歌源匹配流程，
 * 这样 UI 状态（转圈 / 可播 / 置灰重试）与内置解析完全一致。
 */
import PluginManager from "@/core/pluginManager";
import type {
    IImportTrack,
    IParseResult,
    ImportPlatform,
    ParseProgress,
} from "./types";
import strings from "./strings";

export async function parseByPlugins(
    raw: string,
    platform: ImportPlatform,
    onProgress: ParseProgress,
): Promise<IParseResult | null> {
    const plugins =
        PluginManager.getSortedPluginsWithAbility("importMusicSheet");
    if (!plugins.length) {
        return null;
    }

    onProgress(45, "尝试使用插件解析");
    const seen = new Set<string>();
    const tracks: IImportTrack[] = [];

    for (const plugin of plugins) {
        try {
            const items = await plugin.methods.importMusicSheet(raw);
            for (const item of items ?? []) {
                const title = (item?.title ?? "").trim();
                if (!title) {
                    continue;
                }
                const artist = (item?.artist ?? "").trim();
                const key = `${title}|${artist}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                tracks.push({ title, artist, album: item?.album });
            }
            if (tracks.length) {
                break;
            }
        } catch {
            // 单个插件失败不影响其它插件
        }
    }

    if (!tracks.length) {
        return null;
    }
    onProgress(100, strings.parseDone);
    return {
        platform: platform === "auto" ? "text" : platform,
        sheetTitle: strings.namePlaceholder,
        tracks,
    };
}
