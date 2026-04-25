export const BUTTON_ACTIONS = {
  PAUSE: "pause",
  RESUME: "resume",
  SKIP: "skip",
  STOP: "stop",
} as const;

export type ButtonAction = (typeof BUTTON_ACTIONS)[keyof typeof BUTTON_ACTIONS];

// 构建按钮 value（JSON 格式）
export function buildButtonValue(action: ButtonAction): string {
  return JSON.stringify({ action });
}

// 解析按钮 value
export function parseButtonValue(value: string): ButtonAction | null {
  try {
    const data = JSON.parse(value);
    return data.action as ButtonAction;
  } catch {
    return null;
  }
}
