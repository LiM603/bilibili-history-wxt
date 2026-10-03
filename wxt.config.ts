import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "无限历史记录（自用版）",
    description:
      "自用版：不限量保存 B 站历史记录、收藏夹与喜欢的音乐，支持 WebDAV 双向同步与 AI 检索",
    permissions: [
      "unlimitedStorage",
      "storage",
      "tabs",
      "cookies",
      "alarms",
      "declarativeNetRequest",
    ],
    declarative_net_request: {
      rule_resources: [
        {
          id: "referrer-bilibili",
          enabled: true,
          path: "referrer.json",
        },
      ],
    },
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["injected.js"],
        matches: ["*://*.bilibili.com/*"],
      },
    ],
    action: {},
  },
});
