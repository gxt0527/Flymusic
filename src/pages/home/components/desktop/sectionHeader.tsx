/**
 * 区块标题：左标题 + 右「更多」
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";

interface ISectionHeaderProps {
    title: string;
    moreText?: string;
    onMore?: () => void;
    /** 「更多」之前的自定义操作，例如导入歌单 */
    actions?: React.ReactNode;
}

export default function SectionHeader(props: ISectionHeaderProps) {
    const { title, moreText, onMore, actions } = props;
    const colors = useColors();

    return (
        <View style={styles.container}>
            <ThemeText style={styles.title}>{title}</ThemeText>
            <View style={styles.right}>
                {actions}
                {moreText && onMore ? (
                    <Pressable style={styles.more} onPress={onMore}>
                        <ThemeText
                            fontColor="textSecondary"
                            style={styles.moreText}>
                            {moreText}
                        </ThemeText>
                        <Icon
                            name="chevron-right"
                            size={14}
                            color={colors.textSecondary}
                        />
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 13,
    },
    title: {
        fontSize: 16.5,
        lineHeight: 23,
        fontWeight: "500",
    },
    right: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    more: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
    },
    moreText: {
        fontSize: 12,
    },
});
