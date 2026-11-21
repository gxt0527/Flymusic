module.exports = {
    presets: ["babel-preset-expo"],
    plugins: [
        [
            "module-resolver",
            {
                // 不启用 root：否则三方库里的 `from '.'`（如 react-native-svg 的
                // src/web/utils/prepare.ts）会被改写到项目根，命中根目录 index.js，
                // 导致 svg 渲染时拿到 undefined 崩溃。
                alias: {
                    "^@/(.+)": "./src/\\1",
                    webdav: "webdav/dist/react-native",
                },
            },
        ],
        "react-native-reanimated/plugin",
    ],
    env: {
        production: {
            plugins: ["transform-remove-console"],
        },
    },
};
