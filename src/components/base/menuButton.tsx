/**
 * 三点菜单：按钮 + 弹出菜单（Portal 渲染到窗口层）
 *
 * 原来这套逻辑长在 AppBar 里，菜单本体还是移动端 ListItem 拼的（rpx 尺寸 +
 * 一个指向按钮的小三角），在桌面窗口里既不跟手也不像系统菜单。
 * 现在菜单本体统一走 contextMenu（Win11 规格），这里只负责：
 * 量按钮窗口坐标 → 交给菜单做锚点定位。
 */
import React, { useRef, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import Icon, { IIconName } from "./icon";
import Portal from "./portal";
import ContextMenu from "@/components/panels/contextMenu";
import type { IPanelAnchor } from "@/components/panels/anchor";

export interface IMenuOption {
    icon: IIconName;
    title: string;
    show?: boolean;
    /** 点完不收起 */
    keepOpen?: boolean;
    onPress?: () => void;
}

interface IMenuButtonProps {
    menu: IMenuOption[];
    /** 图标颜色，不给则用普通文字色 */
    color?: string;
    /** 图标尺寸，操作行里 34px 高，给 20 刚好 */
    iconSize?: number;
    style?: StyleProp<ViewStyle>;
}

export default function MenuButton(props: IMenuButtonProps) {
    const { menu, color, iconSize = 22, style } = props;

    const btnRef = useRef<View>(null);
    /** 菜单渲染在 Portal（窗口坐标系）里，onLayout 给的是相对容器坐标，
     *  打开时对按钮 measureInWindow，一步拿到窗口坐标 */
    const [anchor, setAnchor] = useState<IPanelAnchor | null>(null);

    if (!menu?.length) {
        return null;
    }

    const open = () => {
        const node = btnRef.current;
        if (node && typeof node.measureInWindow === "function") {
            node.measureInWindow((x: number, y: number, w: number, h: number) => {
                setAnchor({ x, y, width: w, height: h });
            });
        } else {
            setAnchor({ x: 0, y: 0, width: 0, height: 0 });
        }
    };

    return (
        <>
            <View ref={btnRef} style={style}>
                <Icon
                    name="ellipsis-vertical"
                    size={iconSize}
                    color={color}
                    accessible
                    accessibilityLabel="更多"
                    onPress={open}
                />
            </View>
            {anchor ? (
                <Portal>
                    <ContextMenu
                        anchor={anchor}
                        width={232}
                        items={menu
                            .filter(item => item.show !== false)
                            .map(item => ({
                                key: item.title,
                                label: item.title,
                                icon: item.icon,
                                keepOpen: item.keepOpen,
                                onPress: item.onPress,
                            }))}
                        onClose={() => setAnchor(null)}
                    />
                </Portal>
            ) : null}
        </>
    );
}
