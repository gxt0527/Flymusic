/**
 * 桌面端歌曲表格的表头（标题 / 专辑 / 喜欢 / 时长 / 更多）
 *
 * 列宽和行共用 desktopColumns，两者用同一套数值才能对得上。
 * 只在桌面布局的「我的喜欢」「歌单」等页面出现，窄屏与浮层里不渲染。
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTokens } from "@/theme";
import { columnFlex, columnSize } from "./desktopColumns";

interface IDesktopMusicHeaderProps {
    /** 是否显示序号列 */
    showIndex?: boolean;
    /** 是否显示专辑列 */
    showAlbum?: boolean;
}

export default function DesktopMusicHeader(props: IDesktopMusicHeaderProps) {
    const { showIndex, showAlbum } = props;
    const t = useTokens();

    return (
        <View style={styles.header}>
            {showIndex ? (
                /* 序号列只有数字，表头不写字（原来放的是 #）：留白靠空 View 撑出列宽 */
                <View style={styles.index} />
            ) : null}
            <View style={styles.titleCell}>
                <Text
                    style={[styles.label, { color: t.color.text.tertiary }]}>
                    标题
                </Text>
            </View>
            {showAlbum ? (
                <View style={styles.albumCell}>
                    <Text
                        style={[styles.label, { color: t.color.text.tertiary }]}>
                        专辑
                    </Text>
                </View>
            ) : null}
            <Text
                style={[styles.like, styles.label, { color: t.color.text.tertiary }]}>
                喜欢
            </Text>
            <Text
                style={[
                    styles.duration,
                    styles.label,
                    { color: t.color.text.tertiary },
                ]}>
                时长
            </Text>
            {/* 「更多」列只有悬停才出现的 ⋮，表头不写字，留空撑出列宽 */}
            <View style={styles.moreCell} />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: columnSize.gap,
        height: 34,
        /**
         * 滚动条常驻（见 columnSize.scrollbar）：列表里的行少这 8px，
         * 表头自己也留出来，「喜欢」「时长」才和下方内容对齐。
         */
        paddingRight: columnSize.scrollbar,
    },
    index: {
        width: columnSize.index,
        fontSize: 12,
        lineHeight: 16,
        textAlign: "center",
        includeFontPadding: false,
    },
    titleCell: {
        flexGrow: columnFlex.title,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
    },
    albumCell: {
        flexGrow: columnFlex.album,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
    },
    like: {
        width: columnSize.like,
        textAlign: "center",
    },
    duration: {
        /**
         * 表头居中对齐，行内时间右对齐。
         *
         * 两处都右对齐时，「时长」只有两个字、比下面的 00:00 窄，
         * 右缘贴齐会让整块偏右、看着不居中；居中后与数字的光学中心重合。
         */
        width: columnSize.duration,
        textAlign: "center",
    },
    moreCell: {
        width: columnSize.more,
    },
    label: {
        fontSize: 12,
        lineHeight: 16,
        includeFontPadding: false,
    },
});
