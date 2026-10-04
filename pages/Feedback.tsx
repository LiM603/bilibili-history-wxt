const ISSUES_URL = "https://github.com/LiM603/bilibili-history-wxt/issues";

const Feedback = () => {
  return (
    <div className="max-w-[800px] mx-auto p-6">
      <h2 className="text-3xl font-semibold mb-3">建议反馈</h2>

      <section className="mt-10">
        <h2 className="text-xl mb-3">GitHub Issues</h2>
        <p className="text-gray-600 dark:text-neutral-400 text-base mb-4">
          自用版的问题与建议请通过 GitHub Issues 提交。
        </p>
        <a
          href={ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-500 text-white font-medium transition-colors hover:bg-pink-600"
        >
          打开 GitHub Issues
        </a>
        <p className="text-gray-500 dark:text-neutral-500 text-sm mt-4 break-all">{ISSUES_URL}</p>
      </section>
    </div>
  );
};

export default Feedback;
