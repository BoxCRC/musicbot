import http from "http";
import os from "os";
import type { Player } from "../music/player";
import type { SessionManager } from "../music/session-manager";
import type { AppLogger } from "../shared/logger";

export function startDashboardServer(
  player: Player,
  sessionManager: SessionManager,
  port: number,
  logger: AppLogger,
): http.Server {
  const server = http.createServer((req, res) => {
    // CORS & Basic Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    if (req.url === "/api/status" && req.method === "GET") {
      const memoryUsage = process.memoryUsage();
      const sessions = sessionManager.values().map((session) => ({
        guildId: session.guildId,
        state: session.state,
        currentTrack: session.currentTrack
          ? {
              title: session.currentTrack.title,
              artist: session.currentTrack.artistNames,
            }
          : null,
        queueLength: session.queue.length,
        channelName: session.voiceChannelName || "Unknown Channel",
      }));

      const status = {
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
        },
        cpu: os.cpus()[0].model,
        activeSessions: sessions.filter((s) => s.state === "playing").length,
        totalSessions: sessions.length,
        sessions,
      };

      res.writeHead(200);
      res.end(JSON.stringify(status));
      return;
    }

    if (req.url === "/" && req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(DashboardHTML);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found" }));
  });

  server.listen(port, () => {
    logger.info(`仪表盘服务器已在端口 ${port} 启动：http://localhost:${port}`);
  });

  return server;
}

const DashboardHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KOOK 音乐机器人状态监测</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --glass-bg: rgba(30, 41, 59, 0.7);
            --glass-border: rgba(255, 255, 255, 0.1);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #3b82f6;
            --accent-glow: rgba(59, 130, 246, 0.5);
            --card-radius: 16px;
        }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            background: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(59,130,246,0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(139,92,246,0.15) 0px, transparent 50%);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            width: 100%;
            max-width: 1100px;
            padding: 40px 20px;
            box-sizing: border-box;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            animation: fadeInDown 0.8s ease-out;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin: 0 0 10px 0;
            background: linear-gradient(to right, #60a5fa, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
        }

        .glass-card {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: var(--card-radius);
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .glass-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 20px var(--accent-glow);
        }

        .grid-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
            animation: fadeIn 1s ease-out;
        }

        .stat-item {
            text-align: center;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 800;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .stat-label {
            font-size: 0.9rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .sessions-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            animation: fadeInUp 1s ease-out;
        }

        .session-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 12px;
            border-left: 4px solid var(--accent-color);
        }

        .session-card.idle {
            border-left-color: var(--text-secondary);
        }

        .session-info h3 {
            margin: 0 0 8px 0;
            font-size: 1.2rem;
        }

        .session-info p {
            margin: 0;
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        .session-status {
            text-align: right;
        }

        .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge.playing {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
        }

        .badge.paused {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
        }

        .badge.idle {
            background: rgba(148, 163, 184, 0.2);
            color: #94a3b8;
        }
        
        .badge.buffering {
            background: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .loader {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MusicBot Dashboard</h1>
            <div class="subtitle">实时服务状态监测 - <span id="last-update">正在连接...</span></div>
        </div>

        <div class="grid-overview">
            <div class="glass-card stat-item">
                <div class="stat-value" id="stat-sessions">-</div>
                <div class="stat-label">活跃会话</div>
            </div>
            <div class="stat-item glass-card">
                <div class="stat-value" id="stat-memory">-</div>
                <div class="stat-label">内存占用</div>
            </div>
            <div class="stat-item glass-card">
                <div class="stat-value" id="stat-uptime">-</div>
                <div class="stat-label">运行时间</div>
            </div>
        </div>

        <h2>正在播放</h2>
        <div class="sessions-container" id="sessions-list">
            <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                <div class="loader"></div>
                <p>拉取数据中...</p>
            </div>
        </div>
    </div>

    <script>
        function formatUptime(seconds) {
            const d = Math.floor(seconds / (3600*24));
            const h = Math.floor(seconds % (3600*24) / 3600);
            const m = Math.floor(seconds % 3600 / 60);
            if(d > 0) return \`\${d}天 \${h}小时\`;
            if(h > 0) return \`\${h}小时 \${m}分\`;
            return \`\${m}分\`;
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                document.getElementById('stat-sessions').textContent = \`\${data.activeSessions} / \${data.totalSessions}\`;
                document.getElementById('stat-memory').textContent = data.memory.rss;
                document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
                
                const now = new Date();
                document.getElementById('last-update').textContent = now.toLocaleTimeString();

                const listEl = document.getElementById('sessions-list');
                
                if(data.sessions.length === 0) {
                    listEl.innerHTML = '<div class="glass-card" style="text-align:center; color: #94a3b8;">当前没有正在活动的语音频道会话</div>';
                    return;
                }

                listEl.innerHTML = data.sessions.map(s => {
                    const badgeClass = s.state.toLowerCase();
                    const stateText = s.state === 'playing' ? '播放中' : s.state === 'paused' ? '已暂停' : s.state === 'buffering' ? '缓冲中' : '空闲';
                    const trackTitle = s.currentTrack ? s.currentTrack.title : '没有歌曲';
                    const trackArtist = s.currentTrack ? s.currentTrack.artist : '空闲状态';
                    
                    return \`
                        <div class="glass-card session-card \${badgeClass}">
                            <div class="session-info">
                                <h3>\${s.channelName}</h3>
                                <p>\${trackTitle} - \${trackArtist} (队列: \${s.queueLength})</p>
                            </div>
                            <div class="session-status">
                                <span class="badge \${badgeClass}">\${stateText}</span>
                            </div>
                        </div>
                    \`;
                }).join('');

            } catch(e) {
                console.error(e);
                document.getElementById('last-update').textContent = '连接中断，重新连接中...';
            }
        }

        fetchStatus();
        setInterval(fetchStatus, 3000);
    </script>
</body>
</html>
`;
