/**
 * 媒体标签工具 - Web/桌面端实现
 *
 * 首期先返回空数据，保证本地音乐扫描链路不崩溃；
 * 后续接入 music-metadata 读取真实 ID3 信息。
 */
export interface IBasicMeta {
    album?: string;
    artist?: string;
    author?: string;
    duration?: string;
    title?: string;
}

export interface IWritableMeta extends IBasicMeta {
    lyric?: string;
    comment?: string;
}

const Mp3Util = {
    getBasicMeta: async (_fileName: string): Promise<IBasicMeta> => ({}),
    getMediaMeta: async (_fileNames: string[]): Promise<IBasicMeta[]> => [],
    getMediaCoverImg: async (_mediaPath: string): Promise<string> => "",
    getLyric: async (_mediaPath: string): Promise<string> => "",
    setMediaTag: async (
        _filePath: string,
        _meta: IWritableMeta,
    ): Promise<void> => {},
    getMediaTag: async (_filePath: string): Promise<IWritableMeta> => ({}),
};

export default Mp3Util;
