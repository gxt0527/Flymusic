/**
 * 内容首次出现时淡入
 *
 * 数据回来之前页面上只有空内容，回来那一刻整块内容会一次性画出来 ——
 * 深色主题下实测整屏亮度一次跃升几十个点，肉眼就是「闪一下」。
 *
 * 这里不能按墙钟时间去起跑：列表第一次铺开时主线程要算几十个卡片的布局，
 * 实测会连续卡住 300~400ms。这段时间里 CSS 动画照样在「走」，等浏览器终于
 * 能出帧时不透明度早就到 1 了 —— 淡入等于没做，内容还是硬生生砸出来。
 * 所以先把容器按住（opacity 0），等主线程空出来、真正能出帧的那一帧
 * （rAF）才开始过渡。
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";

/** 淡入时长，毫秒 */
const FADE_DURATION = 170;

/** 窗口被遮挡时 rAF 会被节流，用定时器兜底，避免内容一直隐身 */
const REVEAL_FALLBACK = 800;

const isWeb = Platform.OS === "web";

/** web 上用 layoutEffect：必须赶在内容上屏之前把不透明度按下去 */
const useIsomorphicLayoutEffect = isWeb ? useLayoutEffect : useEffect;

/**
 * 把容器从 0 渐变到 1。
 *
 * 返回清理函数；组件卸载时如果过渡还没起步，直接把状态留在原地即可，
 * 节点随之销毁。
 */
function startFade(node: any): () => void {
    if (!node?.style) {
        return () => {};
    }
    const { style } = node;
    style.transition = "none";
    style.opacity = "0";

    let done = false;
    let timer: any = 0;
    const reveal = () => {
        if (done) {
            return;
        }
        done = true;
        clearTimeout(timer);
        style.transition = `opacity ${FADE_DURATION}ms ease-out`;
        style.opacity = "1";
    };

    const raf = requestAnimationFrame(reveal);
    timer = setTimeout(reveal, REVEAL_FALLBACK);

    return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        // 条件回退（例如列表被清空）时要把节点还原成不透明，
        // 否则容器会一直停在 opacity 0，后续内容全部不可见
        if (!done) {
            done = true;
            style.transition = "none";
            style.opacity = "1";
        }
    };
}

/**
 * 条件第一次成立时播放一次淡入。
 *
 * 返回的 ref 挂到承载内容的容器上即可，例如一直挂载、靠 `data` 填充的
 * 列表：`const ref = useFadeInOnce(list.length > 0)`。
 */
export function useFadeInOnce(active: boolean) {
    const nodeRef = useRef<any>(null);
    const playedRef = useRef(false);

    // 内容被清空（切分类、重新拉数据）时重新上膛：
    // 下一次「空 → 有」同样值得一次淡入，否则骨架换成内容时会硬切一刀
    useEffect(() => {
        if (!active) {
            playedRef.current = false;
        }
    }, [active]);

    useIsomorphicLayoutEffect(() => {
        if (!isWeb || !active || playedRef.current) {
            return;
        }
        playedRef.current = true;
        return startFade(nodeRef.current);
    }, [active]);

    return nodeRef;
}

interface IFadeInViewProps {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** 挂载即淡入：首帧就是 opacity 0，不存在「先全亮再渐显」的可能 */
export default function FadeInView(props: IFadeInViewProps) {
    const { children, style } = props;
    const nodeRef = useRef<any>(null);
    const [visible, setVisible] = useState(!isWeb);

    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const node = nodeRef.current;
        // transition 只能落在 DOM 上：RN 的样式表不接受 transition*
        if (node?.style) {
            node.style.transition = `opacity ${FADE_DURATION}ms ease-out`;
        }
        // 先让 opacity:0 真正绘制一帧，再切到 1，否则同帧赋值不会有过渡
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setVisible(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            if (raf2) {
                cancelAnimationFrame(raf2);
            }
        };
    }, []);

    return (
        <View ref={nodeRef} style={[style, visible ? null : { opacity: 0 }]}>
            {children}
        </View>
    );
}
