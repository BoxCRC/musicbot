---
name: kook-music-bot-netease
overview: 在空工作区中规划一个基于 Node.js + TypeScript 的 KOOK 点歌机器人，支持在文字频道下发指令控制语言频道播放，并使用网易云音乐作为搜索与播放来源。首版面向 Windows 本地运行，包含点歌、暂停/继续、切歌、停止清空、查看队列、当前播放等核心能力。
todos:
  - id: init-project
    content: 初始化 TypeScript 项目与本地配置模板
    status: completed
  - id: build-bot-core
    content: 搭建 KOOK 客户端与文字指令路由
    status: completed
    dependencies:
      - init-project
  - id: add-netease-source
    content: 实现网易云搜索解析与歌曲元数据封装
    status: completed
    dependencies:
      - init-project
  - id: implement-playback
    content: 实现语音会话、播放队列与控制指令
    status: completed
    dependencies:
      - build-bot-core
      - add-netease-source
  - id: document-verify
    content: 补充 README、本地启动说明与回归验证
    status: completed
    dependencies:
      - implement-playback
---

## User Requirements

- 制作一个 KOOK 语音频道点歌机器人。
- 用户在文字频道发送中文指令完成点歌和播放控制。
- 音乐来源使用网易云音乐，允许通过第三方方案完成搜索与可播链接获取。
- 首版以 Windows 本地运行为主，不包含云部署和 Docker 要求。

## Product Overview

- 机器人在文字频道接收命令，并在用户所在的语音频道内播放音乐。
- 点歌时按关键词搜索网易云，选择首个可播放结果加入队列并开始播放。
- 文字频道内展示简洁的播放反馈，包括歌曲信息、队列位置、当前播放状态和错误提示。

## Core Features

- 点歌播放：支持通过关键词搜索网易云并加入播放队列，必要时自动进入用户所在语音频道。
- 播放控制：支持暂停、继续、切歌、停止并清空队列。
- 队列反馈：支持查看当前播放歌曲与排队列表。
- 异常提示：当用户不在语音频道、歌曲无可播链接、队列为空或播放失败时，返回明确提示。

## Tech Stack Selection

- 运行时：Node.js + TypeScript
- 包管理：npm
- 机器人接入：选择支持 KOOK 消息事件与语音连接的维护中 SDK，并通过适配层隔离具体实现
- 音频处理：FFmpeg 负责转码与稳定推流
- 音源接入：网易云搜索与播放地址解析使用第三方封装方案
- 配置管理：`.env` 环境变量加载与校验
- 日志方案：轻量结构化控制台日志
- 运行目标：Windows 本地开发与启动

## Implementation Approach

- 当前工作区为空，方案采用从零搭建的模块化 Node.js 项目，按“文字命令层、音源服务层、语音播放层、会话状态层”拆分，避免把搜索、队列、播放逻辑耦合在一起。
- 机器人收到文字频道命令后，先校验用户语音状态，再调用网易云服务搜索歌曲，解析可播地址并写入当前服务器的播放队列；若播放器空闲则自动连接语音频道并开始播放，播放结束后自动推进下一首。
- 关键决策：
- 使用“每个服务器一套播放会话和队列”，避免不同服务器之间互相干扰，扩展多服务器时只需新增会话实例。
- 首版关键词点歌默认选择第一个可播放结果，减少交互复杂度；后续如需点选结果，可在现有搜索服务上继续扩展。
- 使用流式播放而不是整首下载，降低磁盘占用和内存压力，减少本地文件清理复杂度。
- 将 KOOK SDK 与语音播放细节封装到适配层，若未来需要替换 SDK 或补充更多语音能力，改动范围可控。
- 性能与可靠性：
- 搜索只拉取少量候选并在找到首个可播结果后立即停止，减少外部请求开销。
- 队列入队和出队为 O(1)，查看队列为 O(n)，满足点歌场景需求。
- 每个服务器只维护一个活动播放器实例，播放结束、断线或空闲超时后及时释放会话，避免连接泄漏。
- 外部接口超时、版权限制、FFmpeg 异常退出时，跳过当前歌曲并回写错误信息，不让整个机器人进程崩溃。

## Implementation Notes

- 指令名称、别名和提示文案应集中管理，避免散落在多个模块中难以维护。
- 所有敏感信息仅从环境变量读取，日志中禁止输出 Bot Token 和原始播放链接。
- 对“用户不在语音频道”“机器人已在其他语音频道”“队列为空”“歌曲不可播”等情况统一返回稳定提示。
- 优先复用单一会话注册表管理全局状态，避免引入多处可变全局变量。
- README 需明确说明 Windows 环境依赖，特别是 FFmpeg 可执行文件准备方式和启动步骤。
- 保持首版范围聚焦，不引入无关的 Web 面板、数据库持久化或复杂权限系统。

## Architecture Design

### 模块关系

- 入口层：启动配置加载、机器人实例初始化、全局事件绑定。
- 命令层：解析文字频道消息、识别前缀命令、路由到对应处理器。
- 音源层：负责网易云关键词搜索、歌曲元数据整理、可播地址解析。
- 播放层：负责语音连接、音频流创建、播放状态切换与自动续播。
- 状态层：按服务器维护队列、当前歌曲、文本频道上下文和语音连接状态。
- 通用层：提供日志、错误封装、配置读取和通用提示文案。

### 数据流

- 文字频道命令
- 命令解析与参数校验
- 用户语音状态校验
- 网易云搜索与可播地址解析
- 写入服务器队列
- 创建或复用语音会话
- 播放音频并回写文字频道状态
- 播放结束后自动切换下一首

## Directory Structure

### 目录结构摘要

当前工作区为空，计划从零创建以下结构：

- `package.json` [NEW]：项目依赖、启动脚本、构建脚本与开发脚本配置。
- `tsconfig.json` [NEW]：TypeScript 编译目标、路径规则与输出目录配置。
- `.gitignore` [NEW]：忽略编译产物、环境变量文件与临时文件。
- `.env.example` [NEW]：提供 KOOK Token、命令前缀、日志级别、搜索数量等示例配置。
- `README.md` [NEW]：说明安装步骤、Windows 本地运行方式、FFmpeg 准备、指令示例与常见问题。

- `src/index.ts` [NEW]：应用入口，负责加载配置、创建机器人实例并注册退出清理逻辑。
- `src/config/env.ts` [NEW]：读取并校验环境变量，统一导出运行配置。
- `src/shared/logger.ts` [NEW]：统一日志输出，控制级别并避免敏感信息泄露。
- `src/shared/messages.ts` [NEW]：集中维护用户可见提示文案和公共回复模板。

- `src/bot/client.ts` [NEW]：封装 KOOK 客户端创建、生命周期事件和基础监听。
- `src/bot/message-router.ts` [NEW]：解析文字消息前缀、拆分命令参数并分发到具体指令处理器。
- `src/bot/commands/play.ts` [NEW]：处理点歌命令，完成搜索、入队、自动播放与结果反馈。
- `src/bot/commands/pause.ts` [NEW]：处理暂停命令并同步播放状态。
- `src/bot/commands/resume.ts` [NEW]：处理继续命令并恢复播放。
- `src/bot/commands/skip.ts` [NEW]：处理切歌命令，停止当前歌曲并推进下一首。
- `src/bot/commands/stop.ts` [NEW]：处理停止命令，清空队列并断开语音连接。
- `src/bot/commands/queue.ts` [NEW]：处理查看队列命令，输出排队列表。
- `src/bot/commands/now-playing.ts` [NEW]：处理当前播放命令，输出当前歌曲状态。

- `src/music/types.ts` [NEW]：定义歌曲信息、播放会话、队列项等核心类型。
- `src/music/queue-manager.ts` [NEW]：维护按服务器隔离的队列注册表，提供入队、出队、清空、读取能力。
- `src/music/session-manager.ts` [NEW]：管理语音连接、当前文本频道上下文和会话生命周期。
- `src/music/player.ts` [NEW]：负责创建音频流、驱动播放器状态流转、处理结束和异常事件。

- `src/services/netease-service.ts` [NEW]：封装网易云关键词搜索、歌曲元数据整理和可播地址获取逻辑。
- `src/services/audio-source.ts` [NEW]：根据可播地址创建适合播放器消费的音频流输入，隔离 FFmpeg 细节。