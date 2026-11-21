/**
 * 设计令牌 —— 数值全部来自 UI 设计稿的逐像素测量。
 *
 * 单位约定：这里所有数字都是 **dp**（RN 的默认单位），不再套 rpx。
 * 圆角、字号、行高属于「视觉恒定值」，如果跟着屏幕线性缩放，
 * 在折叠屏展开/平板上会明显偏大，所以用绝对值。
 * 只有「跟内容区宽度等比」的尺寸（卡片列宽、Banner 高度）才在组件里用 rpx 算。
 */

/** 间距刻度：4 的倍数为主，6/10 用于图标与文字的视觉间距 */
export const space = {
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    xxxl: 28,
    huge: 32,
} as const;

export const radius = {
    /** 列表缩略图、卡片封面 */
    cover: 8,
    /** 歌单卡、Banner */
    card: 12,
    /** 侧栏选中项 */
    item: 10,
    /** 侧栏面板、播放页容器 */
    panel: 16,
    /** 歌手 chip */
    chip: 8,
    /** 搜索框、按钮 */
    pill: 999,
} as const;

export type FontWeight = "400" | "500" | "600" | "700";

interface IFontToken {
    size: number;
    lineHeight: number;
    weight: FontWeight;
}

/** 只用 400 / 500 两档字重，与设计稿一致 */
export const font = {
    /** 页面标题：我的收藏 */
    h1: { size: 22, lineHeight: 30, weight: "500" },
    /** 区块标题：每日推荐 / 推荐歌单 */
    h2: { size: 17, lineHeight: 24, weight: "500" },
    /** 卡片标题、列表标题 */
    title: { size: 15, lineHeight: 21, weight: "500" },
    /** 列表标题（紧凑） */
    titleSm: { size: 13, lineHeight: 19, weight: "500" },
    /** 正文 */
    body: { size: 13, lineHeight: 19, weight: "400" },
    /** 副标题、歌手、播放量 */
    caption: { size: 11.5, lineHeight: 16, weight: "400" },
    /** 角标、Tab 小字 */
    badge: { size: 10, lineHeight: 13, weight: "400" },
    /** 播放页歌名 */
    player: { size: 24, lineHeight: 32, weight: "500" },
    /** 歌词 */
    lyric: { size: 15, lineHeight: 26, weight: "400" },
    /** 导航项 */
    nav: { size: 13.5, lineHeight: 19, weight: "400" },
} as const satisfies Record<string, IFontToken>;

/** 组件固定尺寸 */
export const size = {
    /** 侧栏常驻宽度（原 200，按观感收窄 15%） */
    sidebar: 170,
    /** 侧栏收起为图标栏 */
    rail: 76,
    topBar: 58,
    /** 侧栏导航项高度（原 42，选中胶囊偏高，收到 36） */
    navItem: 36,
    navItemRadius: 9,
    tabBar: 58,
    playBar: 64,
    playBarExpanded: 72,
    searchBar: 36,
    icon: 19,
    iconLg: 20,
    iconSm: 15,
    /** 列表缩略图 */
    coverRow: 44,
    /** 列表行高 */
    rowList: 64,
    avatar: 28,
    /** 播放页控制键 */
    playButton: 54,
    playButtonExpanded: 56,
} as const;

/** 断点：决定导航形态（Compact 底部 Tab / Medium 图标栏 / Expanded 侧栏） */
export const breakpoint = {
    compact: 600,
    expanded: 840,
} as const;

/** 动效时长（ms） */
export const motion = {
    tap: 100,
    fast: 120,
    base: 180,
    nav: 220,
    glow: 300,
} as const;

/** 玻璃层参数（颜色在 palette 里，随明暗主题变） */
export const glass = {
    /** 背景高斯模糊半径 */
    blur: 16,
    /** 饱和度增益，让透出的内容更"实" */
    saturate: 1.8,
    /** 高光描边宽度 */
    borderWidth: 1,
    /** 光晕溢出容器边界的距离 */
    glowOverflow: 6,
    /** 光晕模糊半径 */
    glowBlur: 14,
} as const;

export const tokens = {
    space,
    radius,
    font,
    size,
    breakpoint,
    motion,
    glass,
} as const;
