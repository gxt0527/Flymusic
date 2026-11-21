/**
 * react-native-image-colors 的 Web 实现
 *
 * 通过 Canvas 采样图片主色，返回结构与安卓端保持一致。
 */

interface IColorResult {
    platform: "android" | "ios" | "web";
    dominant?: string;
    average?: string;
    vibrant?: string;
    darkVibrant?: string;
    lightVibrant?: string;
    darkMuted?: string;
    lightMuted?: string;
    muted?: string;
    background?: string;
    primary?: string;
    secondary?: string;
    detail?: string;
}

function toHex(r: number, g: number, b: number) {
    const h = (n: number) => n.toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
}

/** 用 5bit/通道的直方图找出出现最多的颜色 */
function dominantColor(data: Uint8ClampedArray, _width: number, _height: number) {
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
    const step = 4;
    for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.count += 1;
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
        } else {
            buckets.set(key, { count: 1, r, g, b });
        }
    }
    let best: { count: number; r: number; g: number; b: number } | null = null;
    for (const bucket of buckets.values()) {
        if (!best || bucket.count > best.count) {
            best = bucket;
        }
    }
    if (!best) {
        return { r: 128, g: 128, b: 128 };
    }
    return {
        r: Math.round(best.r / best.count),
        g: Math.round(best.g / best.count),
        b: Math.round(best.b / best.count),
    };
}

async function getColors(uri: string, _config?: any): Promise<IColorResult> {
    const fallback: IColorResult = {
        platform: "web",
        dominant: "#5DD3A9",
        average: "#5DD3A9",
        vibrant: "#5DD3A9",
        muted: "#5DD3A9",
        darkVibrant: "#2F6B57",
        lightVibrant: "#9BEFD3",
        darkMuted: "#2B2B2B",
        lightMuted: "#D8D8D8",
        background: "#101213",
        primary: "#5DD3A9",
        secondary: "#EA93A6",
        detail: "#9A9A9A",
    };

    try {
        const image = await loadImage(uri);
        const canvas = document.createElement("canvas");
        // 缩小采样，兼顾性能
        const max = 64;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
            return fallback;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { r, g, b } = dominantColor(data, canvas.width, canvas.height);
        const hex = toHex(r, g, b);

        return {
            platform: "web",
            dominant: hex,
            average: hex,
            vibrant: hex,
            muted: hex,
            darkVibrant: toHex(
                Math.round(r * 0.55),
                Math.round(g * 0.55),
                Math.round(b * 0.55),
            ),
            lightVibrant: toHex(
                Math.min(255, Math.round(r * 1.35 + 40)),
                Math.min(255, Math.round(g * 1.35 + 40)),
                Math.min(255, Math.round(b * 1.35 + 40)),
            ),
            darkMuted: "#2B2B2B",
            lightMuted: "#D8D8D8",
            background: hex,
            primary: hex,
            secondary: hex,
            detail: hex,
        };
    } catch {
        return fallback;
    }
}

function loadImage(uri: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = uri;
    });
}

const ImageColors = { getColors };
export default ImageColors;
