/**
 * 带淡入的图片
 *
 * 网络封面要等解码完成才真正画得出来。首屏几十张图往往在一两帧里陆续
 * 完成，整屏会从页面底色一下跳到满屏彩色 —— 深色主题下实测亮度一次
 * 跃升 7 个点，肉眼就是「闪一下」。这里在 web 上给每张图加 170ms 渐显，
 * 把这次跃升摊成连续变化。
 *
 * 只在首次绘制时淡入：换图（切歌、列表项复用）不重新渐显，避免滚动时
 * 满屏图片反复淡入。
 */
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { Image, ImageProps, Platform } from "react-native";

/** 淡入时长，毫秒。够摊平一次跃升，又不至于让人觉得加载变慢 */
const FADE_DURATION = 170;

const isWeb = Platform.OS === "web";

const FadeImage: any = forwardRef<any, ImageProps>((props, ref) => {
    const { style, onLoad, ...rest } = props;
    const nodeRef = useRef<any>(null);
    // 非 web 端不做淡入，直接显示
    const [visible, setVisible] = useState(!isWeb);

    // 外部 ref 可能被父组件拿去做测量，必须继续透传
    const setNode = (node: any) => {
        nodeRef.current = node;
        if (typeof ref === "function") {
            ref(node);
        } else if (ref && typeof ref === "object") {
            ref.current = node;
        }
    };

    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const node = nodeRef.current;
        // transition 只能落在 DOM 上：RN 的样式表不接受 transition*
        if (node?.style) {
            node.style.transition = `opacity ${FADE_DURATION}ms ease-out`;
        }
        // 兜底：极端情况下 onLoad 不回调（图片被判定为无需加载等），
        // 不能让图一直不可见
        const timer = setTimeout(() => setVisible(true), FADE_DURATION + 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Image
            ref={setNode}
            {...rest}
            onLoad={e => {
                setVisible(true);
                onLoad?.(e);
            }}
            style={[style, visible ? null : { opacity: 0 }]}
        />
    );
});

FadeImage.displayName = "FadeImage";

export default FadeImage;
