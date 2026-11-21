/**
 * Web(桌面端) bundle 构建脚本
 *
 * 不经过 react-native CLI —— CLI 在 platform=web 时会强制注入
 * `react-native-web/Libraries/Core/InitializeCore`（RNW 并不存在该路径）。
 * 直接调用 Metro API，行为完全可控。
 *
 * 用法：node scripts/build-web.js [--prod]
 */
const path = require("path");
const fs = require("fs");
const os = require("os");

const Metro = require("metro");
const ServerModule = require("metro/src/Server");
const bundleImpl = require("metro/src/shared/output/bundle");

// package.json 的 exports 未暴露该子路径，按绝对路径引入
const saveAssets = require(
    path.join(
        __dirname,
        "../node_modules/@react-native/community-cli-plugin/dist/commands/bundle/saveAssets.js",
    ),
).default;

const isProd = process.argv.includes("--prod");
const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, "web-dist");
const bundleOutput = path.resolve(outDir, "index.bundle.js");
const assetsDest = path.resolve(outDir, "assets");

/** Metro 的 runBuild 不支持 resetCache 参数，手动清缓存目录 */
function resetMetroCache() {
    try {
        fs.rmSync(path.join(os.tmpdir(), "metro-cache"), {
            recursive: true,
            force: true,
        });
    } catch {}
}

async function main() {
    const started = Date.now();
    // 每次构建前清空资源目录：源图删除 / 改名后，旧产物不能留在 web-dist 里
    try {
        fs.rmSync(assetsDest, { recursive: true, force: true });
    } catch {}
    fs.mkdirSync(assetsDest, { recursive: true });
    resetMetroCache();

    const config = await Metro.loadConfig({
        config: path.resolve(root, "metro.config.js"),
    });

    const server = await Metro.runMetro(config, { watch: false });
    try {
        const requestOptions = {
            entryFile: path.resolve(root, "web/index.js"),
            dev: !isProd,
            minify: isProd,
            platform: "web",
            inlineSourceMap: false,
            sourceMapUrl: undefined,
            createModuleIdFactory: config.serializer.createModuleIdFactory,
        };

        const bundle = await bundleImpl.build(server, requestOptions);
        await bundleImpl.save(
            bundle,
            { bundleOutput, dev: !isProd, platform: "web" },
            () => {},
        );

        // 复制图片等资源（runBuild 不会做这一步）
        const outputAssets = await server.getAssets({
            ...ServerModule.DEFAULT_BUNDLE_OPTIONS,
            ...requestOptions,
            bundleType: "todo",
        });
        // saveAssets 会拼上 httpServerLocation（形如 assets/imgs/x.png），
        // 因此目标目录要传 outDir 而不是 assetsDir
        await saveAssets(outputAssets, "web", outDir);
    } finally {
        await server.end();
    }

    // 把静态 HTML 一起输出到 web-dist
    fs.copyFileSync(
        path.resolve(root, "web/index.html"),
        path.resolve(outDir, "index.html"),
    );

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const assetCount = fs.readdirSync(assetsDest).length;
    console.log(
        `\n[build-web] 完成 ${isProd ? "(production)" : "(development)"} 用时 ${seconds}s`,
    );
    console.log(
        `[build-web] 输出: index.bundle.js + index.html + ${assetCount} 个资源`,
    );
}

main().catch(error => {
    console.error("[build-web] 构建失败");
    console.error(error);
    process.exit(1);
});
