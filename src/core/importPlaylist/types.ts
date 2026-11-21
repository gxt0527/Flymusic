/** 导入歌单：公共类型定义 */

/** 支持的歌单平台；auto = 从链接自动识别，text = 手动粘贴「歌名 - 歌手」列表 */
export type ImportPlatform = "auto" | "qq" | "netease" | "kugou" | "text";

/** 解析出来的一条曲目（只有文本信息，没有可播放音源） */
export interface IImportTrack {
    title: string;
    artist: string;
    album?: string;
    /** 原平台歌曲 id，便于排查，不参与匹配 */
    originId?: string;
}

/** 一次解析的结果 */
export interface IParseResult {
    platform: Exclude<ImportPlatform, "auto">;
    /** 平台上的原始歌单名，用作新建歌单的默认名称 */
    sheetTitle: string;
    tracks: IImportTrack[];
    /**
     * 平台声明的曲目总数（可能大于实际拿到的 tracks）。
     * 例如 QQ音乐未登录歌单只 SSR 渲染前 10 首，但 totalNum 是 280。
     */
    declaredTotal?: number;
    /** 需要展示给用户的说明（如「只拿到部分曲目」） */
    notice?: string;
}

/** 解析阶段进度回调：percent 0~100，label 为当前阶段文案 */
export type ParseProgress = (percent: number, label: string) => void;

/** 占位歌曲的状态 */
export type ImportItemStatus = "pending" | "matching" | "resolved" | "failed";

/** 写在 IMusicItem 上的自定义字段（IMusicItem 允许任意扩展字段） */
export const IMPORT_KEY_FIELD = "$importKey";
export const IMPORT_STATUS_FIELD = "$importStatus";
export const IMPORT_QUERY_FIELD = "$importQuery";
export const IMPORT_PLATFORM = "__import_playlist__";

/** 只在前 N 个歌源里补全 */
export const TOP_SOURCE_COUNT = 3;
/**
 * 同时匹配的曲目数。几百首的大歌单如果只有 3 并发会跑好几分钟，
 * 提到 5 是「不明显加大插件压力」和「用户不至于以为卡死」之间的折中。
 */
export const MATCH_CONCURRENCY = 5;

export interface IImportTask {
    sheetId: string;
    sheetTitle: string;
    platform: Exclude<ImportPlatform, "auto">;
    total: number;
    /** 已处理（成功或失败）的曲目数 */
    done: number;
    success: number;
    failed: number;
    phase: "matching" | "done";
    /** importKey -> 状态 */
    statuses: Record<string, ImportItemStatus>;
    /** 是否正在「更多歌源」补查 */
    searchingMore: boolean;
}
