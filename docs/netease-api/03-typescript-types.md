# TypeScript 类型定义参考

> 来源：`node_modules/NeteaseCloudMusicApi/interface.d.ts`（1833 行）

## 基础类型

### RequestBaseConfig

所有接口的基础请求参数：

```ts
interface RequestBaseConfig {
  cookie?: string   // 登录凭证
  realIP?: string   // IPv4/IPv6，填充到 X-Real-IP
  proxy?: string    // HTTP 代理
}
```

### MultiPageConfig

分页参数：

```ts
interface MultiPageConfig {
  limit?: string | number   // 每页数量
  offset?: string | number  // 偏移量
}
```

### ImageUploadConfig

图片上传参数：

```ts
interface ImageUploadConfig {
  imgFile: {
    name: string
    data: string | Buffer
  }
  imgSize?: number
  imgX?: number
  imgY?: number
}
```

### Response

接口返回值：

```ts
interface APIBaseResponse {
  code: number
  cookie: string
  [index: string]: unknown
}

interface Response<Body = APIBaseResponse> {
  status: number    // HTTP 状态码
  body: Body        // API 响应内容
  cookie: string[]  // Cookie 数组
}
```

## 枚举类型

### SubAction - 收藏/取消收藏

```ts
const enum SubAction {
  sub = 1,    // 收藏
  unsub = 0,  // 取消收藏
}
```

### SearchType - 搜索类型

```ts
const enum SearchType {
  single = 1,       // 单曲
  album = 10,       // 专辑
  artist = 100,     // 歌手
  playlist = 1000,  // 歌单
  user = 1002,      // 用户
  mv = 1004,        // MV
  lyric = 1006,     // 歌词
  dj = 1009,        // 电台
  video = 1014,     // 视频
  complex = 1018,   // 综合
}
```

### CommentType - 评论类型

```ts
const enum CommentType {
  song = 0,      // 歌曲
  mv = 1,        // MV
  playlist = 2,  // 歌单
  album = 3,     // 专辑
  dj = 4,        // 电台
  video = 5,     // 视频
  event = 6,     // 动态
}
```

### CommentAction - 评论操作

```ts
const enum CommentAction {
  add = 1,     // 添加评论
  delete = 0,  // 删除评论
  reply = 2,   // 回复评论
}
```

### BannerType - Banner 类型

```ts
const enum BannerType {
  pc = 0,       // PC端
  android = 1,  // Android
  iphone = 2,   // iPhone
  ipad = 3,     // iPad
}
```

### AlbumListArea - 专辑地区

```ts
const enum AlbumListArea {
  all = 'ALL',  // 全部
  zh = 'ZH',    // 华语
  ea = 'EA',    // 欧美
  kr = 'KR',    // 韩国
  jp = 'JP',    // 日本
}
```

### AlbumListStyleArea - 专辑风格地区

```ts
const enum AlbumListStyleArea {
  zh = 'Z_H',  // 华语
  ea = 'E_A',  // 欧美
  kr = 'KR',   // 韩国
  jp = 'JP',   // 日本
}
```

### AlbumSongsaleboardType - 数字专辑销量类型

```ts
const enum AlbumSongsaleboardType {
  daily = 'daily',   // 日榜
  week = 'week',     // 周榜
  year = 'year',     // 年榜
  total = 'total',   // 总榜
}
```

### AlbumSongsaleboardAlbumType - 数字专辑类型

```ts
const enum AlbumSongsaleboardAlbumType {
  album = 0,    // 数字专辑
  single = 1,   // 数字单曲
}
```

### ListOrder - 列表排序

```ts
const enum ListOrder {
  hot = 'hot',  // 热门
  new = 'new',  // 最新
}
```

### DailySigninType - 签到类型

```ts
const enum DailySigninType {
  android = 0,  // Android 端
  pc = 1,       // PC 端
}
```

### ArtistArea - 歌手地区

```ts
const enum ArtistArea {
  all = '-1',    // 全部
  zh = '7',     // 华语
  ea = '96',    // 欧美
  ja = '8',     // 日本
  kr = '16',    // 韩国
  other = '0',  // 其他
}
```

### ArtistType - 歌手类型

```ts
const enum ArtistType {
  male = '1',    // 男歌手
  female = '2',  // 女歌手
  band = '3',    // 乐队
}
```

### ArtistListArea - 歌手列表地区

```ts
const enum ArtistListArea {
  zh = 'Z_H',  // 华语
  ea = 'E_A',  // 欧美
  kr = 'KR',   // 韩国
  jp = 'JP',   // 日本
}
```

### ArtistSongsOrder - 歌手歌曲排序

```ts
const enum ArtistSongsOrder {
  hot = 'hot',   // 热门
  time = 'time', // 最新
}
```

## 常用接口类型定义示例

### 搜索

```ts
function cloudsearch(
  params: {
    keywords: string          // 搜索关键词
    type?: SearchType         // 搜索类型，默认单曲
  } & MultiPageConfig & RequestBaseConfig,
): Promise<Response>
```

### 获取歌词

```ts
function lyric(
  params: { id: string | number } & RequestBaseConfig,
): Promise<Response>
```

### 获取歌曲 URL

```ts
function song_url(
  params: {
    id: string | number           // 歌曲 id
    br?: string | number          // 码率
  } & RequestBaseConfig,
): Promise<Response>
```

### 登录

```ts
function login_cellphone(
  params: {
    phone: string                  // 手机号
    password?: string              // 密码
    captcha?: string               // 验证码
    countrycode?: string | number  // 国家代码
  } & RequestBaseConfig,
): Promise<Response>
```

### 获取歌单详情

```ts
function playlist_detail(
  params: {
    id: string | number   // 歌单 id
    s?: string | number   // 歌单最近的 s 个收藏者
  } & RequestBaseConfig,
): Promise<Response>
```

### 评论操作

```ts
// 添加评论
function comment(
  params: {
    id: string | number       // 资源 id
    type: CommentType          // 资源类型
    t: CommentAction.add       // 操作类型
    content: string | number   // 评论内容
  } & RequestBaseConfig,
): Promise<Response>

// 删除评论
function comment(
  params: {
    id: string | number        // 资源 id
    type: CommentType           // 资源类型
    t: CommentAction.delete     // 操作类型
    commentId: string | number  // 评论 id
  } & RequestBaseConfig,
): Promise<Response>
```

### 电台分类参考

```
有声书      10001
知识技能    453050
商业财经    453051
人文历史    11
外语世界    13
亲子宝贝    14
创作|翻唱   2001
音乐故事    2
3D|电子     10002
相声曲艺    8
情感调频    3
美文读物    6
脱口秀      5
广播剧      7
二次元      3001
明星做主播  1
娱乐|影视   4
科技科学    453052
校园|教育   4001
旅途|城市   12
```
