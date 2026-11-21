/**
 * react-native-fast-image 的 Web 实现
 *
 * 直接用 react-native-web 的 Image，兼容 RN 的 style/source 语义。
 * 图片解码完成后做一次淡入，原因见 `components/base/fadeImage` 的说明：
 * 首屏封面在一两帧里集中画出来，整屏亮度会跳一下。
 */
import React, { forwardRef } from "react";

import FadeImage from "@/components/base/fadeImage";

export type FastImageProps = any;
export type ImageStyle = any;

const FastImage: any = forwardRef<any, FastImageProps>((props, ref) => {
    const { source, style, ...rest } = props;

    // FastImage 额外支持 { localUri }，统一转换成 Image 的 { uri }
    let nextSource = source;
    if (source && !Array.isArray(source) && source.localUri && !source.uri) {
        nextSource = { uri: source.localUri };
    }

    return <FadeImage ref={ref} {...rest} source={nextSource} style={style} />;
});

FastImage.displayName = "FastImage";

FastImage.preload = (_sources: any[]) => {
    // web 端交给浏览器缓存
};
FastImage.clearMemoryCache = async () => {};
FastImage.clearDiskCache = async () => {};

export default FastImage;
