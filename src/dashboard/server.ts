import http from "http";
import os from "os";
import fs from "fs";
import nodePath from "path";
import type { Player } from "../music/player";
import type { SessionManager } from "../music/session-manager";
import type { NeteaseService } from "../services/netease-service";
import type { NeteaseAuthService } from "../services/netease-auth";
import type { GuildMusicSession } from "../music/types";
import { getRecentLogs, subscribeLog, type LogEntry } from "../shared/logger";
import type { AppLogger } from "../shared/logger";

// ── 辅助函数 ──

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function matchSessionRoute(pathname: string): {
  guildId: string;
  action?: string;
  subResource?: string;
  subId?: string;
} | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "sessions" || !parts[2]) return null;
  return {
    guildId: decodeURIComponent(parts[2]),
    action: parts[3],
    subResource: parts[3],
    subId: parts[4],
  };
}

function serializeSession(session: GuildMusicSession) {
  const elapsed = session.playbackStartedAt
    ? Math.floor((Date.now() - session.playbackStartedAt) / 1000)
    : null;
  return {
    guildId: session.guildId,
    state: session.state,
    voiceChannelName: session.voiceChannelName ?? null,
    currentTrack: session.currentTrack
      ? {
          id: session.currentTrack.id,
          title: session.currentTrack.title,
          artistNames: session.currentTrack.artistNames,
          durationMs: session.currentTrack.durationMs,
          requestedBy: session.currentTrack.requestedBy,
        }
      : null,
    queue: session.queue.map((t, i) => ({
      index: i,
      id: t.id,
      title: t.title,
      artistNames: t.artistNames,
      durationMs: t.durationMs,
      requestedBy: t.requestedBy,
    })),
    playbackStartedAt: session.playbackStartedAt ?? null,
    elapsed,
    currentLyrics: session.currentLyrics ?? null,
    queueLength: session.queue.length,
    consecutiveErrors: session.consecutiveErrors,
  };
}

function formatDuration(ms?: number): string {
  if (!ms) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── 服务器启动 ──

export function startDashboardServer(
  player: Player,
  sessionManager: SessionManager,
  neteaseService: NeteaseService,
  neteaseAuthService: NeteaseAuthService,
  port: number,
  logger: AppLogger,
): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
      // ── 静态页面 ──
      if (path === "/" && method === "GET") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(200);
        res.end(DashboardHTML);
        return;
      }

      // ── 系统状态 ──
      if (path === "/api/status" && method === "GET") {
        const memoryUsage = process.memoryUsage();
        const sessions = sessionManager.values().map((s) => ({
          guildId: s.guildId,
          state: s.state,
          currentTrack: s.currentTrack
            ? { title: s.currentTrack.title, artist: s.currentTrack.artistNames }
            : null,
          queueLength: s.queue.length,
          channelName: s.voiceChannelName || "Unknown Channel",
        }));
        jsonResponse(res, 200, {
          uptime: process.uptime(),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
          },
          cpu: os.cpus()[0].model,
          activeSessions: sessions.filter((s) => s.state === "playing").length,
          totalSessions: sessions.length,
          sessions,
        });
        return;
      }

      // ── 会话列表（含完整信息 + 系统状态） ──
      if (path === "/api/sessions" && method === "GET") {
        const sessions = sessionManager.values().map(serializeSession);
        const memoryUsage = process.memoryUsage();
        jsonResponse(res, 200, {
          sessions,
          memory: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
          uptime: process.uptime(),
        });
        return;
      }

      // ── 日志相关 ──
      if (path === "/api/logs" && method === "GET") {
        const count = parseInt(url.searchParams.get("count") || "100", 10);
        const afterId = url.searchParams.get("afterId");
        const logs = getRecentLogs(count, afterId ? parseInt(afterId, 10) : undefined);
        jsonResponse(res, 200, { logs });
        return;
      }

      if (path === "/api/logs/stream" && method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const recent = getRecentLogs(50);
        for (const entry of recent) {
          res.write(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
        }

        const unsubscribe = subscribeLog((entry) => {
          try {
            res.write(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
          } catch { /* 连接已关闭 */ }
        });

        const heartbeat = setInterval(() => {
          try { res.write(`: heartbeat\n\n`); } catch { /* ignore */ }
        }, 30000);

        req.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return;
      }

      // ── 认证相关 ──
      if (path === "/api/auth" && method === "GET") {
        const cookie = neteaseService.getCookie();
        const masked = cookie
          ? cookie.substring(0, 16) + "..." + cookie.slice(-8)
          : null;
        jsonResponse(res, 200, {
          isLoggedIn: neteaseAuthService.isLoggedIn(),
          cookieMasked: masked,
          cookieLength: cookie.length,
        });
        return;
      }

      if (path === "/api/auth/cookie" && method === "POST") {
        const body = (await readBody(req)) as { cookie?: string };
        if (!body.cookie || typeof body.cookie !== "string") {
          jsonResponse(res, 400, { error: "缺少 cookie 字段" });
          return;
        }
        neteaseService.setCookie(body.cookie);
        const isValid = await neteaseService.checkLoginStatus();
        if (isValid) {
          neteaseAuthService.setLoggedIn(true);
        }
        logger.info(`通过控制面板更新 Cookie，验证结果：${isValid ? "有效" : "无效"}`);
        jsonResponse(res, 200, {
          ok: true,
          isLoggedIn: isValid,
          message: isValid ? "Cookie 有效，登录态已恢复" : "Cookie 无效或已过期",
        });
        return;
      }

      if (path === "/api/auth/check" && method === "POST") {
        const isValid = await neteaseService.checkLoginStatus();
        jsonResponse(res, 200, { isLoggedIn: isValid });
        return;
      }

      // ── 扫码登录 ──
      if (path === "/api/auth/qr/create" && method === "POST") {
        try {
          const { key, qrimg } = await neteaseService.createQrLogin();
          logger.info("已生成扫码登录二维码");
          jsonResponse(res, 200, { ok: true, key, qrimg });
        } catch (error) {
          logger.error("生成二维码失败", error);
          jsonResponse(res, 500, { error: "生成二维码失败" });
        }
        return;
      }

      if (path === "/api/auth/qr/check" && method === "POST") {
        const body = (await readBody(req)) as { key?: string };
        if (!body.key || typeof body.key !== "string") {
          jsonResponse(res, 400, { error: "缺少 key 字段" });
          return;
        }
        try {
          const result = await neteaseService.checkQrLoginStatus(body.key);
          if (result.code === 803) {
            const isValid = await neteaseService.checkLoginStatus();
            if (isValid) {
              neteaseAuthService.setLoggedIn(true);
            }
            logger.info(`扫码登录成功，Cookie 验证结果：${isValid ? "有效" : "无效"}`);
          }
          jsonResponse(res, 200, {
            ok: true,
            code: result.code,
            message: result.message,
          });
        } catch (error) {
          logger.error("检查二维码状态失败", error);
          jsonResponse(res, 500, { error: "检查二维码状态失败" });
        }
        return;
      }

      // ── 机器人 Token 配置 ──
      if (path === "/api/config/token" && method === "GET") {
        const token = process.env.KOOK_BOT_TOKEN || "";
        const masked = token ? token.substring(0, 8) + "..." + token.slice(-4) : null;
        jsonResponse(res, 200, { hasToken: !!token, tokenMasked: masked });
        return;
      }

      if (path === "/api/config/token" && method === "POST") {
        const body = (await readBody(req)) as { token?: string };
        if (!body.token || typeof body.token !== "string") {
          jsonResponse(res, 400, { error: "缺少 token 字段" });
          return;
        }
        try {
          const envPath = nodePath.resolve(process.cwd(), ".env");
          let envContent = "";
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, "utf-8");
          }
          if (/^KOOK_BOT_TOKEN=/m.test(envContent)) {
            envContent = envContent.replace(/^KOOK_BOT_TOKEN=.*$/m, `KOOK_BOT_TOKEN=${body.token}`);
          } else {
            envContent = envContent.trimEnd() + `\nKOOK_BOT_TOKEN=${body.token}\n`;
          }
          fs.writeFileSync(envPath, envContent, "utf-8");
          process.env.KOOK_BOT_TOKEN = body.token;
          logger.info("KOOK Bot Token 已保存到 .env 文件");
          jsonResponse(res, 200, { ok: true, message: "Token 已保存，重启后生效" });
        } catch (error) {
          logger.error("保存 Token 失败", error);
          jsonResponse(res, 500, { error: "保存 Token 失败" });
        }
        return;
      }

      // ── 会话操作路由 ──
      const match = matchSessionRoute(path);
      if (match) {
        const session = sessionManager.get(match.guildId);

        // 获取单个会话
        if (!match.action && method === "GET") {
          if (!session) {
            jsonResponse(res, 404, { error: "会话不存在" });
            return;
          }
          jsonResponse(res, 200, { session: serializeSession(session) });
          return;
        }

        // 播放控制
        if (method === "POST") {
          if (!session) {
            jsonResponse(res, 404, { error: "会话不存在" });
            return;
          }
          switch (match.action) {
            case "pause":
              await player.pause(match.guildId);
              jsonResponse(res, 200, { ok: true });
              return;
            case "resume":
              await player.resume(match.guildId);
              jsonResponse(res, 200, { ok: true });
              return;
            case "skip": {
              const body = (await readBody(req)) as { position?: number };
              await player.skip(match.guildId, body.position);
              jsonResponse(res, 200, { ok: true });
              return;
            }
            case "stop":
              await player.stop(match.guildId);
              jsonResponse(res, 200, { ok: true });
              return;
          }
        }

        // 队列操作
        if (method === "DELETE") {
          if (!session) {
            jsonResponse(res, 404, { error: "会话不存在" });
            return;
          }
          // DELETE /api/sessions/:guildId/queue/:index
          if (match.subResource === "queue" && match.subId !== undefined) {
            const index = parseInt(match.subId, 10);
            if (isNaN(index) || index < 0 || index >= session.queue.length) {
              jsonResponse(res, 400, { error: "无效的索引" });
              return;
            }
            session.queue.splice(index, 1);
            jsonResponse(res, 200, { ok: true, queueLength: session.queue.length });
            return;
          }
          // DELETE /api/sessions/:guildId/queue
          if (match.action === "queue" && !match.subId) {
            session.queue.length = 0;
            jsonResponse(res, 200, { ok: true });
            return;
          }
        }
      }

      // ── 404 ──
      jsonResponse(res, 404, { error: "Not Found" });
    } catch (error) {
      logger.error("仪表盘请求处理异常", error);
      jsonResponse(res, 500, { error: "Internal Server Error" });
    }
  });

  server.listen(port, () => {
    logger.info(`仪表盘服务器已在端口 ${port} 启动：http://localhost:${port}`);
  });

  return server;
}

const DashboardHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MusicBot 控制面板</title>
<style>
:root {
  --bg: #0f172a; --glass: rgba(30,41,59,0.7); --border: rgba(255,255,255,0.1);
  --t1: #f8fafc; --t2: #94a3b8; --accent: #3b82f6; --glow: rgba(59,130,246,0.5);
  --success: #10b981; --warning: #f59e0b; --danger: #ef4444; --radius: 16px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, 'Segoe UI', sans-serif; background: var(--bg);
  background-image: radial-gradient(at 0% 0%,rgba(59,130,246,.15) 0,transparent 50%),
  radial-gradient(at 100% 100%,rgba(139,92,246,.15) 0,transparent 50%);
  color: var(--t1); min-height: 100vh; }
.container { max-width: 1100px; margin: 0 auto; padding: 30px 20px; }
.header { text-align: center; margin-bottom: 30px; }
.header h1 { font-size: 2rem; font-weight: 800; margin-bottom: 6px;
  background: linear-gradient(to right,#60a5fa,#c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header .sub { color: var(--t2); font-size: 0.95rem; }
.glass { background: var(--glass); backdrop-filter: blur(12px); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
.tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
.tab-btn { background: var(--glass); border: 1px solid var(--border); color: var(--t2);
  padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; transition: all .2s; }
.tab-btn:hover { color: var(--t1); border-color: var(--accent); }
.tab-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.tab-panel { display: none; animation: fadeIn .3s ease; }
.tab-panel.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.grid3 { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 16px; margin-bottom: 24px; }
.stat { text-align: center; }
.stat .val { font-size: 1.8rem; font-weight: 800; margin-bottom: 4px; }
.stat .lbl { font-size: 0.85rem; color: var(--t2); text-transform: uppercase; letter-spacing: 1px; }
.badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
.badge.playing { background: rgba(16,185,129,.2); color: #34d399; }
.badge.paused { background: rgba(245,158,11,.2); color: #fbbf24; }
.badge.buffering { background: rgba(59,130,246,.2); color: #60a5fa; }
.badge.idle { background: rgba(148,163,184,.2); color: #94a3b8; }
.session-panel { margin-bottom: 16px; }
.session-panel .sp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.session-panel .sp-header h3 { font-size: 1.1rem; }
.track-info { margin-bottom: 12px; }
.track-info .title { font-size: 1.1rem; font-weight: 600; }
.track-info .artist { color: var(--t2); font-size: 0.9rem; }
.progress-bar { height: 6px; background: rgba(255,255,255,.1); border-radius: 3px; margin: 8px 0; overflow: hidden; }
.progress-bar .fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 1s linear; }
.progress-text { font-size: 0.8rem; color: var(--t2); }
.btn-group { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: all .2s; color: #fff; }
.btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
.btn-primary { background: var(--accent); }
.btn-warning { background: var(--warning); color: #000; }
.btn-danger { background: var(--danger); }
.btn-ghost { background: rgba(255,255,255,.1); color: var(--t2); }
.btn-ghost:hover { color: var(--t1); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.queue-list { margin-top: 12px; }
.queue-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px;
  background: rgba(15,23,42,.5); border-radius: 8px; margin-bottom: 6px; font-size: 0.9rem; }
.queue-item .qi-title { flex: 1; }
.queue-item .qi-artist { color: var(--t2); margin-left: 8px; font-size: 0.8rem; }
.queue-item .del-btn { background: none; border: none; color: var(--danger); cursor: pointer; font-size: 0.85rem; padding: 2px 6px; border-radius: 4px; }
.queue-item .del-btn:hover { background: rgba(239,68,68,.2); }
.log-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.log-toolbar label { font-size: 0.9rem; color: var(--t2); display: flex; align-items: center; gap: 4px; }
.log-toolbar select { background: rgba(255,255,255,.1); border: 1px solid var(--border); color: var(--t1);
  padding: 6px 10px; border-radius: 6px; font-size: 0.85rem; }
.log-box { background: rgba(0,0,0,.3); border: 1px solid var(--border); border-radius: 10px;
  padding: 12px; max-height: 500px; overflow-y: auto; font-family: 'Consolas','Courier New',monospace; font-size: 0.82rem; line-height: 1.6; }
.log-box .log-line { padding: 2px 0; word-break: break-all; }
.log-box .log-line .ts { color: #64748b; }
.log-box .log-line .lvl-debug { color: #64748b; }
.log-box .log-line .lvl-info { color: #38bdf8; }
.log-box .log-line .lvl-warn { color: #fbbf24; }
.log-box .log-line .lvl-error { color: #f87171; }
.log-box .log-line .scope { color: #a78bfa; }
.auth-card { max-width: 600px; }
.auth-card .auth-status { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.auth-card .auth-dot { width: 12px; height: 12px; border-radius: 50%; }
.auth-card .auth-dot.on { background: var(--success); box-shadow: 0 0 8px var(--success); }
.auth-card .auth-dot.off { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
.auth-card textarea { width: 100%; background: rgba(0,0,0,.3); border: 1px solid var(--border);
  color: var(--t1); padding: 10px; border-radius: 8px; font-family: monospace; font-size: 0.85rem;
  resize: vertical; min-height: 80px; margin: 8px 0; }
.auth-card .cookie-display { font-family: monospace; font-size: 0.85rem; color: var(--t2);
  background: rgba(0,0,0,.2); padding: 8px 12px; border-radius: 6px; margin: 8px 0; word-break: break-all; }
.auth-card .warn { color: var(--warning); font-size: 0.85rem; margin-top: 12px; }
.qr-section { text-align: center; padding: 16px 0; }
.qr-section .qr-img { width: 200px; height: 200px; border-radius: 12px; background: #fff; padding: 8px; margin: 12px auto; }
.qr-section .qr-img img { width: 100%; height: 100%; }
.qr-section .qr-status { font-size: 0.9rem; color: var(--t2); margin: 8px 0; min-height: 24px; }
.qr-section .qr-status.success { color: var(--success); }
.qr-section .qr-status.expired { color: var(--danger); }
.divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--t2); font-size: 0.85rem; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.empty { text-align: center; padding: 40px; color: var(--t2); }
.toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 10px;
  font-size: 0.9rem; font-weight: 600; z-index: 999; animation: slideIn .3s ease; }
.toast.success { background: rgba(16,185,129,.9); color: #fff; }
.toast.error { background: rgba(239,68,68,.9); color: #fff; }
@keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>MusicBot 控制面板</h1>
    <div class="sub">KOOK 网易云点歌机器人 - <span id="last-update">连接中...</span></div>
  </div>
  <div class="tabs">
    <button class="tab-btn active" data-tab="main">控制面板</button>
    <button class="tab-btn" data-tab="auth">登录设置</button>
    <button class="tab-btn" data-tab="settings">系统设置</button>
  </div>

  <!-- 主页面：状态 + 控制 + 日志 -->
  <div class="tab-panel active" id="tab-main">
    <div class="grid3">
      <div class="glass stat"><div class="val" id="stat-sessions">-</div><div class="lbl">活跃会话</div></div>
      <div class="glass stat"><div class="val" id="stat-memory">-</div><div class="lbl">内存占用</div></div>
      <div class="glass stat"><div class="val" id="stat-uptime">-</div><div class="lbl">运行时间</div></div>
    </div>
    <h2 style="margin-bottom:16px">播放控制</h2>
    <div id="control-list"><div class="empty glass">暂无活跃会话</div></div>
    <h2 style="margin:20px 0 16px">运行日志</h2>
    <div class="log-toolbar">
      <label><input type="checkbox" id="log-autoscroll" checked> 自动滚动</label>
      <select id="log-filter">
        <option value="all">全部级别</option>
        <option value="debug">Debug</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>
      <button class="btn btn-ghost" id="log-clear">清空</button>
    </div>
    <div class="log-box" id="log-box"></div>
  </div>

  <!-- Tab: 登录设置 -->
  <div class="tab-panel" id="tab-auth">
    <div class="glass auth-card">
      <h2 style="margin-bottom:16px">网易云音乐登录</h2>
      <div class="auth-status">
        <div class="auth-dot" id="auth-dot"></div>
        <span id="auth-status-text">检查中...</span>
      </div>
      <div>当前 Cookie:</div>
      <div class="cookie-display" id="auth-cookie">-</div>

      <!-- 已登录：切换账号 -->
      <div id="auth-switch" style="display:none;margin-top:16px">
        <button class="btn btn-ghost" id="auth-switch-btn">切换账号</button>
      </div>

      <!-- 未登录：登录方式 -->
      <div id="login-forms">
        <!-- 扫码登录 -->
        <div class="qr-section">
          <button class="btn btn-primary" id="qr-start">扫码登录</button>
          <div id="qr-container" style="display:none">
            <div class="qr-img"><img id="qr-img" src="" alt="二维码"></div>
            <div class="qr-status" id="qr-status">正在生成二维码...</div>
            <button class="btn btn-ghost" id="qr-refresh" style="display:none">刷新二维码</button>
          </div>
        </div>

        <div class="divider">或手动粘贴 Cookie</div>

        <div>
          <textarea id="auth-cookie-input" placeholder="粘贴完整的 Cookie 字符串..."></textarea>
          <div class="btn-group">
            <button class="btn btn-primary" id="auth-save">验证并保存</button>
            <button class="btn btn-ghost" id="auth-check">重新验证当前状态</button>
          </div>
        </div>
      </div>
      <div class="warn">Cookie 包含登录凭证，请勿分享给他人</div>
    </div>
  </div>

  <!-- Tab: 系统设置 -->
  <div class="tab-panel" id="tab-settings">
    <div class="glass auth-card">
      <h2 style="margin-bottom:16px">机器人 Token</h2>
      <div>当前 Token:</div>
      <div class="cookie-display" id="token-display">-</div>
      <div style="margin-top:16px">
        <div style="margin-bottom:8px;font-weight:600">更新 Token:</div>
        <textarea id="token-input" placeholder="粘贴 KOOK Bot Token..."></textarea>
        <div class="btn-group">
          <button class="btn btn-primary" id="token-save">保存 Token</button>
        </div>
      </div>
      <div class="warn">Token 修改后需要重启机器人生效</div>
    </div>
  </div>
</div>
<script>
// ── 工具函数 ──
function fmt(ms){if(!ms)return"0:00";var s=Math.floor(ms/1e3),m=Math.floor(s/60);return m+":"+String(s%60).padStart(2,"0")}
function fmtUptime(s){var d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d>0?d+"天 "+h+"小时":h>0?h+"小时 "+m+"分":m+"分"}
function esc(t){var d=document.createElement("div");d.textContent=t;return d.innerHTML}

var api={
  get:function(p){return fetch(p).then(function(r){return r.json()})},
  post:function(p,b){return fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined}).then(function(r){return r.json()})},
  del:function(p){return fetch(p,{method:"DELETE"}).then(function(r){return r.json()})}
};

// ── Toast 提示 ──
function toast(msg,type){var el=document.createElement("div");el.className="toast "+(type||"success");el.textContent=msg;document.body.appendChild(el);setTimeout(function(){el.remove()},3000)}

// ── Tab 切换 ──
document.querySelectorAll(".tab-btn").forEach(function(btn){
  btn.addEventListener("click",function(){
    document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active")});
    document.querySelectorAll(".tab-panel").forEach(function(p){p.classList.remove("active")});
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
  });
});

// ── 播放控制 ──
function renderControl(data){
  var playing=data.filter(function(s){return s.state==="playing"}).length;
  document.getElementById("stat-sessions").textContent=playing+" / "+data.length;
  var el=document.getElementById("control-list");
  if(!data.length){el.innerHTML='<div class="empty glass">暂无活跃会话</div>';return}
  el.innerHTML=data.map(function(s){
    var bc=s.state;
    var st=s.state==="playing"?"播放中":s.state==="paused"?"已暂停":s.state==="buffering"?"缓冲中":"空闲";
    var tt=s.currentTrack?esc(s.currentTrack.title):"无歌曲";
    var ta=s.currentTrack?esc(s.currentTrack.artistNames):"";
    var gid=esc(s.guildId);
    var prog="";
    if(s.currentTrack&&s.currentTrack.durationMs&&s.elapsed!=null){
      var pct=Math.min(100,s.elapsed/(s.currentTrack.durationMs/1000)*100);
      prog='<div class="progress-bar"><div class="fill" style="width:'+pct+'%"></div></div><div class="progress-text">'+fmt(s.elapsed*1000)+" / "+fmt(s.currentTrack.durationMs)+'</div>';
    }
    var isPlaying=s.state==="playing";
    var isPaused=s.state==="paused";
    var hasTrack=!!s.currentTrack;
    var btns='<div class="btn-group">';
    if(hasTrack){
      btns+=isPlaying?'<button class="btn btn-warning" onclick="doAction(\\''+gid+'\\',\\'pause\\')">暂停</button>':'';
      if(isPaused) btns+='<button class="btn btn-primary" onclick="doAction(\\''+gid+'\\',\\'resume\\')">继续</button>';
      btns+='<button class="btn btn-danger" onclick="doAction(\\''+gid+'\\',\\'skip\\')">切歌</button>';
      btns+='<button class="btn btn-danger" onclick="doAction(\\''+gid+'\\',\\'stop\\')">停止</button>';
    }
    btns+='</div>';
    var queue="";
    if(s.queue.length>0){
      queue='<div class="queue-list"><div style="font-weight:600;margin-bottom:8px">队列 ('+s.queue.length+' 首)</div>';
      queue+=s.queue.map(function(t,i){
        return '<div class="queue-item"><span class="qi-title">'+esc(t.title)+'</span><span class="qi-artist">'+esc(t.artistNames)+'</span><button class="del-btn" onclick="delQueueItem(\\''+gid+'\\','+i+')">删除</button></div>';
      }).join("");
      queue+='<div style="text-align:right;margin-top:8px"><button class="btn btn-ghost" onclick="clearQueue(\\''+gid+'\\')">清空队列</button></div></div>';
    }
    return '<div class="glass session-panel"><div class="sp-header"><h3>'+esc(s.voiceChannelName||"未知频道")+'</h3><span class="badge '+bc+'">'+st+'</span></div><div class="track-info"><div class="title">'+tt+'</div><div class="artist">'+ta+'</div>'+prog+'</div>'+btns+queue+'</div>';
  }).join("");
}

window.doAction=function(gid,action){
  api.post("/api/sessions/"+encodeURIComponent(gid)+"/"+action).then(function(r){
    if(r.ok)toast(action==="pause"?"已暂停":action==="resume"?"已继续":action==="skip"?"已切歌":"已停止");
    else toast(r.error||"操作失败","error");
  }).catch(function(){toast("请求失败","error")});
};
var pendingOps=0;
window.delQueueItem=function(gid,idx){
  pendingOps++;
  api.del("/api/sessions/"+encodeURIComponent(gid)+"/queue/"+idx).then(function(r){
    if(r.ok)toast("已删除");else toast(r.error||"删除失败","error");
  }).catch(function(){toast("请求失败","error")}).finally(function(){
    pendingOps--;poll();
  });
};
window.clearQueue=function(gid){
  if(!confirm("确认清空队列？"))return;
  pendingOps++;
  api.del("/api/sessions/"+encodeURIComponent(gid)+"/queue").then(function(r){
    if(r.ok)toast("队列已清空");else toast(r.error||"操作失败","error");
  }).catch(function(){toast("请求失败","error")}).finally(function(){
    pendingOps--;poll();
  });
};

// ── 轮询 ──
function poll(){
  if(pendingOps>0)return;
  api.get("/api/sessions").then(function(r){
    var data=r.sessions||[];
    document.getElementById("last-update").textContent=new Date().toLocaleTimeString()+" 更新";
    if(r.memory) document.getElementById("stat-memory").textContent=r.memory;
    if(r.uptime!=null) document.getElementById("stat-uptime").textContent=fmtUptime(r.uptime);
    renderControl(data);
  }).catch(function(){
    document.getElementById("last-update").textContent="连接中断...";
  });
}
poll();
setInterval(poll,1000);

// ── 运行日志 ──
var logEntries=[];
var logFilter="all";
var logBox=document.getElementById("log-box");
var logAutoScroll=document.getElementById("log-autoscroll");
var logFilterEl=document.getElementById("log-filter");

function renderLogLine(e){
  var t=e.timestamp.substring(11,19);
  return '<div class="log-line" data-level="'+e.level+'"><span class="ts">['+t+']</span> <span class="lvl-'+e.level+'">['+e.level.toUpperCase()+']</span> <span class="scope">['+esc(e.scope)+']</span> '+esc(e.message)+(e.meta?" "+esc(e.meta):"")+'</div>';
}

function renderLogs(){
  var filtered=logFilter==="all"?logEntries:logEntries.filter(function(e){return e.level===logFilter});
  logBox.innerHTML=filtered.map(renderLogLine).join("");
  if(logAutoScroll.checked)logBox.scrollTop=logBox.scrollHeight;
}

logFilterEl.addEventListener("change",function(){logFilter=this.value;renderLogs()});
document.getElementById("log-clear").addEventListener("click",function(){logEntries=[];logBox.innerHTML=""});

// 加载历史日志
api.get("/api/logs?count=200").then(function(r){
  logEntries=r.logs||[];
  renderLogs();
});

// SSE 实时日志
var evtSource=new EventSource("/api/logs/stream");
evtSource.onmessage=function(ev){
  try{
    var entry=JSON.parse(ev.data);
    logEntries.push(entry);
    if(logEntries.length>500)logEntries.splice(0,logEntries.length-500);
    if(logFilter==="all"||entry.level===logFilter){
      logBox.innerHTML+=renderLogLine(entry);
      if(logBox.children.length>500)logBox.removeChild(logBox.firstChild);
      if(logAutoScroll.checked)logBox.scrollTop=logBox.scrollHeight;
    }
  }catch(e){}
};
evtSource.onerror=function(){setTimeout(function(){evtSource=new EventSource("/api/logs/stream")},3000)};

// ── 登录设置 ──
function refreshAuth(){
  api.get("/api/auth").then(function(r){
    var dot=document.getElementById("auth-dot");
    var txt=document.getElementById("auth-status-text");
    dot.className="auth-dot "+(r.isLoggedIn?"on":"off");
    txt.textContent=r.isLoggedIn?"已登录":"未登录";
    document.getElementById("auth-cookie").textContent=r.cookieMasked||"无 Cookie";
    document.getElementById("login-forms").style.display=r.isLoggedIn?"none":"";
    document.getElementById("auth-switch").style.display=r.isLoggedIn?"":"none";
    if(r.isLoggedIn){stopQrPolling();qrKey=null}
  });
}
refreshAuth();

document.getElementById("auth-save").addEventListener("click",function(){
  var val=document.getElementById("auth-cookie-input").value.trim();
  if(!val){toast("请输入 Cookie","error");return}
  api.post("/api/auth/cookie",{cookie:val}).then(function(r){
    if(r.ok){toast(r.message);document.getElementById("auth-cookie-input").value="";refreshAuth()}
    else toast(r.error||"保存失败","error");
  }).catch(function(){toast("请求失败","error")});
});

document.getElementById("auth-check").addEventListener("click",function(){
  api.post("/api/auth/check").then(function(r){
    toast(r.isLoggedIn?"登录态有效":"登录态无效",r.isLoggedIn?"success":"error");
    refreshAuth();
  }).catch(function(){toast("验证失败","error")});
});

document.getElementById("auth-switch-btn").addEventListener("click",function(){
  document.getElementById("login-forms").style.display="";
  document.getElementById("auth-switch").style.display="none";
});

// ── 扫码登录 ──
var qrPollingTimer=null;
var qrKey=null;

function stopQrPolling(){if(qrPollingTimer){clearInterval(qrPollingTimer);qrPollingTimer=null}}

function startQrPolling(){
  stopQrPolling();
  qrPollingTimer=setInterval(function(){
    if(!qrKey)return;
    api.post("/api/auth/qr/check",{key:qrKey}).then(function(r){
      var el=document.getElementById("qr-status");
      if(!r.ok){el.textContent=r.error||"检查失败";el.className="qr-status expired";stopQrPolling();return}
      if(r.code===800){
        el.textContent="二维码已过期，请点击刷新";el.className="qr-status expired";
        document.getElementById("qr-refresh").style.display="";stopQrPolling();
      }else if(r.code===801){
        el.textContent="请使用网易云音乐 App 扫描二维码";el.className="qr-status";
      }else if(r.code===802){
        el.textContent="已扫码，请在手机上确认登录";el.className="qr-status";
      }else if(r.code===803){
        el.textContent="登录成功！";el.className="qr-status success";
        stopQrPolling();refreshAuth();
        setTimeout(function(){document.getElementById("qr-container").style.display="none"},2000);
        toast("扫码登录成功");
      }
    }).catch(function(){});
  },3000);
}

document.getElementById("qr-start").addEventListener("click",function(){
  var container=document.getElementById("qr-container");
  container.style.display="";
  document.getElementById("qr-status").textContent="正在生成二维码...";
  document.getElementById("qr-status").className="qr-status";
  document.getElementById("qr-refresh").style.display="none";
  document.getElementById("qr-start").style.display="none";

  api.post("/api/auth/qr/create").then(function(r){
    if(!r.ok){document.getElementById("qr-status").textContent=r.error||"生成失败";document.getElementById("qr-status").className="qr-status expired";document.getElementById("qr-start").style.display="";return}
    qrKey=r.key;
    document.getElementById("qr-img").src=r.qrimg;
    document.getElementById("qr-status").textContent="请使用网易云音乐 App 扫描二维码";
    startQrPolling();
  }).catch(function(){
    document.getElementById("qr-status").textContent="请求失败";document.getElementById("qr-status").className="qr-status expired";
    document.getElementById("qr-start").style.display="";
  });
});

document.getElementById("qr-refresh").addEventListener("click",function(){
  this.style.display="none";
  document.getElementById("qr-status").textContent="正在生成二维码...";
  document.getElementById("qr-status").className="qr-status";

  api.post("/api/auth/qr/create").then(function(r){
    if(!r.ok){document.getElementById("qr-status").textContent=r.error||"生成失败";document.getElementById("qr-status").className="qr-status expired";document.getElementById("qr-refresh").style.display="";return}
    qrKey=r.key;
    document.getElementById("qr-img").src=r.qrimg;
    document.getElementById("qr-status").textContent="请使用网易云音乐 App 扫描二维码";
    startQrPolling();
  }).catch(function(){
    document.getElementById("qr-status").textContent="请求失败";document.getElementById("qr-status").className="qr-status expired";
    document.getElementById("qr-refresh").style.display="";
  });
});

// ── 机器人 Token ──
function refreshToken(){
  api.get("/api/config/token").then(function(r){
    document.getElementById("token-display").textContent=r.hasToken?(r.tokenMasked||"已设置"):"未配置";
  });
}
refreshToken();

document.getElementById("token-save").addEventListener("click",function(){
  var val=document.getElementById("token-input").value.trim();
  if(!val){toast("请输入 Token","error");return}
  api.post("/api/config/token",{token:val}).then(function(r){
    if(r.ok){toast(r.message);document.getElementById("token-input").value="";refreshToken()}
    else toast(r.error||"保存失败","error");
  }).catch(function(){toast("请求失败","error")});
});
</script>
</body>
</html>`;
