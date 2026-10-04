import React, { useEffect, useState } from "react";
import { UPDATE_HISTORY } from "../utils/constants";

const ORIGINAL_REPO = "https://github.com/mundane799699/bilibili-history-wxt";

export const About: React.FC = () => {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    // 兼容 Chrome/Firefox
    const manifest = browser?.runtime?.getManifest?.();
    if (manifest?.version) {
      setVersion(manifest.version);
    }
  }, []);

  return (
    <div className="max-w-[800px] mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">关于 无限历史记录（自用版）</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">项目说明</h2>
          <div className="text-gray-600 text-base space-y-4">
            <p>
              本项目是一个<strong>个人自用</strong>的浏览器扩展，与原作者的项目
              <a
                className="text-blue-500 mx-1"
                href={ORIGINAL_REPO}
                target="_blank"
                rel="noopener noreferrer"
              >
                mundane799699/bilibili-history-wxt
              </a>
              相互独立、各自维护。自用版在原项目基础上做了针对性的调整与修复，不代表原项目，也不提供任何官方支持。
            </p>
            {version && <p className="text-sm text-gray-400">当前版本：v{version}</p>}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">简介</h2>
          <div className="text-gray-600 text-base space-y-4">
            <p>
              由于 b
              站本身的历史记录有存储上限，而我希望可以查看更久远的历史记录，所以维护了这个自用版本。
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">功能特点</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2 text-base">
            <li>突破 Bilibili 历史记录的数量限制</li>
            <li>支持按时间排序浏览历史记录</li>
            <li>支持搜索历史记录</li>
            <li>每隔60分钟自动增量的同步一次历史记录</li>
            <li>所有数据都存储在本地 indexedDB</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">使用说明</h2>
          <ol className="list-decimal list-inside text-gray-600 space-y-2 text-base">
            <li>登录 b 站网页版</li>
            <li>安装扩展后，点击扩展图标</li>
            <li>首次点击立即同步按钮会全量同步你的 Bilibili 观看历史</li>
            <li>同步完成后，点击打开历史记录页面按钮，即可查看历史记录</li>
            <li>可以使用搜索框搜索特定的历史记录</li>
            <li>向下滚动可以加载更多历史记录</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">隐私说明</h2>
          <p className="text-gray-600 text-base">
            本扩展仅用于同步和展示你的 Bilibili
            观看历史，所有数据都存储在本地，不会上传到任何服务器。
            我们不会收集任何个人信息或浏览数据。
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">开源与继承说明</h2>
          <p className="text-gray-600 text-base">
            本项目遵循 MIT 协议，代码继承自原项目
            <a
              className="text-blue-500 mx-1"
              href={ORIGINAL_REPO}
              target="_blank"
              rel="noopener noreferrer"
            >
              mundane799699/bilibili-history-wxt
            </a>
            。本仓库为个人自用分支，仅保留本地保存、WebDAV 同步与 AI
            检索等自用功能，不参与原项目的推广与运营；如需反馈问题，请通过「反馈」页面提交。
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">更新日志</h2>
          <ul className="space-y-8">
            {UPDATE_HISTORY.map((release) => (
              <li key={release.version}>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg">{release.version}</h2>
                  <p className="text-gray-600 text-base">{release.date}</p>
                </div>
                <ul className="list-disc list-inside text-gray-600 space-y-2 text-base">
                  {release.changes.map((change, index) => (
                    <li key={index}>{change}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
