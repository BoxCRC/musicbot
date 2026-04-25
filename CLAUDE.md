# 项目规则

## 项目概述

KOOK 语音频道网易云点歌机器人，基于 kasumi.js (KOOK SDK) + koice (语音) + NeteaseCloudMusicApi (网易云音乐 API) 构建。

## 核心规则

### 文档参考优先

涉及以下场景时，**必须优先查阅** `docs/` 目录下的对应文档，不要凭记忆或猜测实现：

- **调用网易云音乐 API 接口** → 参考 [docs/netease-api/](docs/netease-api/) 下的文档
  - 接口列表和分类：[02-api-endpoints.md](docs/netease-api/02-api-endpoints.md)
  - TypeScript 类型和参数：[03-typescript-types.md](docs/netease-api/03-typescript-types.md)
  - 模块文件名索引：[04-module-index.md](docs/netease-api/04-module-index.md)
  - 安装和使用方式：[01-overview.md](docs/netease-api/01-overview.md)
- **涉及 KOOK API 或消息卡片** → 参考 [docs/kook-api-reference.md](docs/kook-api-reference.md)

### 接口调用规范

1. 使用 `NeteaseCloudMusicApi` 的接口时，先确认模块文件名是否存在于 [04-module-index.md](docs/netease-api/04-module-index.md)
2. 确认接口的参数类型定义，参考 [03-typescript-types.md](docs/netease-api/03-typescript-types.md) 中的枚举和接口签名
3. 接口返回值统一为 `Promise<Response>`，包含 `status`、`body`、`cookie` 三个字段

### 代码风格

- TypeScript 严格模式
- 使用 `zod` 进行参数校验
- 使用项目中的 `shared/logger.ts` 进行日志输出
- 所有回答和注释使用中文

### 目录结构

```
src/
  bot/           # KOOK 机器人命令和消息处理
    commands/    # 播放、暂停、跳过等命令
    client.ts    # KOOK 客户端初始化
    message-router.ts  # 消息路由
  config/        # 环境变量配置
  dashboard/     # Web 控制面板
  music/         # 音乐播放核心逻辑
    player.ts    # 播放器
    queue-manager.ts   # 队列管理
    session-manager.ts # 会话管理
  services/      # 外部服务封装
    netease-service.ts     # 网易云 API 封装
    netease-auth.ts        # 网易云登录认证
    audio-source.ts        # 音频源获取
  shared/        # 工具函数和通用模块
    cards.ts     # KOOK 消息卡片构建
    commands.ts  # 命令定义
    logger.ts    # 日志工具
    messages.ts  # 消息模板
```

### 构建与运行

```bash
npm run dev      # 开发模式 (tsx watch)
npm run build    # TypeScript 编译
npm run check    # 类型检查
npm run start    # 运行编译产物
npm run login    # 网易云登录脚本
```
