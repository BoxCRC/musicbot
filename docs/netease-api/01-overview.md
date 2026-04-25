# NeteaseCloudMusicApi 文档

> 来源：npm 包 `NeteaseCloudMusicApi@4.31.0`
> GitHub: https://github.com/Binaryify/NeteaseCloudMusicApi (仓库已归档)
> 文档站点: https://docs-neteasecloudmusicapi.vercel.app

## 简介

网易云音乐 Node.js API service，提供 354+ 个非官方 API 接口，涵盖登录、搜索、歌单、歌词、评论、电台、视频等功能。

## 环境要求

- NodeJS 18+

## 安装

```shell
npm install NeteaseCloudMusicApi
```

## 运行方式

### 1. 作为 HTTP 服务运行

```shell
node app.js
```

默认端口 3000，可通过环境变量修改：

```shell
# Mac/Linux
PORT=4000 node app.js

# Windows (git-bash / cmder)
set PORT=4000 && node app.js
```

### 2. npx 方式运行

```shell
npx NeteaseCloudMusicApi@latest
```

无需下载或 clone 项目，直接启动服务。

### 3. Docker 容器运行

```shell
docker pull binaryify/netease_cloud_music_api
docker run -d -p 3000:3000 binaryify/netease_cloud_music_api
```

注意：Docker 中运行时需注意 proxy 相关环境变量：
- `http_proxy` / `https_proxy`
- `HTTP_PROXY` / `HTTPS_PROXY`
- `no_proxy` / `NO_PROXY`

如果这些环境变量指向的代理不可用，会造成错误。可通过 query 中的 `proxy` 参数覆盖。

### 4. Vercel 部署

1. fork 此项目
2. 在 Vercel 官网点击 `New Project`
3. 点击 `Import Git Repository` 并选择 fork 的项目
4. `FRAMEWORK PRESET` 选 `Other`，点击 `Deploy`

### 5. 腾讯云 Serverless 部署

1. fork 此项目
2. 在腾讯云 serverless 应用管理页面新建应用
3. 选择 `Web 应用` -> `Express框架`
4. 启动文件填入：

```bash
#!/bin/bash
export PORT=9000
/var/lang/node16/bin/node app.js
```

## 在 Node.js 中调用

```js
const { login_cellphone, user_cloud } = require('NeteaseCloudMusicApi')

async function main() {
  try {
    const result = await login_cellphone({
      phone: '手机号',
      password: '密码',
    })
    console.log(result)
    const result2 = await user_cloud({
      cookie: result.body.cookie, // 凭证
    })
    console.log(result2.body)
  } catch (error) {
    console.log(error)
  }
}
main()
```

## TypeScript 支持

```ts
import { banner } from 'NeteaseCloudMusicApi'

banner({ type: 0 }).then((res) => {
  console.log(res)
})
```

## 返回值结构

所有接口返回 `Promise<Response>`：

```ts
interface Response<Body = APIBaseResponse> {
  status: number   // HTTP 状态码
  body: Body       // API 响应内容
  cookie: string[] // Cookie 数组
}

interface APIBaseResponse {
  code: number
  cookie: string
  [index: string]: unknown
}
```

## 基础请求参数

所有接口都支持以下基础参数：

```ts
interface RequestBaseConfig {
  cookie?: string  // 登录凭证
  realIP?: string  // IPv4/IPv6，填充到 X-Real-IP
  proxy?: string   // HTTP 代理
}
```

分页参数：

```ts
interface MultiPageConfig {
  limit?: string | number   // 每页数量
  offset?: string | number  // 偏移量
}
```
