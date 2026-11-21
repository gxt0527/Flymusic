/**
 * 桌面端「设置可选项」的就地向下菜单。
 *
 * 以前 createRadio 一律 showDialog("RadioDialog")，弹出一个居中的整屏模态框；
 * Windows 端更习惯「点这一行 → 在行下方展开一个小菜单 → 选完即关」。
 *
 * 菜单本体统一走 contextMenu（和右键菜单、⋮ 菜单同一套外观与定位），
 * 这里只负责把行本身量出窗口坐标当锚点：菜单挂在 Portal 上，
 * 避免被 SectionList 的滚动容器裁切。
 */
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import Icon from "@/components/base/icon";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import Portal from "@/components/base/portal";
import ContextMenu from "@/components/panels/contextMenu";
import { useTokens } from "@/theme";
import measureNodeRect, { INodeRect } from "@/utils/measureNode";

export interface IInlineSelectOption {
    label: string;
    value: string | number;
}

export interface IInlineSelectData {
    valueLabel: string;
    value: string | number;
    options: IInlineSelectOption[];
    onSelect: (value: string | number) => void;
}

interface IInlineSelectRowProps extends IInlineSelectData {
    title: string;
    testID?: string;
}

export default function InlineSelectRow(props: IInlineSelectRowProps) {
    const { title, valueLabel, value, options, onSelect, testID } = props;
    const t = useTokens();
    const rowRef = useRef<any>(null);
    const [anchor, setAnchor] = useState<INodeRect | null>(null);
    const open = anchor !== null;

    const toggle = () => {
        if (open) {
            setAnchor(null);
            return;
        }
        const next = measureNodeRect(rowRef.current);
        // 原生端量不到 DOM 矩形时，调用方会回退到原来的 RadioDialog
        setAnchor(next ?? null);
    };

    return (
        <View
            ref={rowRef}
            testID={testID ?? "inline-select-row"}
            style={styles.rowWrap}>
            <ListItem withHorizontalPadding heightType="small" onPress={toggle}>
                <ListItem.Content title={title} />
                <View style={styles.valueRow}>
                    <ThemeText numberOfLines={1} style={styles.valueText}>
                        {valueLabel}
                    </ThemeText>
                    <Icon
                        name={open ? "chevron-down" : "chevron-right"}
                        size={14}
                        color={t.color.text.tertiary}
                    />
                </View>
            </ListItem>

            {anchor ? (
                <Portal>
                    <ContextMenu
                        testID="inline-select-menu"
                        anchor={anchor}
                        width={248}
                        items={options.map(option => ({
                            key: `inline-select-${option.value}`,
                            label: option.label,
                            checked: option.value === value,
                            onPress: () => onSelect(option.value),
                        }))}
                        onClose={() => setAnchor(null)}
                    />
                </Portal>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    rowWrap: {
        width: "100%",
    },
    valueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 1,
        maxWidth: "60%",
    },
    valueText: {
        textAlign: "right",
        flexShrink: 1,
    },
});
