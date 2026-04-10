# KOOK 网易云点歌机器人

在 KOOK 文字频道发送指令，机器人自动加入用户所在语音频道并播放网易云音乐。

**功能特性：**
- 🎵 搜索并播放网易云音乐
- 🔊 支持高音质播放（最高无损音质）
- 👤 支持网易云账号登录，播放 VIP 歌曲
- 📋 队列管理：暂停、继续、切歌、查看队列

---

## 更新日志

### v1.1.0
- ✨ **网易云登录支持**：配置账号后可播放 VIP 歌曲
- 🎧 **音质提升**：优先请求无损音质，ffmpeg 输出 320kbps
- 🔧 **配置优化**：新增 `NETEASE_PHONE`、`NETEASE_PASSWORD`、`NETEASE_COOKIE` 环境变量

---

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js ≥ 18 | 原生支持 ESM / async iterator |
| 语言 | TypeScript 5 | 全量类型约束，`strict` 模式 |
| KOOK SDK | [kasumi.js](https://www.npmjs.com/package/kasumi.js) | WebSocket 长连接、消息事件、REST API 封装 |
| 语音推流 | [koice](https://www.npmjs.com/package/koice) | 向 KOOK 语音频道推送 PCM/MP3 字节流 |
| 音频转码 | ffmpeg（系统安装） | 将网易云 HTTP 音频流转码为 48 kHz 立体声 MP3，通过 `pipe:1` 输出到 koice |
| 音乐数据 | [NeteaseCloudMusicApi](https://www.npmjs.com/package/NeteaseCloudMusicApi) | 网易云非官方 Node.js 封装，提供搜索与播放链接获取 |
| 配置管理 | dotenv + zod | 读取 `.env` 并做 Schema 校验，启动时快速失败 |
| 开发工具 | tsx | 免编译直接运行 TypeScript，支持 `watch` 热重载 |

---

## 目录结构

```
src/
├── index.ts                  # 程序入口：组装依赖、注册事件、处理退出信号
├── config/
│   └── env.ts                # 读取并校验环境变量，导出 AppConfig
├── shared/
│   ├── commands.ts           # 指令名称与别名常量表
│   ├── logger.ts             # 轻量层级日志（ConsoleLogger，支持 child scope）
│   └── messages.ts           # 所有用户可见文案的集中管理
├── bot/
│   ├── client.ts             # 创建 Kasumi WebSocket 客户端并连接
│   ├── message-router.ts     # 解析前缀指令、分发到各指令处理函数
│   └── commands/             # 每条指令一个文件
│       ├── types.ts          # 指令上下文类型 CommandContext
│       ├── play.ts
│       ├── pause.ts
│       ├── resume.ts
│       ├── skip.ts
│       ├── stop.ts
│       ├── queue.ts
│       └── now-playing.ts
├── music/
│   ├── types.ts              # 核心数据类型：PlaybackTrack / GuildMusicSession
│   ├── queue-manager.ts      # 操作 session.queue 的纯函数封装
│   ├── session-manager.ts    # 按 guildId 维护播放会话的 Map
│   └── player.ts             # 播放核心：搜索 → 入队 → 连接语音 → 推流 → 熔断
└── services/
    ├── audio-source.ts       # 启动 ffmpeg 子进程，将 HTTP 流转为字节块推给 koice
    ├── netease-service.ts    # 调用 NeteaseCloudMusicApi：搜索 + 登录 + 获取播放 URL
    └── netease-auth.ts       # 网易云账号认证管理器
```

---

## 核心数据流

```
用户在文字频道发送消息
        │
        ▼
  MessageRouter.handle()
  ① 过滤 Bot 自身消息
  ② 检查指令前缀（COMMAND_PREFIX）
  ③ 按别名表匹配 CommandKey
  ④ 调用对应指令处理函数
        │
        ▼（以 !点歌 为例）
  Player.play(guildId, textChannelId, userId, keyword)
  ① channel.user.joinedChannel(guildId, userId)
     → 调用 KOOK API /channel-user/get-joined-channel
     → 获取用户当前所在语音频道 ID
  ② NeteaseService.searchFirstPlayable(keyword)
     → cloudsearch(type=1) 搜索单曲列表
     → 逐首调用 song_url 获取播放链接，跳过无链接歌曲
     → 返回第一首可播放的 PlaybackTrack
  ③ QueueManager.enqueue(session, track)
     → 压入 session.queue
  ④ 如果队列此前为空 → 立即调用 playNext()
        │
        ▼
  Player.playNext()
  ① Koice.create(client, voiceChannelId) 加入语音频道
  ② createAudioSource(track, ffmpegPath)
     → spawn ffmpeg -i <音频URL> ... pipe:1
     → stdout data 事件 → connection.push(chunk)
  ③ 监听 source "closed" 事件
     → reason=finished/skip → 播放下一首
     → reason=stop        → 断开连接
     → reason=error (ENOENT) → 识别 ffmpeg 缺失，停止并提示
     → reason=error (其他)   → consecutiveErrors++，≥3 次熔断
```

---

## 配置说明（.env）

复制 `.env.example` 为 `.env`，填入以下字段：

```env
# 必填：KOOK 机器人 Token（在 https://developer.kookapp.cn 创建机器人后获取）
KOOK_BOT_TOKEN=your_token_here

# 指令前缀，默认 !
COMMAND_PREFIX=!

# 搜索结果取前 N 首中首个可播放的，默认 5
NETEASE_SEARCH_LIMIT=5

# 日志级别：debug | info | warn | error
LOG_LEVEL=info

# ffmpeg 可执行文件路径
# 如果已加入系统 PATH，填 ffmpeg 即可
# 否则填绝对路径，例如：C:\ffmpeg\bin\ffmpeg.exe
FFMPEG_PATH=ffmpeg

# 队列空后多少秒自动离开语音频道，0 = 不自动断开
IDLE_DISCONNECT_SECONDS=120

# ========================================
# 网易云音乐登录配置（可选）
# 配置后可播放 VIP 歌曲、无损音质
# ========================================

# 方式一：手机号+密码登录
# NETEASE_PHONE=13800138000
# NETEASE_PASSWORD=your_password

# 方式二：直接使用 Cookie（推荐，登录成功后会输出）
# NETEASE_COOKIE=your_cookie_here
```

### 网易云登录说明

配置网易云账号后，机器人可以：

1. **播放 VIP 歌曲**：解锁需要会员才能播放的歌曲
2. **更高音质**：优先获取无损（FLAC）甚至 Hi-Res 音质

**登录方式：**

| 方式 | 配置项 | 说明 |
|------|--------|------|
| 手机号+密码 | `NETEASE_PHONE` + `NETEASE_PASSWORD` | 每次启动时自动登录 |
| Cookie | `NETEASE_COOKIE` | 手动填入登录后的 Cookie，避免频繁登录 |

> 💡 **提示**：首次使用手机号登录成功后，日志会输出 Cookie，将其保存到 `.env` 的 `NETEASE_COOKIE` 可避免频繁登录导致账号风控。

---

## 本地启动

### 前置要求

- Node.js ≥ 18
- ffmpeg（[下载地址](https://www.gyan.dev/ffmpeg/builds/)，或 `winget install Gyan.FFmpeg`）

### 步骤

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
copy .env.example .env
# 编辑 .env，填入 KOOK_BOT_TOKEN 和 FFMPEG_PATH

# 3. 开发模式（热重载）
npm run dev

# 4. 生产模式
npm run build
npm start
```

---

## 可用指令

| 指令 | 别名 | 说明 |
|------|------|------|
| `!点歌 <关键词>` | `!播放`、`!play` | 搜索并加入播放队列 |
| `!暂停` | `!pause` | 暂停当前播放 |
| `!继续` | `!恢复`、`!resume` | 继续播放 |
| `!切歌` | `!下一首`、`!skip`、`!next` | 跳过当前歌曲 |
| `!停止` | `!停播`、`!清空`、`!stop` | 停止播放并清空队列 |
| `!队列` | `!歌单`、`!queue`、`!list` | 查看当前播放队列 |
| `!当前播放` | `!正在播放`、`!np` | 查看正在播放的歌曲 |

> 前缀可在 `.env` 的 `COMMAND_PREFIX` 中修改。

---

## 关键模块说明

### `MessageRouter`

负责将原始消息字符串转换为结构化指令调用。

- 构造时将 `COMMANDS` 中所有别名注册到 `commandAliasMap`（`alias → CommandKey`）
- 收到消息后：去除前缀 → 提取指令词 → 查别名表 → `switch` 分发
- 所有指令处理函数接收统一的 `CommandContext { event, player, commandPrefix }`

### `Player`

业务核心，负责协调语音连接与播放生命周期。

- **`play()`**：调用 KOOK API 确认用户所在语音频道 → 搜索歌曲 → 入队 → 触发播放
- **`playNext()`**：出队 → `ensureConnection()` 复用或新建 koice 连接 → 创建 `AudioSource`
- **`handleSourceClosed()`**：统一处理播放结束事件，区分正常结束、主动停止、错误三种场景
- **错误熔断**：`consecutiveErrors` 字段记录连续失败次数，≥3 次自动停止队列；`ENOENT` 直接识别为 ffmpeg 缺失，立即停止并发送友好提示

### `SessionManager`

用 `Map<guildId, GuildMusicSession>` 管理每个服务器的独立播放状态，保证多服务器间互不干扰。

`GuildMusicSession` 核心字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `queue` | `PlaybackTrack[]` | 待播队列 |
| `currentTrack` | `PlaybackTrack` | 当前歌曲 |
| `connection` | `Koice` | 语音连接实例 |
| `source` | `ActiveAudioSource` | ffmpeg 推流实例 |
| `state` | `idle/buffering/playing/paused` | 播放状态 |
| `consecutiveErrors` | `number` | 连续失败计数（熔断用） |
| `idleTimer` | `Timeout` | 空闲自动断开定时器 |

### `FfmpegAudioSource`（`audio-source.ts`）

封装 ffmpeg 子进程生命周期：

- `spawn ffmpeg -i <url> ... -b:a 320k -q:a 0 -f mp3 pipe:1`：从 HTTP 拉流并转码为高质量 MP3
  - `-b:a 320k`：输出比特率 320kbps
  - `-q:a 0`：最高质量编码
  - `-ar 48000`：48kHz 采样率
  - `-ac 2`：立体声
- `stdout.on("data")` → `connection.push(chunk)` 实时推给 koice
- 支持 `pause()`（暂停 stdout 读取）/ `resume()` / `stop()`
- `process.once("error")` 捕获 `ENOENT` 等系统级错误
- `process.once("close")` 判断退出码，非 0 则带 stderr 输出构造错误信息

### `NeteaseService`

网易云音乐 API 封装，支持登录态和高音质获取：

- **登录功能**：
  - `login(phone, password)`：手机号+密码登录，密码自动 MD5 加密
  - `setCookie(cookie)`：直接设置登录态 Cookie
  - `checkLoginStatus()`：检查当前登录状态

- **音乐获取**：
  - `searchFirstPlayable(keyword)`：`cloudsearch(type=1)` 搜索单曲，自动选择可播放的歌曲
  - `resolvePlayableUrl(songId)`：获取歌曲播放链接
    - 已登录：优先尝试 Hi-Res → 无损 → 极高音质
    - 未登录：请求最高可用码率（最高 999kbps）

### `NeteaseAuthService`

网易云音乐认证管理器：

- 启动时自动检查登录配置
- 支持 Cookie 恢复登录态（推荐，避免频繁登录）
- 支持手机号+密码登录
- 登录成功后输出 Cookie 供保存

---

## 扩展开发指引

### 新增一条指令

1. 在 `src/shared/commands.ts` 的 `COMMANDS` 对象中添加新 key 和别名
2. 在 `src/bot/commands/` 下新建对应文件，导出 `handle*Command(ctx, ...args)` 函数
3. 在 `src/bot/message-router.ts` 的 `switch` 中添加新 `case`
4. 在 `Player` 中实现对应业务方法

### 替换音乐源

只需重写 `src/services/netease-service.ts`，保持 `searchFirstPlayable()` 返回 `PlaybackTrack` 类型不变，其余代码无需改动。

### 调整 ffmpeg 转码参数

修改 `src/services/audio-source.ts` 中 `start()` 方法的 `args` 数组，例如调整采样率、码率或输出格式。
