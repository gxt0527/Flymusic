/**
 * react-native-webview 的 Web 实现
 *
 * 桌面端用 iframe 承载网页内容。
 */
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

const WebView = forwardRef<any, any>((props, ref) => {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const { source, style, onMessage, injectedJavaScript, ...rest } = props;

    const uri = typeof source === "string" ? source : source?.uri ?? "";
    const html = source?.html;

    useImperativeHandle(ref, () => ({
        postMessage: (data: string) => {
            frameRef.current?.contentWindow?.postMessage(data, "*");
        },
        reload: () => {
            frameRef.current?.contentWindow?.location.reload();
        },
        injectJavaScript: (code: string) => {
            // iframe 跨域场景无法注入，忽略
            void code;
        },
        goBack: () => frameRef.current?.contentWindow?.history.back(),
        goForward: () => frameRef.current?.contentWindow?.history.forward(),
        stopLoading: () => void 0,
    }));

    return (
        <View style={style}>
            <iframe
                ref={frameRef}
                src={html ? undefined : uri}
                srcDoc={html}
                style={{
                    border: "none",
                    width: "100%",
                    height: "100%",
                    backgroundColor: "transparent",
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onLoad={() => {
                    void injectedJavaScript;
                    void onMessage;
                    void rest;
                }}
            />
        </View>
    );
});

WebView.displayName = "WebView";

export { WebView };
export default WebView;
