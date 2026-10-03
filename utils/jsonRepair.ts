/**
 * 处理可能被截断的 JSON 文本。
 *
 * WebDAV 大文件在弱网、浏览器被关闭或传输中断时，可能只写入了前一部分，
 * 导致 `JSON.parse` 抛出 "Unterminated string"。这里在解析失败时回退到最后一个
 * 完整的顶层数组元素，补齐结尾的 `]` 后再解析，尽量保住已有的数据。
 */

export interface JsonRepairResult<T> {
  /** 解析后的数据；若无法修复则会抛出原始解析错误 */
  data: T;
  /** 输入是否被截断并经过修复 */
  repaired: boolean;
}

/**
 * 尝试把被截断的根数组 JSON 修复为合法 JSON 文本。
 * 仅处理根为数组的备份文件（history / favResources 等）。
 * 无法修复时返回 null。
 */
export const repairTruncatedJson = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[")) return null;

  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let lastCompleteElementEnd = -1;

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      stack.push(char);
    } else if (char === "}" || char === "]") {
      stack.pop();
      if (stack.length === 1 && stack[0] === "[") {
        lastCompleteElementEnd = i + 1;
      }
    }
  }

  if (lastCompleteElementEnd === -1) return null;
  return `${trimmed.slice(0, lastCompleteElementEnd)}]`;
};

/**
 * 先尝试直接解析；失败时尝试修复被截断的根数组再解析。
 * 两次都失败则抛出原始解析错误。
 */
export const parseJsonWithRepair = <T = unknown>(text: string): JsonRepairResult<T> => {
  try {
    return { data: JSON.parse(text) as T, repaired: false };
  } catch (originalError) {
    const repairedText = repairTruncatedJson(text);
    if (repairedText !== null) {
      try {
        return { data: JSON.parse(repairedText) as T, repaired: true };
      } catch {
        // 修复后仍无法解析，抛出原始错误
      }
    }
    throw originalError;
  }
};
