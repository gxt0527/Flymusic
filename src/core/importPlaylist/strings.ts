/**
 * 导入歌单功能文案。
 * 该功能独立成模块，文案集中在这里，后续接多语言时只需替换本文件。
 */
const strings = {
    title: "导入歌单",
    subtitle: "粘贴歌单链接，自动识别平台并解析曲目",
    auto: "自动识别",
    qq: "QQ音乐",
    netease: "网易云音乐",
    kugou: "酷狗音乐",
    text: "文本列表",
    inputPlaceholder:
        "粘贴歌单链接，或直接粘贴歌曲列表（每行：歌名 - 歌手）",
    pasteClipboard: "从剪贴板粘贴",
    start: "开始解析",
    cancel: "取消",
    pluginEntry: "使用插件导入歌单",
    pluginEntryHint: "已有插件导入能力仍保留在这里",
    pluginHint:
        "支持 QQ音乐 / 网易云音乐 / 酷狗音乐的歌单链接，也支持直接粘贴「歌名 - 歌手」文本列表",
    detected: (name: string) => `已识别：${name}`,
    parsing: "正在解析歌单",
    parseStepDetect: "识别歌单平台",
    parseStepResolve: "解析歌单链接",
    parseStepFetch: "拉取歌单曲目",
    parseStepClean: "整理曲目信息",
    parseDone: "解析完成",
    parseEmpty: "没有解析到歌曲，请检查链接是否有效",
    parseFail: "解析失败，请检查链接或网络；也可以直接粘贴「歌名 - 歌手」列表",
    parseTooFew:
        "没有读到歌单里的歌曲（平台接口可能被拦截）。请改用下方的「使用插件导入歌单」，或把歌曲列表按每行「歌名 - 歌手」粘贴进来",
    parseCanceled: "已取消解析",
    switchToText: "改用文本列表",
    textModeHint: "已切换到「文本列表」：每行粘贴「歌名 - 歌手」即可导入",
    nameDialogTitle: "编辑歌单名称",
    nameLabel: "歌单名称",
    nameDialogHint: (count: number) =>
        count > 60
            ? `识别到 ${count} 首歌曲，保存后开始匹配歌源（曲目较多，后台匹配需要几分钟，可以先去用别的页面）`
            : `识别到 ${count} 首歌曲，保存后开始匹配歌源`,
    namePlaceholder: "导入歌单",
    save: "保存并匹配",
    /** QQ 音乐未登录歌单（如「我喜欢的音乐」）只公开前 10 首时的提示 */
    qqPartial: (got: number, total: number) =>
        `该歌单共 ${total} 首，QQ音乐未登录时只公开前 ${got} 首。已尝试用插件补全；若仍不完整，可改用「使用插件导入歌单」或粘贴「歌名 - 歌手」文本列表。`,
    pluginSupplement: "正在用插件补全剩余曲目",
    matchTitle: "匹配歌源",
    matching: (done: number, total: number) =>
        `正在匹配歌源 ${done}/${total}（仅前 3 个歌源${
            total > 60 ? "，曲目较多请耐心等待" : ""
        }）`,
    matchDone: (success: number, failed: number) =>
        `匹配完成：成功 ${success} 首，未找到 ${failed} 首`,
    matchingMore: "正在更多歌源中查找…",
    topSources: "只在前 3 个歌源中搜索补全",
    openSheet: "打开歌单",
    finish: "完成",
    retryAll: "未找到的全部去更多源查找",
    noSearchablePlugin: "当前没有可用的搜索歌源插件，请先安装并启用插件",
    noMatchSources: "没有更多可用歌源了",
    // 列表行
    statusPending: "等待匹配",
    statusMatching: "匹配中…",
    statusFailed: "未找到音源",
    retry: "重试",
    searchMore: "在更多源中查找",
    searchMoreShort: "更多源",
    resolvedTag: "已匹配",
};

export default strings;
