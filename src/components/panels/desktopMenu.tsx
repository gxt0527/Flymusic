/**
 * 桌面端「选择菜单」（音质 / 倍速 / 字号 / 歌词进度）
 *
 * 移动端这些是「从底部滑出的整屏面板」（PanelBase），宽屏上会变成贴右边的
 * 整高抽屉 + 大片空白，非常「Android」。桌面端统一成 Win11 菜单：
 * 贴着触发按钮展开，勾选项行首打勾，点空白/Esc/滚轮收起。
 *
 * 真正的外观与定位都在 contextMenu，这里只把「标题 + 同构选项」的载荷
 * 翻译成菜单项，保证和右键菜单、⋮ 菜单是同一张脸。
 */
import React, { memo } from "react";

import ContextMenu, { IContextMenuItem } from "./contextMenu";
import type { IPanelAnchor } from "./anchor";
import { panelInfoStore } from "./usePanel";

export interface IDesktopMenuItem {
    key: string;
    label: string;
    /** 右侧补充信息，如音质文件大小 */
    hint?: string;
    checked?: boolean;
    /** 在本项之前画一条分组细线 */
    divider?: boolean;
    /** 点完不收起（字号这种要边调边看效果的） */
    keepOpen?: boolean;
    onPress: () => void;
}

interface IDesktopMenuProps {
    title?: string;
    items: IDesktopMenuItem[];
    /** 触发按钮的窗口坐标，缺省时贴着指针展开 */
    anchor?: IPanelAnchor;
    /** 强制深色（播放页这类常驻深色画面） */
    dark?: boolean;
}

/** 直接清空面板状态，不走 PanelBase 的滑出动画（菜单本身没有动画） */
export function closeDesktopMenu() {
    panelInfoStore.setValue({ name: null, payload: null });
}

function DesktopMenu(props: IDesktopMenuProps) {
    const { title, items, anchor, dark } = props;

    return (
        <ContextMenu
            anchor={anchor}
            dark={dark}
            title={title}
            width={232}
            items={items.map<IContextMenuItem>(item => ({
                key: item.key,
                label: item.label,
                hint: item.hint,
                checked: item.checked,
                divider: item.divider,
                keepOpen: item.keepOpen,
                onPress: item.onPress,
            }))}
            onClose={closeDesktopMenu}
        />
    );
}

export default memo(DesktopMenu);
