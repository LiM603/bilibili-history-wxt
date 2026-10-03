/**
 * WebDAV 客户端工具模块
 * 在扩展页面中直接使用 fetch 发起请求（利用 host_permissions 跨域特权）
 */

import { getStorageValue } from "./storage";
import { WEBDAV_CONFIG } from "./constants";

export interface WebDavConfig {
  /** WebDAV 服务器地址，例如 https://dav.example.com */
  serverUrl: string;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 远程存储路径，默认 /bilibili-history/ */
  basePath: string;
}

const ENCRYPTED_PREFIX = "enc:";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ENCRYPTION_KEY_SOURCE = "bilibili-history-wxt";

/**
 * 加密敏感信息（如 WebDAV 密码）。密钥由固定口令经 PBKDF2 派生并本地存储盐值，
 * 用于防止密码在 chrome.storage.local 中明文可读。注意：同一扩展环境下的代码
 * 仍可解密，这只是提高恶意扩展读取的门槛，并非端到端加密。
 */
export const encryptSecret = async (plain: string): Promise<string> => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ENCRYPTION_KEY_SOURCE),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  const payload = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  payload.set(salt, 0);
  payload.set(iv, salt.length);
  payload.set(new Uint8Array(cipher), salt.length + iv.length);
  return btoa(String.fromCharCode(...payload));
};

export const decryptSecret = async (stored: string): Promise<string> => {
  const payload = Uint8Array.from(atob(stored), (char) => char.charCodeAt(0));
  const salt = payload.slice(0, SALT_LENGTH);
  const iv = payload.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const cipher = payload.slice(SALT_LENGTH + IV_LENGTH);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ENCRYPTION_KEY_SOURCE),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
};

/** 读取已保存的 WebDAV 配置并解密密码。旧版本明文密码可直接兼容读取。 */
export const loadWebDavConfig = async (): Promise<WebDavConfig | null> => {
  const saved = await getStorageValue<WebDavConfig | null>(WEBDAV_CONFIG, null);
  if (!saved) return null;
  if (saved.password?.startsWith(ENCRYPTED_PREFIX)) {
    try {
      saved.password = await decryptSecret(saved.password.slice(ENCRYPTED_PREFIX.length));
    } catch (error) {
      console.error("WebDAV 密码解密失败，请重新保存配置:", error);
      saved.password = "";
    }
  }
  return saved;
};

/** 保存 WebDAV 配置前加密密码，返回可直接写入 storage 的配置对象 */
export const sealWebDavConfig = async (config: WebDavConfig): Promise<WebDavConfig> => {
  const password = config.password ? ENCRYPTED_PREFIX + (await encryptSecret(config.password)) : "";
  return { ...config, password };
};

const WEBDAV_OPERATION_LOCK = "webdavOperationLock";
// 续期间隔必须小于 MV3 Service Worker 约 30s 的空闲回收阈值，否则后台长任务
// 会在两次续期之间被浏览器回收，留下无人释放的锁（这正是自动同步长传输失败的根因）。
const RENEW_INTERVAL_MS = 20 * 1000;
// 锁 TTL 略大于续期间隔即可：任务被回收后能较快自动过期，避免死锁卡住后续同步。
const LOCK_TTL_MS = 60 * 1000;

/** 清理已过期（owner 已不存在）的 WebDAV 操作锁，供 Service Worker 启动时调用。 */
export const clearStaleWebDavOperationLock = async (): Promise<void> => {
  const current = await browser.storage.local.get(WEBDAV_OPERATION_LOCK);
  const lock = current[WEBDAV_OPERATION_LOCK] as { owner?: string; expiresAt?: number } | undefined;
  if (lock && typeof lock.expiresAt === "number" && lock.expiresAt <= Date.now()) {
    await browser.storage.local.remove(WEBDAV_OPERATION_LOCK);
  }
};

export const withWebDavOperationLock = async <T>(task: () => Promise<T>): Promise<T> => {
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const current = await browser.storage.local.get(WEBDAV_OPERATION_LOCK);
  const lock = current[WEBDAV_OPERATION_LOCK] as { owner: string; expiresAt: number } | undefined;
  if (lock && lock.expiresAt > Date.now()) {
    throw new Error("WebDAV 操作正在进行中，请稍后再试");
  }
  await browser.storage.local.set({
    [WEBDAV_OPERATION_LOCK]: { owner, expiresAt: Date.now() + LOCK_TTL_MS },
  });

  // 20s 心跳：storage API 调用会重置 SW 空闲计时器，既续期锁又保活，避免长传输中途被回收。
  const renewInterval = setInterval(() => {
    void (async () => {
      const latest = await browser.storage.local.get(WEBDAV_OPERATION_LOCK);
      const currentLock = latest[WEBDAV_OPERATION_LOCK] as { owner?: string } | undefined;
      if (currentLock?.owner === owner) {
        await browser.storage.local.set({
          [WEBDAV_OPERATION_LOCK]: { owner, expiresAt: Date.now() + LOCK_TTL_MS },
        });
      }
    })();
  }, RENEW_INTERVAL_MS);

  try {
    return await task();
  } finally {
    clearInterval(renewInterval);
    const latest = await browser.storage.local.get(WEBDAV_OPERATION_LOCK);
    if ((latest[WEBDAV_OPERATION_LOCK] as { owner?: string } | undefined)?.owner === owner) {
      await browser.storage.local.remove(WEBDAV_OPERATION_LOCK);
    }
  }
};

/**
 * 构造 Basic Auth 请求头
 */
const getAuthHeaders = (config: WebDavConfig): Record<string, string> => {
  const credentials = btoa(`${config.username}:${config.password}`);
  return {
    Authorization: `Basic ${credentials}`,
  };
};

/**
 * 拼接完整的 WebDAV URL
 */
const getFullUrl = (config: WebDavConfig, filename?: string): string => {
  let url = config.serverUrl.replace(/\/+$/, "");
  let path = config.basePath.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = "/" + path;
  url = url + path;
  if (filename) {
    url = url + "/" + filename;
  }
  // 确保目录路径以 / 结尾
  if (!filename && !url.endsWith("/")) {
    url = url + "/";
  }
  return url;
};

/**
 * WebDAV 的 GET/PROPFIND 必须始终反映服务器最新状态。
 * 部分服务端只返回 Last-Modified/ETag 而不给 Cache-Control，浏览器会启用启发式缓存，
 * 导致反复读到过期甚至损坏的旧文件（参见 issue #33）。这里统一禁用缓存。
 */
const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
};

/** 覆盖前保留的上一版本文件后缀（P2） */
export const PREV_VERSION_SUFFIX = ".prev";
/** 校验信息 sidecar 文件后缀（P2） */
export const META_SUFFIX = ".meta";

/** 单个 WebDAV 请求超时，避免网络卡死时占着锁一直等到调用方被回收 */
const REQUEST_TIMEOUT_MS = 180 * 1000;

interface WebDavFileMeta {
  /** 解压后的原始字节数 */
  size: number;
  /** 解压后内容的 sha256 */
  sha256: string;
  /** 传输编码 */
  encoding?: "gzip" | "identity";
  /** 实际传输（编码后）的字节数 */
  compressedSize?: number;
  updatedAt: number;
}

const sha256Bytes = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const toByteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

// 仅用于读取早期版本写入的 gzip 备份；新上传一律明文。
const isGzipBytes = (bytes: Uint8Array): boolean =>
  bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

const gunzipBytes = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** 带超时的 fetch，避免请求卡死时无限占用锁并等到 SW 被回收。 */
const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 读取远端文件大小（PROPFIND Depth:0，解析 getcontentlength）。
 * 文件不存在或无法解析时返回 null。
 */
export const getRemoteFileSize = async (
  config: WebDavConfig,
  filename: string,
): Promise<number | null> => {
  try {
    const response = await fetchWithTimeout(getFullUrl(config, filename), {
      method: "PROPFIND",
      headers: {
        ...getAuthHeaders(config),
        ...NO_CACHE_HEADERS,
        Depth: "0",
      },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (response.status !== 207 && !response.ok) return null;
    const xml = await response.text();
    const match = xml.match(/<[^>]*getcontentlength[^>]*>(\d+)</i);
    return match ? Number(match[1]) : null;
  } catch (error) {
    console.warn(`WebDAV 获取远端文件大小 ${filename} 失败:`, error);
    return null;
  }
};

/**
 * 远端复制文件（WebDAV COPY），用于覆盖前保留上一版本。
 * 源文件不存在或服务端不支持 COPY 时返回 false。
 */
export const copyRemoteFile = async (
  config: WebDavConfig,
  source: string,
  destination: string,
): Promise<boolean> => {
  try {
    const response = await fetchWithTimeout(getFullUrl(config, source), {
      method: "COPY",
      headers: {
        ...getAuthHeaders(config),
        Destination: getFullUrl(config, destination),
        Overwrite: "T",
      },
      cache: "no-store",
    });
    return response.status === 200 || response.status === 201 || response.status === 204;
  } catch (error) {
    console.warn(`WebDAV 复制文件 ${source} -> ${destination} 失败:`, error);
    return false;
  }
};

const downloadFileMeta = async (
  config: WebDavConfig,
  filename: string,
): Promise<WebDavFileMeta | null> => {
  try {
    const response = await fetchWithTimeout(getFullUrl(config, `${filename}${META_SUFFIX}`), {
      method: "GET",
      headers: {
        ...getAuthHeaders(config),
        ...NO_CACHE_HEADERS,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const parsed = JSON.parse(await response.text()) as WebDavFileMeta;
    if (typeof parsed?.size !== "number" || typeof parsed?.sha256 !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * 测试 WebDAV 连接
 * @returns true 表示连接成功
 */
export const testConnection = async (config: WebDavConfig): Promise<boolean> => {
  try {
    const url = getFullUrl(config);
    const response = await fetchWithTimeout(url, {
      method: "PROPFIND",
      headers: {
        ...getAuthHeaders(config),
        ...NO_CACHE_HEADERS,
        Depth: "0",
      },
      cache: "no-store",
    });
    // 207 Multi-Status 表示成功
    // 404 表示路径不存在但连接正常（后续会自动创建）
    return response.status === 207 || response.status === 200 || response.status === 404;
  } catch (error) {
    console.error("WebDAV 连接测试失败:", error);
    return false;
  }
};

/**
 * 确保远程目录存在（MKCOL）
 */
export const ensureDirectory = async (config: WebDavConfig): Promise<boolean> => {
  try {
    const url = getFullUrl(config);
    const response = await fetchWithTimeout(url, {
      method: "MKCOL",
      headers: getAuthHeaders(config),
    });
    // 201 Created 或 405 Method Not Allowed（目录已存在）都表示成功
    return (
      response.status === 201 ||
      response.status === 405 ||
      response.status === 301 ||
      response.status === 200
    );
  } catch (error) {
    console.error("WebDAV 创建目录失败:", error);
    return false;
  }
};

/**
 * 上传文件到 WebDAV
 */
export const uploadFile = async (
  config: WebDavConfig,
  filename: string,
  data: string,
): Promise<boolean> => {
  try {
    const plainBytes = new TextEncoder().encode(data);
    const expectedSize = plainBytes.byteLength;

    // 覆盖前保留上一版本（尽力而为：源文件不存在或服务端不支持 COPY 时忽略）
    await copyRemoteFile(config, filename, `${filename}${PREV_VERSION_SUFFIX}`);

    const response = await fetchWithTimeout(getFullUrl(config, filename), {
      method: "PUT",
      headers: {
        ...getAuthHeaders(config),
        "Content-Type": "application/json; charset=utf-8",
        ...NO_CACHE_HEADERS,
      },
      body: data,
      cache: "no-store",
    });
    // 201 Created 或 204 No Content 表示成功
    if (!(response.status === 201 || response.status === 204 || response.status === 200)) {
      return false;
    }

    // 上传后校验远端大小：避免中断写入半截文件却当作成功
    const remoteSize = await getRemoteFileSize(config, filename);
    if (remoteSize !== null && remoteSize !== expectedSize) {
      console.error(
        `WebDAV 上传文件 ${filename} 校验失败: 远端 ${remoteSize} 字节，本地 ${expectedSize} 字节`,
      );
      return false;
    }

    // 写入校验信息 sidecar（记录解压后的大小与哈希），供下载端核对完整性
    try {
      const meta: WebDavFileMeta = {
        size: expectedSize,
        sha256: await sha256Bytes(plainBytes),
        encoding: "identity",
        compressedSize: expectedSize,
        updatedAt: Date.now(),
      };
      await fetchWithTimeout(getFullUrl(config, `${filename}${META_SUFFIX}`), {
        method: "PUT",
        headers: {
          ...getAuthHeaders(config),
          "Content-Type": "application/json; charset=utf-8",
          ...NO_CACHE_HEADERS,
        },
        body: JSON.stringify(meta),
        cache: "no-store",
      });
    } catch (metaError) {
      console.warn(`WebDAV 写入校验信息 ${filename}${META_SUFFIX} 失败:`, metaError);
    }

    return true;
  } catch (error) {
    console.error(`WebDAV 上传文件 ${filename} 失败:`, error);
    return false;
  }
};

/**
 * 从 WebDAV 下载文件
 * @returns 文件内容字符串，不存在则返回 null
 */
export const downloadFile = async (
  config: WebDavConfig,
  filename: string,
): Promise<string | null> => {
  try {
    const url = getFullUrl(config, filename);
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        ...getAuthHeaders(config),
        ...NO_CACHE_HEADERS,
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`WebDAV 下载文件 ${filename} 失败: HTTP ${response.status}`);
    }

    const transferBytes = new Uint8Array(await response.arrayBuffer());

    // 传输完整性校验：非压缩响应下，声明长度必须与实际传输字节数一致
    const contentEncoding = response.headers.get("content-encoding");
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && (!contentEncoding || contentEncoding === "identity")) {
      const expected = Number(declaredLength);
      if (Number.isFinite(expected) && expected !== transferBytes.byteLength) {
        throw new Error(
          `WebDAV 下载文件 ${filename} 不完整: 声明 ${expected} 字节，实际 ${transferBytes.byteLength} 字节`,
        );
      }
    }

    // 兼容明文与 gzip：靠 magic bytes 自动识别，旧备份（明文）也能直接读
    const contentBytes = isGzipBytes(transferBytes)
      ? await gunzipBytes(transferBytes)
      : transferBytes;
    const text = new TextDecoder().decode(contentBytes);

    // 如存在 sidecar 校验信息，核对解压后的大小与哈希；不一致只告警，交由上层尝试修复
    const meta = await downloadFileMeta(config, filename);
    if (
      meta &&
      (meta.size !== contentBytes.byteLength || meta.sha256 !== (await sha256Bytes(contentBytes)))
    ) {
      console.warn(`WebDAV 下载文件 ${filename} 校验信息不匹配，内容可能已损坏`);
    }

    return text;
  } catch (error) {
    console.error(`WebDAV 下载文件 ${filename} 失败:`, error);
    throw error;
  }
};
