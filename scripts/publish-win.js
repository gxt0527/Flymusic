/**
 * 把 electron-builder 的产物从固定暂存目录发布到 release-desktop。
 *
 * 为什么需要这一步：本机安全软件会长期持有产物里 app.asar 的句柄，electron-builder
 * 清不掉旧的 win-unpacked，直接输出到 release-desktop 会中断打包。所以打包固定在
 * release-build 里原地重建，再把 exe / blockmap / latest.yml 拷进发布目录，
 * 保证发布目录里永远只有安装包，也不会每次打包多出一个 release-outN。
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const staging = path.join(root, "release-stage");
const dest = path.join(root, "release-desktop");
const backup = path.join(dest, "backup");
const { version } = require(path.join(root, "package.json"));

const exeName = `FlyMusic-${version}-setup.exe`;
const artifacts = [exeName, `${exeName}.blockmap`, "latest.yml"];

function fail(message) {
    console.error(`[publish-win] ${message}`);
    process.exit(1);
}

for (const name of artifacts) {
    if (!fs.existsSync(path.join(staging, name))) {
        fail(`缺少产物 ${path.join(staging, name)}，请先执行 electron-builder`);
    }
}

fs.mkdirSync(backup, { recursive: true });

// 同版本号重发时归档旧包，用时间戳区分，避免覆盖掉上一版
const stamp = new Date()
    .toTimeString()
    .slice(0, 8)
    .replace(/:/g, "");
if (fs.existsSync(path.join(dest, exeName))) {
    const archived = path.join(
        backup,
        exeName.replace(/\.exe$/, `.before${stamp}.exe`),
    );
    fs.copyFileSync(path.join(dest, exeName), archived);
    console.log(`[publish-win] 旧包已归档 ${path.relative(root, archived)}`);
}
if (fs.existsSync(path.join(dest, "latest.yml"))) {
    const archivedYml = path.join(backup, `latest-${stamp}.yml`);
    fs.copyFileSync(path.join(dest, "latest.yml"), archivedYml);
}

for (const name of artifacts) {
    fs.copyFileSync(path.join(staging, name), path.join(dest, name));
}

// 报告实际大小与 sha512，便于与 latest.yml 声明值对照
const exePath = path.join(dest, exeName);
const { size } = fs.statSync(exePath);
const sha512 = crypto
    .createHash("sha512")
    .update(fs.readFileSync(exePath))
    .digest("base64");

console.log(`[publish-win] 已发布到 ${path.relative(root, dest)}`);
console.log(`  ${exeName}  ${size} bytes`);
console.log(`  sha512  ${sha512}`);
