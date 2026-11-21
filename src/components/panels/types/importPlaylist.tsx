/**
 * 「我的歌单」— 智能导入歌单面板
 *
 * 流程：选平台（或自动识别）→ 粘贴链接 → 分阶段进度解析 → 弹窗编辑歌单名
 *       → 建歌单并进入匹配进度面板。
 * 原有的「使用插件导入歌单」入口保留在底部，旧功能不受影响。
 */
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { ScrollView, TextInput } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import ImportPlaylist from "@/core/importPlaylist";
import { parseByPlugins } from "@/core/importPlaylist/pluginFallback";
import { parsePlaylist } from "@/core/importPlaylist/parsers";
import strings from "@/core/importPlaylist/strings";
import { IParseResult, ImportPlatform } from "@/core/importPlaylist/types";
import { useOpenSheetDetail } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx, { vmax } from "@/utils/rpx";
import Toast from "@/utils/toast";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import { hidePanel, showPanel } from "../usePanel";

const platformOptions: Array<{ key: ImportPlatform; label: string }> = [
    { key: "auto", label: strings.auto },
    { key: "qq", label: strings.qq },
    { key: "netease", label: strings.netease },
    { key: "kugou", label: strings.kugou },
    { key: "text", label: strings.text },
];

type Phase = "idle" | "parsing" | "error";

export default function ImportPlaylistPanel() {
    const colors = useColors();
    const safeAreaInsets = useSafeAreaInsets();
    const openSheetDetail = useOpenSheetDetail();

    const [platform, setPlatform] = useState<ImportPlatform>("auto");
    const [link, setLink] = useState("");
    const [phase, setPhase] = useState<Phase>("idle");
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState(strings.parsing);
    const [errorMsg, setErrorMsg] = useState("");
    const canceledRef = useRef(false);

    const progressAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 320,
            useNativeDriver: false,
        }).start();
    }, [progress]);
    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ["0%", "100%"],
    });

    const reportProgress = (percent: number, label: string) => {
        if (canceledRef.current) {
            return;
        }
        setProgress(percent);
        setProgressLabel(label);
    };

    /** 解析成功：弹出可编辑的歌单名称，保存后才建歌单、开始匹配 */
    const openNameDialog = (result: IParseResult) => {
        setPhase("idle");
        showDialog("ImportSheetNameDialog", {
            defaultName: result.sheetTitle || strings.namePlaceholder,
            count: result.tracks.length,
            notice: result.notice,
            onConfirm: (name: string) => {
                void (async () => {
                    try {
                        const sheetId = await ImportPlaylist.createAndMatch(
                            result,
                            name,
                        );
                        // 保存后直接切到新歌单：以前停留在「我的收藏」，
                        // 用户会以为导入的歌单没有生成。匹配面板是全局浮层，
                        // 切页不会中断后台匹配。
                        openSheetDetail({
                            id: sheetId,
                        });
                        showPanel("ImportPlaylistMatch", { sheetId });
                    } catch {
                        Toast.warn("创建歌单失败，请重试");
                    }
                })();
            },
        });
    };

    const startParse = async () => {
        const raw = link.trim();
        if (!raw || phase === "parsing") {
            return;
        }
        canceledRef.current = false;
        setPhase("parsing");
        setProgress(0);
        setProgressLabel(strings.parsing);
        setErrorMsg("");

        try {
            let result = await parsePlaylist(raw, platform, reportProgress);
            if (canceledRef.current) {
                return;
            }
            if (!result.tracks.length) {
                throw new Error(strings.parseEmpty);
            }

            // 平台声明的曲目总数比实际拿到的多（例如 QQ音乐未登录歌单只公开
            // 前 10 首），再让已安装的「导入歌单」插件试着补全一次。
            const declaredTotal = result.declaredTotal ?? 0;
            // notice 由解析器在「只拿到部分曲目」时设置；单纯去重导致的
            // 几首差值不必再劳烦插件（例如 280 首去重成 274 首）
            if (result.notice && declaredTotal > result.tracks.length) {
                setProgress(88);
                setProgressLabel(strings.pluginSupplement);
                try {
                    const supplement = await parseByPlugins(
                        raw,
                        platform,
                        () => {},
                    );
                    if (canceledRef.current) {
                        return;
                    }
                    if (supplement && supplement.tracks.length > result.tracks.length) {
                        result = {
                            ...supplement,
                            sheetTitle:
                                supplement.sheetTitle === strings.namePlaceholder
                                    ? result.sheetTitle
                                    : supplement.sheetTitle,
                            declaredTotal,
                            notice:
                                supplement.tracks.length < declaredTotal
                                    ? result.notice
                                    : undefined,
                        };
                    }
                } catch {
                    // 插件兜底失败不覆盖内置解析结果
                }
            }
            openNameDialog(result);
        } catch (e: any) {
            if (canceledRef.current) {
                return;
            }
            // 内置解析可能被平台风控挡住，再交给已安装的导入插件试一次
            try {
                const fallback = await parseByPlugins(
                    raw,
                    platform,
                    reportProgress,
                );
                if (canceledRef.current) {
                    return;
                }
                if (fallback?.tracks.length) {
                    openNameDialog(fallback);
                    return;
                }
            } catch {
                // 忽略插件兜底异常，统一展示下面的错误提示
            }
            setPhase("error");
            setErrorMsg(e?.message || strings.parseFail);
        }
    };

    const pasteFromClipboard = async () => {
        try {
            const text = await Clipboard.getString();
            if (text) {
                setLink(text);
                setPhase("idle");
                setErrorMsg("");
            }
        } catch {
            Toast.warn("读取剪贴板失败");
        }
    };

    const parsing = phase === "parsing";

    return (
        <PanelBase
            // 桌面与移动端都居中显示：解析进度、错误提示都是需要盯着的对话框
            positionMethod="center"
            height={Math.min(vmax(72), 480)}
            keyboardAvoidBehavior="none"
            renderBody={() => (
                <>
                    <PanelHeader
                        hideButtons
                        onClose={hidePanel}
                        title={strings.title}
                    />
                    <ScrollView
                        style={styles.body}
                        contentContainerStyle={{
                            paddingBottom: safeAreaInsets.bottom + rpx(40),
                        }}>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.subtitle}>
                            {strings.subtitle}
                        </ThemeText>

                        {/* 平台选择 */}
                        <View style={styles.chips}>
                            {platformOptions.map(option => {
                                const active = platform === option.key;
                                return (
                                    <TouchableOpacity
                                        key={option.key}
                                        activeOpacity={0.7}
                                        disabled={parsing}
                                        onPress={() => setPlatform(option.key)}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: active
                                                    ? colors.primary
                                                    : colors.placeholder,
                                                borderColor: colors.divider ?? "transparent",
                                            },
                                        ]}>
                                        <ThemeText
                                            fontSize="description"
                                            color={active ? "#FFFFFF" : colors.text}>
                                            {option.label}
                                        </ThemeText>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* 链接 / 文本输入 */}
                        <TextInput
                            value={link}
                            onChangeText={text => {
                                setLink(text);
                                if (phase === "error") {
                                    setPhase("idle");
                                    setErrorMsg("");
                                }
                            }}
                            editable={!parsing}
                            multiline
                            numberOfLines={4}
                            maxLength={20000}
                            textAlignVertical="top"
                            placeholder={strings.inputPlaceholder}
                            placeholderTextColor={colors.textSecondary}
                            style={[
                                styles.input,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.placeholder,
                                },
                            ]}
                        />

                        <View style={styles.row}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                disabled={parsing}
                                onPress={pasteFromClipboard}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="primary">
                                    {strings.pasteClipboard}
                                </ThemeText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                disabled={parsing || !link.trim()}
                                onPress={startParse}
                                style={[
                                    styles.primaryButton,
                                    { backgroundColor: colors.primary },
                                    (!link.trim() || parsing) && {
                                        opacity: 0.45,
                                    },
                                ]}>
                                <ThemeText color="#FFFFFF" fontWeight="medium">
                                    {strings.start}
                                </ThemeText>
                            </TouchableOpacity>
                        </View>

                        {/* 解析进度 */}
                        {parsing ? (
                            <View style={styles.progressBox}>
                                <View style={styles.progressLabelRow}>
                                    <ActivityIndicator
                                        size="small"
                                        color={colors.primary}
                                    />
                                    <ThemeText
                                        fontSize="description"
                                        style={styles.progressLabel}>
                                        {progressLabel}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {Math.round(progress)}%
                                    </ThemeText>
                                </View>
                                <View
                                    style={[
                                        styles.track,
                                        { backgroundColor: colors.placeholder },
                                    ]}>
                                    <Animated.View
                                        style={[
                                            styles.fill,
                                            {
                                                width: progressWidth,
                                                backgroundColor: colors.primary,
                                            },
                                        ]}
                                    />
                                </View>
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        canceledRef.current = true;
                                        setPhase("idle");
                                        setProgress(0);
                                        Toast.success(strings.parseCanceled);
                                    }}>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {strings.cancel}
                                    </ThemeText>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {phase === "error" ? (
                            <View style={styles.errorBox}>
                                <ThemeText
                                    fontSize="description"
                                    color="#E5484D"
                                    style={styles.error}>
                                    {errorMsg}
                                </ThemeText>
                                <View style={styles.errorActions}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        style={[
                                            styles.secondaryButton,
                                            { borderColor: colors.primary },
                                        ]}
                                        onPress={() => {
                                            showPanel("ImportMusicSheet");
                                        }}>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="primary">
                                            {strings.pluginEntry}
                                        </ThemeText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        style={styles.secondaryButton}
                                        onPress={() => {
                                            setPlatform("text");
                                            setPhase("idle");
                                            setErrorMsg("");
                                            Toast.success(strings.textModeHint);
                                        }}>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                            {strings.switchToText}
                                        </ThemeText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}

                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.hint}>
                            {strings.pluginHint}
                        </ThemeText>

                        {/* 保留原有插件导入入口 */}
                        <ListItem
                            withHorizontalPadding
                            onPress={() => showPanel("ImportMusicSheet")}>
                            <ListItem.Content
                                title={strings.pluginEntry}
                                description={strings.pluginEntryHint}
                            />
                            <ListItem.ListItemIcon
                                position="right"
                                icon="chevron-right"
                            />
                        </ListItem>
                    </ScrollView>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    body: {
        flex: 1,
    },
    subtitle: {
        marginHorizontal: rpx(24),
        marginTop: rpx(20),
    },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: rpx(12),
        marginHorizontal: rpx(24),
        marginTop: rpx(20),
        marginBottom: rpx(20),
    },
    chip: {
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(12),
        borderRadius: rpx(30),
        borderWidth: StyleSheet.hairlineWidth,
    },
    input: {
        marginHorizontal: rpx(24),
        borderRadius: rpx(12),
        minHeight: rpx(150),
        maxHeight: rpx(260),
        fontSize: rpx(26),
        padding: rpx(16),
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginHorizontal: rpx(24),
        marginTop: rpx(20),
    },
    primaryButton: {
        paddingHorizontal: rpx(36),
        paddingVertical: rpx(14),
        borderRadius: rpx(10),
    },
    progressBox: {
        marginHorizontal: rpx(24),
        marginTop: rpx(28),
    },
    progressLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: rpx(12),
    },
    progressLabel: {
        flex: 1,
    },
    track: {
        height: rpx(10),
        borderRadius: rpx(5),
        overflow: "hidden",
        marginTop: rpx(16),
    },
    fill: {
        height: "100%",
        borderRadius: rpx(5),
    },
    cancelButton: {
        alignSelf: "flex-end",
        marginTop: rpx(16),
        paddingHorizontal: rpx(12),
    },
    errorBox: {
        marginHorizontal: rpx(24),
        marginTop: rpx(20),
    },
    error: {},
    errorActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: rpx(16),
        marginTop: rpx(20),
    },
    secondaryButton: {
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(12),
        borderRadius: rpx(10),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(150,150,150,0.35)",
    },
    hint: {
        marginHorizontal: rpx(24),
        marginTop: rpx(28),
        marginBottom: rpx(8),
    },
});
