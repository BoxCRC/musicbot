import { login_qr_key, login_qr_create, login_qr_check } from "NeteaseCloudMusicApi";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startLogin() {
  console.log("正在向网易云音乐申请扫码登录...");
  
  const timestamp1 = Date.now();
  const keyRes: any = await login_qr_key({ timestamp: timestamp1 });
  const key = keyRes.body.data.unikey;

  const timestamp2 = Date.now();
  const urlRes: any = await login_qr_create({ key, qrimg: true, timestamp: timestamp2 });
  const qrurl = urlRes.body.data.qrurl;

  console.log("\n==================================");
  console.log("请使用网易云音乐 App 扫描下方二维码：");
  qrcode.generate(qrurl, { small: true });
  console.log("----------------------------------");
  console.log("如果二维码无法识别，请复制以下链接发送给手机，在手机内置浏览器中打开：");
  console.log(qrurl);
  console.log("==================================\n");

  let maxRetries = 60; // Wait about 2 minutes
  while (maxRetries > 0) {
    const timestamp3 = Date.now();
    const checkRes: any = await login_qr_check({ key, timestamp: timestamp3 });
    const code = checkRes.body.code;

    if (code === 800) {
      console.log("❌ 二维码已过期，请重新运行 npm run login");
      process.exit(1);
    } else if (code === 803) {
      console.log("✅ 登录成功！正在提取 Cookie...");
      const cookie = checkRes.cookie.join("; ");
      
      const envPath = path.resolve(__dirname, "../.env");
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf-8");
        
        if (envContent.includes("NETEASE_COOKIE=")) {
          envContent = envContent.replace(/NETEASE_COOKIE=.*/, `NETEASE_COOKIE="${cookie}"`);
        } else {
          envContent += `\nNETEASE_COOKIE="${cookie}"\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log("🎉 Cookie 已自动保存到 .env 文件中的 NETEASE_COOKIE！");
        console.log("请重启您的点歌机器人进程 (如果在 dev 模式它将自动重载应用)。");
      } else {
        console.log("未找到 .env 文件，请手动将以下 Cookie 填入您的配置：");
        console.log(cookie);
      }
      
      process.exit(0);
    } else if (code === 802) {
      console.log("👉 扫描成功，请在手机上点击确认授权...");
    }

    await delay(2000);
    maxRetries--;
  }

  console.log("等待超时，请重新运行脚本。");
  process.exit(1);
}

startLogin().catch((err) => {
  console.error("二维码登录发生错误：", err);
});
