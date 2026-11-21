/**
 * 「添加到歌单」的 Windows 版
 *
 * 移动端是一整块底部抽屉，列表行用的是 rpx 尺寸（按 750rpx 版面算的），
 * 直接塞进 440 宽的桌面卡片里，缩略图会顶到卡片左边界之外、行也没法对齐 ——
 * 这是之前「显示错位」的根因，不是 padding 少调了几像素。
 *
 * 桌面端改为标准 Windows 对话框：420 宽、44 高标题栏（左标题 + 右关闭）、
 * 中间可滚动的选择列表、底部一条分隔线 + 右下角「取消」。
 * 行高 44、封面 28、悬停一层淡填充，尺寸全部是固定 px，不再随 rpx 缩放。
 */
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useSheetsBase } from "@/core/musicSheet";
import { useTokens } from "@/theme";
import Toast from "@/utils/toast";

import DesktopDialog, {
    DialogButton,
    DIALOG_BODY_PADDING,
    DIALOG_FOOTER_HEIGHT,
    DIALOG_HEADER_HEIGHT,
} from "./desktopDialog";
import { hidePanel, showPanel } from "./usePanel";

interface IAddToMusicSheetProps {
    musicItem: IMusic.IMusicItem | IMusic.IMusicItem[];
    newSheetDefaultName?: string;
}

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

export default function AddToMusicSheetDesktop(props: IAddToMusicSheetProps) {
    const { musicItem = [], newSheetDefaultName } = props ?? {};
    const sheets = useSheetsBase();
    const { t } = useI18N();

    const count = Array.isArray(musicItem) ? musicItem.length : 1;
    const sheetList = sheets ?? [];
    /** 高度跟着内容走，歌单多了再封顶由列表自己滚 */
    const contentHeight = DIALOG_BODY_PADDING + (sheetList.length + 1) * 44 + 9;
    const dialogHeight = Math.min(
        560,
        DIALOG_HEADER_HEIGHT + DIALOG_FOOTER_HEIGHT + contentHeight,
    );

    return (
        <DesktopDialog
            title={t("panel.addToMusicSheet.title", { count })}
            height={dialogHeight}
            onClose={() => hidePanel()}
            footer={
                <DialogButton
                    label={t("common.cancel")}
                    onPress={() => hidePanel()}
                />
            }>
            <ScrollView
                style={style.list}
                contentContainerStyle={style.listContent}
                showsVerticalScrollIndicator={contentHeight > 464}
                bounces={false}>
                <SheetRow
                    leading={<AddTile />}
                    title={t("panel.addToMusicSheet.newMusicSheet")}
                    onPress={() => {
                        showPanel("CreateMusicSheet", {
                            defaultName: newSheetDefaultName,
                            async onSheetCreated(sheetId) {
                                try {
                                    await MusicSheet.addMusic(
                                        sheetId,
                                        musicItem,
                                    );
                                    Toast.success(
                                        t("panel.addToMusicSheet.toast.success"),
                                    );
                                } catch {
                                    Toast.warn(
                                        t("panel.addToMusicSheet.toast.fail"),
                                    );
                                }
                            },
                            onCancel() {
                                showPanel("AddToMusicSheet", {
                                    musicItem,
                                    newSheetDefaultName,
                                });
                            },
                        });
                    }}
                />

                <Separator />

                {sheetList.map(sheet => (
                    <SheetRow
                        key={sheet.id}
                        leading={
                            /**
                             * 图标垫在下面、封面盖在上面：封面加载失败时露出音符，
                             * 不会留下一个空洞（自建歌单本来就没有封面）。
                             */
                            <SheetCover cover={sheet.coverImg} />
                        }
                        title={sheet.title ?? ""}
                        description={t("panel.addToMusicSheet.count", {
                            count: sheet.worksNum ?? "-",
                        })}
                        onPress={async () => {
                            try {
                                await MusicSheet.addMusic(
                                    sheet.id,
                                    musicItem,
                                );
                                hidePanel();
                                Toast.success(
                                    t("panel.addToMusicSheet.toast.success"),
                                );
                            } catch {
                                Toast.warn(
                                    t("panel.addToMusicSheet.toast.fail"),
                                );
                            }
                        }}
                    />
                ))}
            </ScrollView>
        </DesktopDialog>
    );
}

function AddTile() {
    const tokens = useTokens();

    return (
        <View
            style={[
                style.addTile,
                {
                    borderColor: tokens.color.border,
                    backgroundColor: tokens.color.bg.input,
                },
            ]}>
            <Icon name="plus" size={14} color={tokens.color.text.secondary} />
        </View>
    );
}

function SheetCover(props: { cover?: string }) {
    const tokens = useTokens();

    return (
        <View
            style={[
                style.cover,
                style.coverFallback,
                { backgroundColor: tokens.color.bg.input },
            ]}>
            <Icon
                name="musical-note"
                size={13}
                color={tokens.color.text.tertiary}
            />
            {props.cover ? (
                /**
                 * 不传 placeholderSource：加载失败时这层是透明的，
                 * 正好露出底下的音符；否则默认封面图会以固有尺寸铺满整块列表。
                 */
                <FastImage style={style.coverImage} source={props.cover} />
            ) : null}
        </View>
    );
}

function Separator() {
    const tokens = useTokens();

    return (
        <View
            style={[style.separator, { backgroundColor: tokens.color.divider }]}
        />
    );
}

interface ISheetRowProps {
    /** 行首图形：封面或「新建」的加号方块 */
    leading: React.ReactNode;
    title: string;
    description?: string;
    onPress: () => void;
}

function SheetRow(props: ISheetRowProps) {
    const { leading, title, description, onPress } = props;
    const tokens = useTokens();
    const [hovered, setHovered] = useState(false);

    return (
        <Pressable
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onPress={onPress}
            style={[
                style.row,
                webCursor,
                hovered && { backgroundColor: tokens.color.bg.hover },
            ]}>
            {leading}
            <View style={style.rowText}>
                <Text
                    numberOfLines={1}
                    style={[
                        style.rowTitle,
                        { color: tokens.color.text.primary },
                    ]}>
                    {title}
                </Text>
                {description ? (
                    <Text
                        numberOfLines={1}
                        style={[
                            style.rowDesc,
                            { color: tokens.color.text.tertiary },
                        ]}>
                        {description}
                    </Text>
                ) : null}
            </View>
        </Pressable>
    );
}

const style = StyleSheet.create({
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    row: {
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        gap: 10,
        borderRadius: 4,
    },
    addTile: {
        width: 28,
        height: 28,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    cover: {
        width: 28,
        height: 28,
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
    },
    coverFallback: {
        alignItems: "center",
        justifyContent: "center",
    },
    coverImage: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 28,
        height: 28,
        borderRadius: 4,
    },
    rowText: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        justifyContent: "center",
    },
    rowTitle: {
        fontSize: 13,
        lineHeight: 18,
        includeFontPadding: false,
    },
    rowDesc: {
        fontSize: 11,
        lineHeight: 15,
        includeFontPadding: false,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 8,
        marginVertical: 4,
    },
});
