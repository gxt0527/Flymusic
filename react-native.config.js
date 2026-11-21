/**
 * React Native CLI 配置
 *
 * 注册 web（Electron）平台，让 `react-native bundle --platform web` 能正常工作。
 * Android 配置沿用默认值，不做改动（iOS 平台已移出本工程）。
 */
module.exports = {
    platforms: {
        web: {
            npmPackageName: "react-native-web",
            projectConfig: () => ({
                root: __dirname,
                reactNativePath: "./node_modules/react-native",
            }),
        },
    },
};
