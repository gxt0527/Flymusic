const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { mergeConfig } = require("@react-native/metro-config");

/**
 * Reference: https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md
 */
const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * web 打包时把平台后缀收窄为只有 `web`。
 *
 * metro 默认会把 `native` 也当作 fallback 后缀，导致 web 平台错误地
 * 命中 `Xxx.native.tsx`（如 @react-navigation/native-stack 的原生实现）。
 * 收窄后 web 只会匹配 `Xxx.web.tsx` → `Xxx.tsx`，Android / iOS 不受影响。
 */
const isWebBundle =
    /--platform[ =]web/.test(process.argv.join(" ")) ||
    process.env.FLY_PLATFORM === "web";

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    transformer: {
        babelTransformerPath: require.resolve("react-native-svg-transformer"),
    },
    resolver: {
        assetExts: assetExts.filter(ext => ext !== "svg"),
        sourceExts: [...sourceExts, "svg"],
        platforms: isWebBundle ? ["web"] : ["ios", "android", "native"],
    },
};

const mergedConfig = mergeConfig(getDefaultConfig(__dirname), config);

/* ------------------------------------------------------------------ */
/* Web（Electron）平台适配                                              */
/*                                                                    */
/* 只在 platform === "web" 时生效，Android / iOS 打包行为完全不变。      */
/* 通过构建期重定向，业务代码里的原生模块 import 一行都不用改。          */
/* ------------------------------------------------------------------ */

const WEB_ALIAS = {
    // 原生能力
    "react-native-track-player": "./src/platform/web/modules/trackPlayer",
    "react-native-fs": "./src/platform/web/modules/fs",
    "react-native-mmkv": "./src/platform/web/modules/mmkv",
    "react-native-fast-image": "./src/platform/web/modules/fastImage",
    "react-native-image-colors": "./src/platform/web/modules/imageColors",
    "react-native-device-info": "./src/platform/web/modules/deviceInfo",
    "@react-native-clipboard/clipboard": "./src/platform/web/modules/clipboard",
    "react-native-share": "./src/platform/web/modules/share",
    "react-native-webview": "./src/platform/web/modules/webview",
    "react-native-permissions": "./src/platform/web/modules/permissions",
    "react-native-background-timer": "./src/platform/web/modules/backgroundTimer",
    "react-native-image-picker": "./src/platform/web/modules/imagePicker",
    "expo-document-picker": "./src/platform/web/modules/documentPicker",
    "expo-file-system": "./src/platform/web/modules/fileSystem",
    "expo-splash-screen": "./src/platform/web/modules/splashScreen",
    "expo-keep-awake": "./src/platform/web/modules/keepAwake",
    "react-native-get-random-values": "./src/platform/web/modules/noop",

    // 组件替换
    "react-native-linear-gradient": "./src/platform/web/modules/linearGradient",
    "@react-native-community/slider": "./src/platform/web/modules/slider",
    "@react-native-community/netinfo": "./src/platform/web/modules/netinfo",

    // 深层导入
    "react-native/Libraries/Image/resolveAssetSource":
        "./src/platform/web/modules/resolveAssetSource",
    "react-native/Libraries/Image/AssetRegistry":
        "react-native-web/dist/modules/AssetRegistry",
};

/**
 * babel-preset-expo 在 web 平台会把 `react-native/xxx` 预先改写成
 * `react-native-web/xxx`，因此别名表需要同时兼容两种前缀。
 */
function normalizeModuleName(moduleName) {
    if (moduleName.startsWith("react-native-web/")) {
        return "react-native/" + moduleName.slice("react-native-web/".length);
    }
    return moduleName;
}

const baseResolveRequest = mergedConfig.resolver.resolveRequest;

mergedConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === "web") {
        // `import ... from '.'` 语义是「当前目录」，但 metro 解析时会一路
        // 上溯到项目根（命中根 package.json 的 main），这里强制按目录 index 解析。
        if ((moduleName === "." || moduleName === "..") && context.originModulePath) {
            const dir = path.dirname(context.originModulePath);
            const target = moduleName === "." ? dir : path.dirname(dir);
            try {
                return context.resolveRequest(
                    context,
                    path.join(target, "index"),
                    platform,
                );
            } catch {
                // 落回默认解析
            }
        }

        const target =
            WEB_ALIAS[moduleName] ?? WEB_ALIAS[normalizeModuleName(moduleName)];
        if (target) {
            const resolved = target.startsWith(".")
                ? path.resolve(__dirname, target)
                : target;
            return context.resolveRequest(context, resolved, platform);
        }
        // babel-preset-expo 通常已替换，这里再兜一层
        if (moduleName === "react-native") {
            return context.resolveRequest(context, "react-native-web", platform);
        }
    }

    const result = baseResolveRequest
        ? baseResolveRequest(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);

    // web 平台不应该命中 `.native.*` 实现（那是 iOS/Android 专用文件），
    // metro 内置规则会优先选它，这里回退到同名无后缀版本。
    if (
        platform === "web" &&
        result &&
        typeof result === "object" &&
        typeof result.filePath === "string" &&
        result.filePath.includes(".native.")
    ) {
        const fallbackPath = result.filePath.replace(".native.", ".");
        if (require("fs").existsSync(fallbackPath)) {
            return { ...result, filePath: fallbackPath };
        }
    }

    return result;
};

module.exports = mergedConfig;
