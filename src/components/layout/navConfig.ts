/**
 * 导航项的唯一数据源。侧栏（Sidebar）、底部 Tab（BottomTab）都从这里取，
 * 不要在两个组件里各写一份，否则顺序一改就两边不一致。
 */
import { IIconName } from "@/components/base/icon";
import MusicSheet from "@/core/musicSheet";
import { ROUTE_PATH } from "@/core/router";
import type { RoutePaths } from "@/core/router/routes";
import type { ILanguageData } from "@/types/core/i18n";

export interface INavItem {
    key: string;
    /** i18n key */
    labelKey: keyof ILanguageData;
    /** 未选中（线框） */
    icon: IIconName;
    /** 选中（实心填充） */
    iconActive: IIconName;
    /** 0 = 发现分组；1 = 我的音乐分组（分割线下方） */
    group: 0 | 1;
    /** Compact 形态下是否进入底部 Tab */
    inTab: boolean;
    route: RoutePaths;
    getParams?: () => Record<string, any>;
}

export const NAV_ITEMS: INavItem[] = [
    {
        key: "home",
        labelKey: "nav.home",
        icon: "home-outline",
        iconActive: "home",
        group: 0,
        inTab: true,
        route: ROUTE_PATH.HOME,
    },
    {
        key: "recommend",
        labelKey: "nav.recommendSheets",
        // 原先是 arrow-path-rounded-square（循环箭头），语义上像「刷新」，
        // 和「推荐」不搭；换成竖大拇指更贴合「推荐」的意思
        icon: "hand-thumb-up",
        iconActive: "hand-thumb-up",
        group: 0,
        inTab: true,
        route: ROUTE_PATH.RECOMMEND_SHEETS,
    },
    {
        // 听歌排行紧跟在推荐歌单下方（同为「发现」类入口）
        key: "rank",
        labelKey: "nav.musicRank",
        icon: "chart-bar-outline",
        iconActive: "chart-bar",
        group: 0,
        inTab: false,
        route: ROUTE_PATH.TOP_LIST,
    },
    {
        key: "favorite",
        labelKey: "nav.favorite",
        icon: "heart-outline",
        iconActive: "heart",
        group: 1,
        inTab: true,
        route: ROUTE_PATH.LOCAL_SHEET_DETAIL,
        /** 「我喜欢」是内置默认歌单，id 固定为 favorite */
        getParams: () => ({ id: MusicSheet.defaultSheet.id }),
    },
    {
        key: "local",
        labelKey: "nav.localMusic",
        icon: "folder-outline",
        iconActive: "folder",
        group: 1,
        inTab: true,
        route: ROUTE_PATH.LOCAL,
    },
    {
        key: "recent",
        labelKey: "nav.recentPlay",
        icon: "clock-outline",
        iconActive: "clock",
        group: 1,
        inTab: false,
        route: ROUTE_PATH.HISTORY,
    },
];

/** 分割线上方 / 下方两组 */
export const NAV_GROUPS: INavItem[][] = [
    NAV_ITEMS.filter(it => it.group === 0),
    NAV_ITEMS.filter(it => it.group === 1),
];

/** Compact 形态的底部 Tab */
export const TAB_ITEMS = NAV_ITEMS.filter(it => it.inTab);
