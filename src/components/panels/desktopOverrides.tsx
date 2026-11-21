/**
 * 桌面端面板覆盖实现
 *
 * 分两类：纯选择型改成挂在触发按钮上的 Win11 菜单；选择/输入型改成
 * 居中的 Windows 对话框（共用 desktopDialog 的骨架）。内容型大面板
 * （播放列表、取色器、定时关闭…）仍走 PanelBase。
 */
import React, { useState } from "react";

import { useI18N } from "@/core/i18n";
import lyricManager from "@/core/lyricManager";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import { qualityKeys, qualityText } from "@/utils/qualities";
import { sizeFormatter } from "@/utils/fileUtils";

import DesktopMenu, { closeDesktopMenu } from "./desktopMenu";
import ContextMenu from "./contextMenu";
import type { IPanelAnchor } from "./anchor";
import useMusicItemOptions from "./musicItemOptionsData";
import AddToMusicSheetDesktop from "./desktopAddToMusicSheet";
import SimpleInputDesktop from "./desktopSimpleInput";
import SheetTagsDesktop from "./desktopSheetTags";

// ---------------------------------------------------------------- 歌曲更多

interface IMusicItemOptionsProps {
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
    from?: string;
    /** 展开位置：右键时是鼠标坐标，⋮ 是按钮矩形 */
    anchor?: IPanelAnchor;
}

/**
 * 桌面端用 Win11 原生形态的上下文菜单，而不是把移动端抽屉搬过来：
 * 抽屉那套「封面 + 歌名 + 96rpx 大行」在宽屏上既占地方又不像系统菜单。
 */
export function MusicItemOptionsDesktop(props: IMusicItemOptionsProps) {
    const { musicItem, musicSheet, from, anchor } = props ?? {};
    const options = useMusicItemOptions({ musicItem, musicSheet, from });

    return (
        <ContextMenu
            anchor={anchor}
            items={options.map(option => ({
                key: option.key,
                label: option.title,
                icon: option.icon,
                show: option.show,
                divider: option.divider,
                disabled: option.disabled,
                onPress: option.onPress,
            }))}
            onClose={closeDesktopMenu}
        />
    );
}

// ---------------------------------------------------------------- 歌词字号

interface ISetFontSizeProps {
    defaultSelect?: number;
    onSelectChange: (value: number) => void;
    anchor?: IPanelAnchor;
    /** 播放页这类常驻深色画面上强制深色 */
    dark?: boolean;
}

export function SetFontSizeDesktop(props: ISetFontSizeProps) {
    const { defaultSelect, onSelectChange, anchor, dark } = props ?? {};
    const { t } = useI18N();
    const [selected, setSelected] = useState(defaultSelect ?? 1);

    const labels = [
        t("panel.setFontSize.small"),
        t("panel.setFontSize.standard"),
        t("panel.setFontSize.large"),
        t("panel.setFontSize.extraLarge"),
    ];

    return (
        <DesktopMenu
            anchor={anchor}
            dark={dark}
            title={t("panel.setFontSize.title")}
            items={labels.map((label, index) => ({
                key: String(index),
                label,
                checked: index === selected,
                /** 字号要边调边看效果，所以点完不关菜单 */
                keepOpen: true,
                onPress: () => {
                    setSelected(index);
                    onSelectChange?.(index);
                },
            }))}
        />
    );
}

// ---------------------------------------------------------------- 音质

interface IMusicQualityProps {
    type?: "play" | "download";
    musicItem: IMusic.IMusicItem;
    anchor?: IPanelAnchor;
    onQualityPress: (
        quality: IMusic.IQualityKey,
        musicItem: IMusic.IMusicItem,
    ) => void;
}

export function MusicQualityDesktop(props: IMusicQualityProps) {
    const { t } = useI18N();
    const { musicItem, onQualityPress, type = "play", anchor } = props ?? {};

    return (
        <DesktopMenu
            anchor={anchor}
            title={t("panel.musicQuality.title", {
                type:
                    type === "play" ? t("common.play") : t("common.download"),
            })}
            items={qualityKeys.map(key => ({
                key,
                label: qualityText[key],
                hint: musicItem?.qualities?.[key]?.size
                    ? sizeFormatter(musicItem.qualities[key].size!)
                    : undefined,
                onPress: () => {
                    onQualityPress?.(key, musicItem);
                    closeDesktopMenu();
                },
            }))}
        />
    );
}

// ---------------------------------------------------------------- 倍速

interface IPlayRateProps {
    onRatePress: (rate: number) => void;
    /** 当前倍速（×100），用于打勾 */
    currentRate?: number;
    anchor?: IPanelAnchor;
}

const RATES = [50, 75, 100, 125, 150, 175, 200];

export function PlayRateDesktop(props: IPlayRateProps) {
    const { onRatePress, currentRate = 100, anchor } = props ?? {};
    const { t } = useI18N();

    return (
        <DesktopMenu
            anchor={anchor}
            title={t("panel.playRate.title")}
            items={RATES.map(rate => ({
                key: String(rate),
                label: `${rate / 100}x`,
                checked: rate === currentRate,
                onPress: () => {
                    onRatePress?.(rate);
                    closeDesktopMenu();
                },
            }))}
        />
    );
}

// ---------------------------------------------------------------- 歌词进度偏移

interface ISetLyricOffsetProps {
    musicItem: IMusic.IMusicItem;
    onSubmit?: (offset: number) => void;
    anchor?: IPanelAnchor;
    dark?: boolean;
}

export function SetLyricOffsetDesktop(props: ISetLyricOffsetProps) {
    const { musicItem, anchor, dark } = props ?? {};

    const [offset, setOffset] = useState<number>(
        getMediaExtraProperty(musicItem, "lyricOffset") ?? 0,
    );

    const apply = (next: number) => {
        const safe = Math.round(next * 10) / 10;
        setOffset(safe);
        lyricManager.updateLyricOffset(musicItem, safe);
    };

    const status =
        offset === 0
            ? "正常"
            : offset < 0
                ? `延后 ${Math.abs(offset).toFixed(1)}s`
                : `提前 ${offset.toFixed(1)}s`;

    return (
        <DesktopMenu
            anchor={anchor}
            dark={dark}
            /** 当前偏移直接写在组标题里，省掉菜单底部那条多余的状态栏 */
            title={`歌词进度 · ${status}`}
            items={[
                {
                    key: "delay",
                    label: "延后 0.2s",
                    keepOpen: true,
                    onPress: () => apply(offset - 0.2),
                },
                {
                    key: "advance",
                    label: "提前 0.2s",
                    keepOpen: true,
                    onPress: () => apply(offset + 0.2),
                },
                {
                    key: "reset",
                    label: "重置",
                    divider: true,
                    keepOpen: true,
                    onPress: () => apply(0),
                },
            ]}
        />
    );
}

// ---------------------------------------------------------------- 通用选择

interface ISimpleSelectProps {
    header?: string;
    candidates?: Array<{ title?: string; value: any }>;
    anchor?: IPanelAnchor;
    onPress?: (item: { title?: string; value: any }) => void;
}

/** 「装插件」这类只有几项的选择：桌面上就是一张小菜单，不是整屏抽屉 */
export function SimpleSelectDesktop(props: ISimpleSelectProps) {
    const { header, candidates = [], onPress, anchor } = props ?? {};

    return (
        <ContextMenu
            anchor={anchor}
            title={header || undefined}
            width={236}
            items={candidates.map((item, index) => ({
                key: String(index),
                label: item.title ?? String(item.value),
                onPress: () => onPress?.(item),
            }))}
            onClose={closeDesktopMenu}
        />
    );
}

/** 面板名 -> 桌面端实现。不在这张表里的仍然走原来的 PanelBase。 */
export const desktopPanelOverrides: Record<
    string,
    React.ComponentType<any>
> = {
    MusicItemOptions: MusicItemOptionsDesktop,
    AddToMusicSheet: AddToMusicSheetDesktop,
    SetFontSize: SetFontSizeDesktop,
    MusicQuality: MusicQualityDesktop,
    PlayRate: PlayRateDesktop,
    SetLyricOffset: SetLyricOffsetDesktop,
    SimpleSelect: SimpleSelectDesktop,
    SimpleInput: SimpleInputDesktop,
    SheetTags: SheetTagsDesktop,
};
