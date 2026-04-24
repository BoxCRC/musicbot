# KOOK 开发者平台 API 完整参考文档

> 整理自 https://developer.kookapp.cn/doc/
> 最后更新：2026-04-25

---

# 一、概述

KOOK 的 API 分为两个核心层：

1. **常规 HTTP 接口** — 用于执行常规操作
2. **消息实时通知** — 通过 Webhook 或 WebSocket 订阅系统实时消息及事件

## BaseUrl

```
https://www.kookapp.cn/api
```

## API 版本

| 版本 | 状态 | 默认 |
|------|------|------|
| 3 | 开发中 | 是 |

## 鉴权

在开发者中心创建机器人后可获得 token。请求所有 KOOK 接口时，需在 HTTP Header 的 `Authorization` 中加入该 token。

**格式：** `Authorization: TOKEN_TYPE TOKEN`

- **机器人：** TOKEN_TYPE = `Bot`
- **OAuth2：** TOKEN_TYPE = `Bearer`

```
Authorization: Bot BHsTZ4232tLatgV5AFyjoqZGAHHmpl9mTxYQ/u4/80=
```

## 通用返回格式

```json
{
    "code": 0,           // integer, 0=成功，非0=失败
    "message": "操作成功", // string
    "data": []           // mixed
}
```

## 通用分页参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| page_size | int | 每页大小，默认50，常规最大50 |
| sort | string | 排序字段，如 `-id` 为 DESC，`id` 为 ASC |

## 通用分页返回

| 参数名 | 类型 | 说明 |
|--------|------|------|
| items | Array | 数据列表 |
| meta.page | int | 页码 |
| meta.page_total | int | 总页数 |
| meta.page_size | int | 每页数据量 |
| meta.total | int | 总数据量 |
| sort | Map | 排序信息 |

## i18N 国际化

```
Accept-Language: en-US
```

## 消息配额

每位开发者账号下所有机器人单日消息发送总量上限为 **10,000 条**。每日配额重置时间为北京时间 (UTC+8) 中午 12:00。

计入配额的接口：
- `/api/v3/message/create`
- `/api/v3/message/update`
- `/api/v3/direct-message/create`
- `/api/v3/direct-message/update`
- `/api/v3/thread/create`
- `/api/v3/thread/reply`

临时消息不计入配额。对用户5分钟内发送的消息的首次回复，扣减按 n 分之一条计算。

## 速率限制

| 响应头 | 说明 |
|--------|------|
| `X-Rate-Limit-Limit` | 一段时间内允许的最大请求次数 |
| `X-Rate-Limit-Remaining` | 一段时间内剩余的请求数 |
| `X-Rate-Limit-Reset` | 恢复到最大请求次数所需的等待时间（秒） |
| `X-Rate-Limit-Bucket` | 请求数所属的 bucket |
| `X-Rate-Limit-Global` | 触发全局请求次数限制时出现 |

超速返回 **HTTP 429**。多次超速可能导致 bot 被禁用。

---

# 二、WebSocket

通过 WebSocket 客户端可以与 KOOK 进行实时通信。

**重要：** Webhook 和 WebSocket 模式互斥，不可同时使用。

## Gateway

Gateway 是 WebSocket 的网关，地址需通过 HTTP 接口获取。

### 获取网关连接地址

- **地址：** `/api/v3/gateway/index`
- **请求方式：** GET

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| compress | integer | false | 下发数据是否压缩，默认1=压缩 |

返回：

```json
{
    "code": 0,
    "message": "操作成功",
    "data": {
        "url": "wss://xxxx"
    }
}
```

## 消息压缩

- `compress=1`：所有 server→client 消息为压缩的 binary 类型（zlib deflate）
- `compress=0`：关闭压缩
- 客户端发给服务端的消息**不要压缩**

## 连接流程

1. 获取 Gateway
2. 连接 Gateway（失败则指数回退重试，间隔2、4秒，最多2次）
3. 收到 hello 包（失败则回退第1步）
4. 心跳：每隔30秒发一次 ping，6秒内未收到 pong 则超时
5. 超时后先发两次心跳 ping（间隔2、4秒）
6. 若不成功，尝试两次 resume（间隔8、16秒）
7. 若失败，回到第1步，指数回退最大间隔60秒
8. 收到 reconnect 包时：清空消息队列、sn，回到第1步

### 重连参数

| 参数 | 说明 |
|------|------|
| `resume` | 固定值 `1` |
| `sn` | 客户端处理成功的最后一条消息的 sn |
| `session_id` | 前一个链接中的 session_id |

```
wss://test.kookapp.com:8888/gateway?{compress/token}&resume=1&sn=5&session_id=xxx
```

## 信令格式

```json
{
    "s": 1,   // 信令编号
    "d": {},  // 数据
    "sn": 0   // 仅在 s=0 时存在
}
```

| 信令 | 方向 | 说明 |
|------|------|------|
| 0 | server→client | 消息事件 |
| 1 | server→client | 握手结果 |
| 2 | client→server | 心跳 ping |
| 3 | server→client | 心跳 pong |
| 4 | client→server | resume 恢复会话 |
| 5 | server→client | reconnect 重新连接 |
| 6 | server→client | resume ack |

### 信令[1] HELLO

客户端应在 6s 内收到该包。

```json
{"s": 1, "d": {"code": 0, "session_id": "xxxx"}}
```

| 状态码 | 含义 |
|--------|------|
| 40100 | 缺少参数 |
| 40101 | 无效的 token |
| 40102 | token 验证失败 |
| 40103 | token 过期 |

### 信令[0] EVENT

正常连接状态下的消息事件。`sn` 为消息序号，需按顺序处理。

- sn 乱序：先存入暂存区，等正确 sn 消息处理后再顺序处理
- 收到已处理的 sn：直接丢弃
- 客户端需存储已处理的最大 sn，在心跳 ping 时回传

### 信令[2] PING

每 30s（±5秒）发送一次。

```json
{"s": 2, "sn": 6}
```

### 信令[3] PONG

```json
{"s": 3}
```

### 信令[4] RESUME

链接未断开时恢复会话。

```json
{"s": 4, "sn": 100}
```

### 信令[5] RECONNECT

服务端要求客户端重新连接。需：重新获取 gateway，清空 sn 和消息队列。

| 状态码 | 描述 |
|--------|------|
| 40106 | resume 失败，缺少参数 |
| 40107 | session 已过期 |
| 40108 | 无效的 sn |

### 信令[6] RESUME ACK

resume 成功，离线消息已全部发送完成。

```json
{"s": 6, "d": {"session_id": "xxxx"}}
```

---

# 三、Webhook

Webhook 是获取事件的另一种方式，通过 HTTP POST 推送消息到开发者提供的回调 URL。

**重要：** Webhook 和 WebSocket 模式互斥。

## 配置回调地址

每个机器人只能配置一个请求网址。

1. 开发者后台 → 机器人详情 → 设置 > 机器人
2. 选择 **WebHook** 模式
3. 填写 **Callback Url**

## Challenge 验证

点击"重试"或上线时，平台会推送 Challenge 请求。需在 **1秒内** 原样返回 `challenge` 值。

```json
// 请求
{"s": 0, "d": {"type": 255, "channel_type": "WEBHOOK_CHALLENGE", "challenge": "bkes654x09XY", "verify_token": "xxxxxx"}}

// 响应
{"challenge": "bkes654x09XY"}
```

## 接收事件

- 必须在 **1秒内** 返回 HTTP 200
- 默认数据经过 zlib 压缩，或在 URL 加 `compress=0` 关闭
- 需检查 `sn` 避免重复处理
- 需检查 `verify_token` 确保来源真实性

## 重试机制

| 重试次数 | 间隔 |
|---------|------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5 | 32s |

## 消息加密

采用 **AES-256-CBC** 算法。

解密步骤：
1. 密文 base64 解码
2. 前 16 位为 `iv`，之后为新密文
3. 新密文 base64 解码得到待解密数据
4. `encryptKey` 后补 `\0` 至 32 位得到 `key`
5. 用 AES-256-CBC 解密

```python
from Crypto.Cipher import AES
import base64

class Encrypt:
    def __init__(self, key, bs=32):
        pad = lambda s: s + (bs-len(s))*"\0"
        key = pad(key)
        self.key = key.encode('utf-8')

    def aes_decrypt(self, content):
        str = base64.b64decode(content)
        iv = str[0:16]
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        return cipher.decrypt(base64.b64decode(str[16:])).decode('utf-8')
```

---

# 四、事件格式

## 通用事件结构

```json
{
    "s": 0,
    "d": {
        "channel_type": "GROUP",  // GROUP=组播, PERSON=单播, BROADCAST=广播
        "type": 255,              // 消息类型
        "target_id": "xxx",       // 频道id或服务器id
        "author_id": "1",         // 发送者id，1=系统
        "content": "xxx",
        "msg_id": "xxx",
        "msg_timestamp": 1612703779612,
        "nonce": "",
        "extra": {}
    },
    "sn": 1
}
```

## 消息类型 (type)

| 值 | 类型 |
|----|------|
| 1 | 文字消息 |
| 2 | 图片消息 |
| 3 | 视频消息 |
| 4 | 文件消息 |
| 8 | 音频消息 |
| 9 | KMarkdown |
| 10 | Card 消息 |
| 255 | 系统消息 |

## 文字频道消息 extra (type 非 255)

| 字段 | 类型 | 说明 |
|------|------|------|
| type | int | 消息类型 |
| guild_id | string | 服务器 id |
| channel_name | string | 频道名 |
| mention | Array | 提及的用户 id |
| mention_all | boolean | 是否 mention 所有用户 |
| mention_roles | Array | mention 角色 |
| mention_here | boolean | 是否 mention 在线用户 |
| author | Map | 用户信息 |

## 系统事件 extra (type=255)

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 事件类型标识 |
| body | Map | 事件关联数据 |

## 所有系统事件类型

### 频道事件

| 事件 | extra.type | 说明 |
|------|-----------|------|
| 添加 reaction | `added_reaction` | body: msg_id, user_id, channel_id, emoji, channel_type |
| 取消 reaction | `deleted_reaction` | 同上 |
| 消息更新 | `updated_message` | body: msg_id, content, channel_id, mention, updated_at |
| 消息删除 | `deleted_message` | body: msg_id, channel_id |
| 新增频道 | `added_channel` | body: 频道完整信息 |
| 修改频道 | `updated_channel` | 同上 |
| 删除频道 | `deleted_channel` | body: id, deleted_at, type |
| 置顶消息 | `pinned_message` | body: channel_id, operator_id, msg_id |
| 取消置顶 | `unpinned_message` | 同上 |

### 服务器事件

| 事件 | extra.type | 说明 |
|------|-----------|------|
| 服务器更新 | `updated_guild` | body: id, name, user_id, icon, notify_type, region 等 |
| 服务器删除 | `deleted_guild` | 同上 |
| 封禁用户 | `added_block_list` | body: operator_id, remark, user_id[] |
| 取消封禁 | `deleted_block_list` | body: operator_id, user_id[] |
| 添加表情 | `added_emoji` | body: id, name |
| 删除表情 | `removed_emoji` | 同上 |
| 更新表情 | `updated_emoji` | 同上 |

### 用户事件

| 事件 | extra.type | 说明 |
|------|-----------|------|
| 加入语音频道 | `joined_channel` | body: user_id, channel_id, joined_at |
| 退出语音频道 | `exited_channel` | body: user_id, channel_id, exited_at |
| 用户信息更新 | `user_updated` | body: user_id, username, avatar |
| 加入服务器 | `self_joined_guild` | body: guild_id, state |
| 退出服务器 | `self_exited_guild` | body: guild_id |
| 按钮点击 | `message_btn_click` | body: msg_id, user_id, value, target_id |

---

# 五、频道消息接口 (/api/v3/message)

## 消息详情字段

| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | string | 消息 id |
| type | int | 消息类型 |
| author | map | 作者用户信息 |
| content | string | 消息内容（不超过 8000 字符） |
| mention | array | @用户 ID 数组 |
| mention_all | boolean | 是否 @全体 |
| mention_roles | array | @角色 ID 数组 |
| mention_here | boolean | 是否 @在线 |
| embeds | array | 超链接解析数据 |
| attachments | map | 附加多媒体数据 |
| reactions | array | 回应数据 |
| quote | map | 引用消息 |
| mention_info | map | @用户/角色详情 |

## 1. 获取消息列表

- **GET** `/api/v3/message/list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| target_id | string | 是 | 频道 id |
| msg_id | string | 否 | 参考消息 id，不传查最新 |
| pin | unsigned int | 否 | 0 或 1，是否查置顶消息 |
| flag | string | 否 | before/around/after，查询模式 |
| page_size | int | 否 | 默认 50 |

## 2. 获取消息详情

- **GET** `/api/v3/message/view`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |

## 3. 发送消息

- **POST** `/api/v3/message/create`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| type | int | 否 | 9=KMarkdown, 10=卡片消息，默认 9 |
| target_id | string | 是 | 目标频道 id |
| content | string | 是 | 消息内容 |
| quote | string | 否 | 回复的 msgId |
| nonce | string | 否 | 随机串，原样返回 |
| temp_target_id | string | 否 | 临时消息用户 id |
| template_id | string | 否 | 模板消息 id |
| reply_msg_id | string | 否 | 回复用户5分钟内消息的 msg_id |

返回：`msg_id`, `msg_timestamp`, `nonce`

## 4. 更新消息

- **POST** `/api/v3/message/update`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |
| content | string | 是 | 消息内容 |
| quote | string | 否 | 空=删除回复，不传=无影响 |

## 5. 删除消息

- **POST** `/api/v3/message/delete`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |

## 6. 获取回应用户列表

- **GET** `/api/v3/message/reaction-list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |
| emoji | string | 是 | emoji id（需 urlencode） |

## 7. 添加回应

- **POST** `/api/v3/message/add-reaction`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |
| emoji | string | 是 | emoji id |

## 8. 删除回应

- **POST** `/api/v3/message/delete-reaction`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |
| emoji | string | 是 | emoji id |
| user_id | string | 否 | 用户 id，不填=自己 |

## 9. 发送管道消息

- **POST** `/api/v3/message/send-pipemsg`

需在开发者后台先创建管道。GET 参数同 message/create，POST 区域根据是否使用模板而不同。

## 10. 置顶消息

- **POST** `/api/v3/message/pin` — 需要管理消息权限

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| msg_id | string | 是 | 消息 id |
| target_id | string | 是 | 频道 id |

## 11. 取消置顶

- **POST** `/api/v3/message/unpin` — 同上

---

# 六、频道接口 (/api/v3/channel)

## 1. 获取频道列表

- **GET** `/api/v3/channel/list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| type | integer | 否 | 1=文字, 2=语音, 默认 1 |
| parent_id | string | 否 | 父分组频道 id |

## 2. 获取频道详情

- **GET** `/api/v3/channel/view`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| target_id | string | 是 | 频道 id |
| need_children | bool | 否 | 是否获取子频道 |

返回关键字段：`id`, `guild_id`, `user_id`, `parent_id`, `name`, `topic`, `type` (0=分组,1=文字,2=语音), `level`, `slow_mode`, `has_password`, `limit_amount`, `is_category`, `permission_sync`, `permission_overwrites`, `permission_users`, `voice_quality` (1=流畅,2=正常,3=高质量), `server_url`, `children`

## 3. 创建频道

- **POST** `/api/v3/channel/create`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| name | string | 是 | 频道名称 |
| parent_id | string | 否 | 父分组 id |
| type | int | 否 | 1=文字, 2=语音, 默认 1 |
| limit_amount | int | 否 | 语音人数限制，最大 99 |
| voice_quality | string | 否 | 1=流畅, 2=正常, 3=高质量 |
| is_category | int | 否 | 1=分组，此时只接收 guild_id, name, is_category |

## 4. 编辑频道

- **POST** `/api/v3/channel/update`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 ID |
| name | string | 否 | 频道名称 |
| level | int | 否 | 排序 |
| parent_id | string | 否 | 分组 ID，设为 0 移出分组 |
| topic | string | 否 | 频道简介 |
| slow_mode | int | 否 | 慢速模式(ms)，支持: 0,5000,10000,15000,30000,60000,120000,300000,600000,900000,1800000,3600000,7200000,21600000 |
| limit_amount | int | 否 | 人数限制，最大99 |
| voice_quality | string | 否 | 1/2/3 |
| password | string | 否 | 语音频道密码 |

## 5. 删除频道

- **POST** `/api/v3/channel/delete`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |

## 6. 语音频道用户列表

- **GET** `/api/v3/channel/user-list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |

## 7. 移动用户

- **POST** `/api/v3/channel/move-user`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| target_id | string | 是 | 目标语音频道 id |
| user_ids | array | 是 | 用户 id 数组 |

## 8. 踢出语音用户

- **POST** `/api/v3/channel/kickout`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 语音频道 id |
| user_id | string | 是 | 用户 id |

## 9-13. 频道角色权限

- **GET** `/api/v3/channel-role/index` — 获取权限详情
- **POST** `/api/v3/channel-role/create` — 创建权限
- **POST** `/api/v3/channel-role/update` — 更新权限
- **POST** `/api/v3/channel-role/sync` — 同步权限
- **POST** `/api/v3/channel-role/delete` — 删除权限

参数：`channel_id`(必传), `type`("role_id"/"user_id"), `value`, `allow`, `deny`

---

# 七、服务器接口 (/api/v3/guild)

## 1. 获取服务器列表

- **GET** `/api/v3/guild/list`

返回字段：`id`, `name`, `topic`, `user_id`, `icon`, `notify_type` (0=默认,1=所有,2=仅@,3=不接收), `region`, `enable_open`, `open_id`, `default_channel_id`, `welcome_channel_id`, `boost_num`, `level`

## 2. 获取服务器详情

- **GET** `/api/v3/guild/view`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |

额外返回：`roles`, `channels`

## 3. 获取服务器用户列表

- **GET** `/api/v3/guild/user-list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| channel_id | string | 否 | 频道 id |
| search | string | 否 | 搜索关键字 |
| role_id | integer | 否 | 角色 ID |
| mobile_verified | integer | 否 | 0=未认证, 1=已认证 |
| active_time | integer | 否 | 活跃时间排序 |
| joined_at | integer | 否 | 加入时间排序 |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |
| filter_user_id | string | 否 | 指定用户 id |

返回：`user_count`, `online_count`, `offline_count`, `items`

## 4. 修改用户昵称

- **POST** `/api/v3/guild/nickname`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 ID |
| nickname | string | 否 | 2-64长度，不传=清空 |
| user_id | string | 否 | 目标用户 ID，不传=自己 |

## 5. 离开服务器

- **POST** `/api/v3/guild/leave`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |

## 6. 踢出服务器

- **POST** `/api/v3/guild/kickout`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 ID |
| target_id | string | 是 | 目标用户 ID |

## 7-9. 静音闭麦

- **GET** `/api/v3/guild-mute/list` — 获取列表
- **POST** `/api/v3/guild-mute/create` — 添加静音
- **POST** `/api/v3/guild-mute/delete` — 删除静音

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| user_id | string | 是 | 用户 id |
| type | int | 是 | 1=麦克风闭麦, 2=耳机静音 |

## 10. 服务器助力历史

- **GET** `/api/v3/guild-boost/history` — 需要服务器管理权限

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| start_time | int | 否 | 开始时间(unix秒) |
| end_time | int | 否 | 结束时间(unix秒) |

---

# 八、角色接口 (/api/v3/guild-role)

## 权限比特位

| 位 | 值 | 权限 |
|----|------|------|
| 0 | 1 | 管理员 |
| 1 | 2 | 管理服务器 |
| 2 | 4 | 查看管理日志 |
| 3 | 8 | 创建服务器邀请 |
| 4 | 16 | 管理邀请 |
| 5 | 32 | 频道管理 |
| 6 | 64 | 踢出用户 |
| 7 | 128 | 封禁用户 |
| 8 | 256 | 管理自定义表情 |
| 9 | 512 | 修改服务器昵称 |
| 10 | 1024 | 管理角色权限 |
| 11 | 2048 | 查看文字/语音频道 |
| 12 | 4096 | 发布消息 |
| 13 | 8192 | 管理消息 |
| 14 | 16384 | 上传文件 |
| 15 | 32768 | 语音链接 |
| 16 | 65536 | 语音管理 |
| 17 | 131072 | 提及@全体成员 |
| 18 | 262144 | 添加反应 |
| 19 | 524288 | 跟随添加反应 |
| 20 | 1048576 | 被动连接语音频道 |
| 21 | 2097152 | 仅使用按键说话 |
| 22 | 4194304 | 使用自由麦 |
| 23 | 8388608 | 说话 |
| 24 | 16777216 | 服务器静音 |
| 25 | 33554432 | 服务器闭麦 |
| 26 | 67108864 | 修改他人昵称 |
| 27 | 134217728 | 播放伴奏 |
| 28 | 268435456 | 屏幕分享 |
| 29 | 536870912 | 回复帖子 |
| 30 | 1073741824 | 开启录音 |

## 接口

1. **GET** `/api/v3/guild-role/list` — 获取角色列表
2. **POST** `/api/v3/guild-role/create` — 创建角色
3. **POST** `/api/v3/guild-role/update` — 更新角色
4. **POST** `/api/v3/guild-role/delete` — 删除角色
5. **POST** `/api/v3/guild-role/grant` — 赋予用户角色
6. **POST** `/api/v3/guild-role/revoke` — 删除用户角色

### 角色字段

| 参数名 | 类型 | 说明 |
|--------|------|------|
| role_id | unsigned int | 角色 id |
| name | string | 角色名称 |
| color | unsigned int | 色值 0x000000-0xFFFFFF |
| position | unsigned int | 排序，值越小越靠前 |
| hoist | unsigned int | 0/1，是否排到前面 |
| mentionable | unsigned int | 0/1，是否可被提及 |
| permissions | unsigned int | 权限值 |

### grant/revoke 参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| user_id | string | 是 | 用户 id |
| role_id | unsigned int | 是 | 角色 id |

---

# 九、用户接口 (/api/v3/user)

## 1. 获取当前用户信息

- **GET** `/api/v3/user/me`

返回字段：`id`, `username`, `identify_num`, `online`, `os`, `status`(0/1=正常,10=封禁), `avatar`, `vip_avatar`, `banner`, `nickname`, `roles`, `is_vip`, `vip_amp`, `bot`, `bot_status`, `tag_info`, `mobile_verified`, `is_sys`, `client_id`, `verified`, `mobile_prefix`, `mobile`, `invited_count`, `intent`

## 2. 获取目标用户信息

- **GET** `/api/v3/user/view`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户 id |
| guild_id | string | 否 | 服务器 id |

额外返回：`joined_at`, `active_time`, `kpm_vip`, `wealth_level`

## 3. 下线机器人

- **POST** `/api/v3/user/offline` — 仅 webhook 使用

## 4. 上线机器人

- **POST** `/api/v3/user/online` — 仅 webhook 使用

## 5. 获取在线状态

- **GET** `/api/v3/user/get-online-status`

返回：`online`(boolean), `online_os`(Array[String])

---

# 十、私信消息接口 (/api/v3/direct-message)

## 1. 获取私信列表

- **GET** `/api/v3/direct-message/list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| chat_code | string | 否 | 私信会话 Code |
| target_id | string | 否 | 目标用户 id |
| msg_id | string | 否 | 参考消息 id |
| flag | string | 否 | before/around/after |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 默认 50 |

## 2. 获取私信详情

- **GET** `/api/v3/direct-message/view`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| chat_code | string | 是 | 私信会话 Code |
| msg_id | string | 是 | 消息 id |

## 3. 发送私信

- **POST** `/api/v3/direct-message/create`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| type | int | 否 | 1=文本, 9=KMarkdown, 10=卡片，默认 1 |
| target_id | string | 否 | 目标用户 id |
| chat_code | string | 否 | 会话 Code |
| content | string | 是 | 消息内容 |
| quote | string | 否 | 回复的 msgId |
| nonce | string | 否 | 随机串 |
| template_id | string | 否 | 模板消息 id |
| reply_msg_id | string | 否 | 回复用户5分钟内消息 |

返回：`msg_id`, `msg_timestamp`, `nonce`

## 4-8. 更新/删除/回应

- **POST** `/api/v3/direct-message/update` — 更新私信
- **POST** `/api/v3/direct-message/delete` — 删除私信
- **GET** `/api/v3/direct-message/reaction-list` — 回应列表
- **POST** `/api/v3/direct-message/add-reaction` — 添加回应
- **POST** `/api/v3/direct-message/delete-reaction` — 删除回应

---

# 十一、私信会话接口 (/api/v3/user-chat)

## 1-4 接口

- **GET** `/api/v3/user-chat/list` — 获取会话列表
- **GET** `/api/v3/user-chat/view` — 获取会话详情（需 chat_code）
- **POST** `/api/v3/user-chat/create` — 创建会话（需 target_id）
- **POST** `/api/v3/user-chat/delete` — 删除会话（需 chat_code）

### 会话字段

| 参数名 | 类型 | 说明 |
|--------|------|------|
| code | string | 私信会话 Code |
| last_read_time | int | 上次阅读时间(ms) |
| latest_msg_time | int | 最新消息时间(ms) |
| unread_count | int | 未读消息数 |
| is_friend | boolean | 是否好友 |
| is_blocked | boolean | 是否已屏蔽 |
| is_target_blocked | boolean | 是否被屏蔽 |
| target_info | map | 目标用户信息 |

---

# 十二、邀请接口 (/api/v3/invite)

## 1-3 接口

- **GET** `/api/v3/invite/list` — 获取邀请列表
- **POST** `/api/v3/invite/create` — 创建邀请链接
- **POST** `/api/v3/invite/delete` — 删除邀请链接

### 创建参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 否 | 服务器 id |
| channel_id | string | 否 | 频道 id |
| duration | integer | 否 | 有效时长(秒)，默认 7 天。0=永不, 1800=0.5h, 3600=1h, 21600=6h, 43200=12h, 86400=1天, 604800=7天 |
| setting_times | integer | 否 | 使用次数，默认 -1=无限制, 1/5/10/25/50/100 |

### 删除参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| url_code | string | 是 | 邀请码 |
| guild_id | string | 否 | 服务器 id |
| channel_id | string | 否 | 频道 id |

---

# 十三、表情接口 (/api/v3/guild-emoji)

## 1-4 接口

- **GET** `/api/v3/guild-emoji/list` — 获取列表（需 guild_id）
- **POST** `/api/v3/guild-emoji/create` — 创建表情（Content-Type: multipart/form-data）
- **POST** `/api/v3/guild-emoji/update` — 更新表情
- **POST** `/api/v3/guild-emoji/delete` — 删除表情

### 创建参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| name | string | 否 | 2-32 字符 |
| guild_id | string | 是 | 服务器 id |
| emoji | binary | 是 | PNG, ≤256KB |

### 更新参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| name | string | 是 | 表情名 2-32 字符 |
| id | string | 是 | 表情 ID |

### 删除参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| id | string | 是 | 表情 ID |

---

# 十四、黑名单接口 (/api/v3/blacklist)

需要**封禁用户**权限。

## 1-3 接口

- **GET** `/api/v3/blacklist/list` — 获取列表
- **POST** `/api/v3/blacklist/create` — 加入黑名单
- **POST** `/api/v3/blacklist/delete` — 移除黑名单

### 加入参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| target_id | string | 是 | 目标用户 id |
| remark | string | 否 | 封禁原因 |
| del_msg_days | int | 否 | 删除最近几天消息，最大 7 天，默认 0 |

### 移除参数

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| guild_id | string | 是 | 服务器 id |
| target_id | string | 是 | 目标用户 id |

---

# 十五、资源上传接口 (/api/v3/asset)

## 上传媒体文件

- **POST** `/api/v3/asset/create` — Content-Type: multipart/form-data

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| file | binary | 是 | 图片/视频(.mp4 .mov)/文件 |

返回：`url`(资源地址)

---

# 十六、帖子接口 (/api/v3/thread)

## 关键词定义

| 关键词 | 解释 |
|--------|------|
| 主楼 | 帖子发帖者发送帖子时的内容 |
| 回复 | 帖子的一级回复 |
| 楼中楼 | 帖子回复的回复 |

## 1. 获取帖子分区列表

- **GET** `/api/v3/category/list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 帖子频道 id |

返回字段：`id`, `name`, `allow`, `deny`, `roles`

## 2. 创建帖子

- **POST** `/api/v3/thread/create`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |
| guild_id | string | 是 | 服务器 id |
| category_id | string | 否 | 分区 id |
| title | string | 是 | 标题 |
| cover | string | 否 | 封面 url |
| content | string | 是 | 卡片消息内容 |

## 3. 评论/回复

- **POST** `/api/v3/thread/reply`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |
| thread_id | string | 是 | 帖子 id |
| reply_id | string | 否 | 回复的 post_id，评论主楼不传 |
| content | string | 是 | 文本 |

## 4. 帖子详情

- **GET** `/api/v3/thread/view`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |
| thread_id | string | 是 | 帖子 id |

额外返回：`latest_active_time`, `create_time`, `is_updated`, `content_deleted`, `collect_num`, `post_count`

## 5. 帖子列表

- **GET** `/api/v3/thread/list`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |
| category_id | string | 否 | 分区 id |
| sort | int | 否 | 1=最新回复, 2=最新创建 |
| page_size | int | 否 | 默认 30 |
| time | int | 否 | 翻页时间 |

## 6. 删除帖子/评论/回复

- **POST** `/api/v3/thread/delete`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |
| thread_id | string | 否 | 帖子 id |
| post_id | string | 否 | 评论/回复 id |

## 7. 回复列表

- **GET** `/api/v3/thread/post`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 频道 id |
| thread_id | string | 是 | 帖子 id |
| post_id | string | 否 | 楼中楼需要 |
| order | string | 是 | asc/desc |
| page | string | 是 | 页码 |
| page_size | string | 否 | 每页数量 |
| time | string | 否 | 分页时间 |

---

# 十七、语音接口 (/api/v3/voice)

## 1. 加入语音频道

- **POST** `/api/v3/voice/join`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 语音频道 id |
| audio_ssrc | string | 否 | 默认 1111 |
| audio_pt | string | 否 | 默认 111 |
| rtcp_mux | boolean | 否 | 默认 true |
| password | string | 否 | 频道密码 |

返回：`ip`, `port`, `rtcp_mux`, `rtcp_port`, `bitrate`, `audio_ssrc`, `audio_pt`

FFmpeg 推流示例：
```bash
ffmpeg -i 'test.mp3' -re -map '0:a:0' -acodec libopus -ab 48k -ac 2 -ar 48000 \
  -filter:a 'volume=0.8' -f tee \
  '[select=a:f=rtp:ssrc=1111:payload_type=111]rtp://127.0.0.1:1000?rtcpport=1001'
```

## 2. 获取机器人加入的语音频道列表

- **GET** `/api/v3/voice/list`

返回：`id`, `guild_id`, `parent_id`, `name`

## 3. 离开语音频道

- **POST** `/api/v3/voice/leave`

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 语音频道 id |

## 4. 保持语音连接活跃

- **POST** `/api/v3/voice/keep-alive`

每隔 45 秒调用一次，防止系统回收端口。

| 参数名 | 类型 | 必传 | 说明 |
|--------|------|------|------|
| channel_id | string | 是 | 语音频道 id |

---

# 十八、卡片消息 (CardMessage)

## 结构概览

| 类别 | 子元素字段 | 说明 |
|------|-----------|------|
| 卡片 | `modules` | 目前只有 `card` |
| 模块 | `elements` | `section`, `header`, `context` 等 |
| 元素 | — | `plain-text`, `image`, `button` 等 |
| 结构 | `fields` | 目前只有 `paragraph` |

## 限制

- 一条卡片消息最多 **5 个卡片**
- 所有卡片的模块总和最多 **50 个**
- 发送类型为 **10**

## 卡片 (card)

```json
{
    "type": "card",
    "theme": "primary",
    "color": "#aaaaaa",
    "size": "sm|lg",
    "modules": []
}
```

- `theme`: primary, success, danger, warning, info, secondary, none, invisible
- `color`: 16 进制色值，优先于 theme
- `size`: sm/lg，lg 仅 PC 有效
- `invisible` 模式下仅可用: context, action-group, divider, header, container, section(无accessory), file, audio, video

## 模块

### header — 标题

```json
{"type": "header", "text": {"type": "plain-text", "content": "标题"}}
```
文本不超过 100 字。

### section — 内容

```json
{"type": "section", "mode": "left|right", "text": {...}, "accessory": {"type": "image|button"}}
```
button 不能放在左侧。

### image-group — 图片组

```json
{"type": "image-group", "elements": [{"type": "image", "src": "..."}]}
```
1-9 张图片。

### container — 容器

类似 image-group 但不裁切为正方形，多图纵向排列。1-9 张。

### action-group — 交互

```json
{"type": "action-group", "elements": [{"type": "button", ...}]}
```
最多 4 个按钮。

### context — 备注

```json
{"type": "context", "elements": [...]}
```
最多 10 个元素（plain-text/kmarkdown/image）。

### divider — 分割线

```json
{"type": "divider"}
```

### file/audio/video — 媒体

```json
{"type": "file|audio|video", "src": "", "title": "", "cover": ""}
```
cover 仅音频有效。

### countdown — 倒计时

```json
{"type": "countdown", "endTime": 1608819168000, "startTime": 1608819168000, "mode": "day|hour|second"}
```

### invite — 邀请

```json
{"type": "invite", "code": "邀请码或链接"}
```

## 元素

### plain-text — 普通文本

```json
{"type": "plain-text", "content": "", "emoji": true}
```
最大 2000 字。可简化为字符串。

### kmarkdown

```json
{"type": "kmarkdown", "content": "**hello**"}
```
最大 5000 字。

### image — 图片

```json
{"type": "image", "src": "", "alt": "", "size": "sm|lg", "circle": false, "fallbackUrl": ""}
```
支持 jpeg/gif/png。

### button — 按钮

```json
{"type": "button", "theme": "primary|warning|info|danger", "value": "", "click": "", "text": ""}
```
- `value`: string
- `click`: ""(无事件), "link"(跳转), "return-val"(回传值)

## 结构体

### paragraph — 区域文本

```json
{"type": "paragraph", "cols": 3, "fields": []}
```
cols 1-3，移动端忽略。最多 50 个 fields。

---

# 附录：接口总览

| 接口路径 | 方法 | 说明 |
|---------|------|------|
| /api/v3/gateway/index | GET | 获取网关地址 |
| /api/v3/message/list | GET | 获取消息列表 |
| /api/v3/message/view | GET | 获取消息详情 |
| /api/v3/message/create | POST | 发送消息 |
| /api/v3/message/update | POST | 更新消息 |
| /api/v3/message/delete | POST | 删除消息 |
| /api/v3/message/reaction-list | GET | 回应用户列表 |
| /api/v3/message/add-reaction | POST | 添加回应 |
| /api/v3/message/delete-reaction | POST | 删除回应 |
| /api/v3/message/send-pipemsg | POST | 发送管道消息 |
| /api/v3/message/pin | POST | 置顶消息 |
| /api/v3/message/unpin | POST | 取消置顶 |
| /api/v3/channel/list | GET | 获取频道列表 |
| /api/v3/channel/view | GET | 获取频道详情 |
| /api/v3/channel/create | POST | 创建频道 |
| /api/v3/channel/update | POST | 编辑频道 |
| /api/v3/channel/delete | POST | 删除频道 |
| /api/v3/channel/user-list | GET | 语音频道用户列表 |
| /api/v3/channel/move-user | POST | 移动用户 |
| /api/v3/channel/kickout | POST | 踢出语音用户 |
| /api/v3/channel-role/index | GET | 频道角色权限详情 |
| /api/v3/channel-role/create | POST | 创建频道角色权限 |
| /api/v3/channel-role/update | POST | 更新频道角色权限 |
| /api/v3/channel-role/sync | POST | 同步频道角色权限 |
| /api/v3/channel-role/delete | POST | 删除频道角色权限 |
| /api/v3/guild/list | GET | 获取服务器列表 |
| /api/v3/guild/view | GET | 获取服务器详情 |
| /api/v3/guild/user-list | GET | 服务器用户列表 |
| /api/v3/guild/nickname | POST | 修改用户昵称 |
| /api/v3/guild/leave | POST | 离开服务器 |
| /api/v3/guild/kickout | POST | 踢出服务器 |
| /api/v3/guild-mute/list | GET | 静音闭麦列表 |
| /api/v3/guild-mute/create | POST | 添加静音闭麦 |
| /api/v3/guild-mute/delete | POST | 删除静音闭麦 |
| /api/v3/guild-boost/history | GET | 服务器助力历史 |
| /api/v3/guild-role/list | GET | 获取角色列表 |
| /api/v3/guild-role/create | POST | 创建角色 |
| /api/v3/guild-role/update | POST | 更新角色 |
| /api/v3/guild-role/delete | POST | 删除角色 |
| /api/v3/guild-role/grant | POST | 赋予用户角色 |
| /api/v3/guild-role/revoke | POST | 删除用户角色 |
| /api/v3/user/me | GET | 获取当前用户 |
| /api/v3/user/view | GET | 获取目标用户 |
| /api/v3/user/offline | POST | 下线机器人 |
| /api/v3/user/online | POST | 上线机器人 |
| /api/v3/user/get-online-status | GET | 获取在线状态 |
| /api/v3/direct-message/list | GET | 获取私信列表 |
| /api/v3/direct-message/view | GET | 获取私信详情 |
| /api/v3/direct-message/create | POST | 发送私信 |
| /api/v3/direct-message/update | POST | 更新私信 |
| /api/v3/direct-message/delete | POST | 删除私信 |
| /api/v3/direct-message/reaction-list | GET | 私信回应列表 |
| /api/v3/direct-message/add-reaction | POST | 添加私信回应 |
| /api/v3/direct-message/delete-reaction | POST | 删除私信回应 |
| /api/v3/user-chat/list | GET | 获取私信会话列表 |
| /api/v3/user-chat/view | GET | 获取私信会话详情 |
| /api/v3/user-chat/create | POST | 创建私信会话 |
| /api/v3/user-chat/delete | POST | 删除私信会话 |
| /api/v3/invite/list | GET | 获取邀请列表 |
| /api/v3/invite/create | POST | 创建邀请链接 |
| /api/v3/invite/delete | POST | 删除邀请链接 |
| /api/v3/guild-emoji/list | GET | 获取服务器表情列表 |
| /api/v3/guild-emoji/create | POST | 创建服务器表情 |
| /api/v3/guild-emoji/update | POST | 更新服务器表情 |
| /api/v3/guild-emoji/delete | POST | 删除服务器表情 |
| /api/v3/blacklist/list | GET | 获取黑名单列表 |
| /api/v3/blacklist/create | POST | 加入黑名单 |
| /api/v3/blacklist/delete | POST | 移除黑名单 |
| /api/v3/asset/create | POST | 上传媒体文件 |
| /api/v3/category/list | GET | 获取帖子分区列表 |
| /api/v3/thread/create | POST | 创建帖子 |
| /api/v3/thread/reply | POST | 评论/回复 |
| /api/v3/thread/view | GET | 帖子详情 |
| /api/v3/thread/list | GET | 帖子列表 |
| /api/v3/thread/delete | POST | 删除帖子/评论 |
| /api/v3/thread/post | GET | 回复列表 |
| /api/v3/voice/join | POST | 加入语音频道 |
| /api/v3/voice/list | GET | 获取语音频道列表 |
| /api/v3/voice/leave | POST | 离开语音频道 |
| /api/v3/voice/keep-alive | POST | 保持语音连接活跃 |
