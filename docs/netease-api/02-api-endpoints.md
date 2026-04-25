# API 接口列表

> 共 354+ 个接口，按功能分类整理

## 一、用户与登录

| 接口名 | 说明 |
|--------|------|
| `login_cellphone` | 手机号登录 |
| `login` | 邮箱登录 |
| `login_qr_key` | 二维码登录 - 获取 key |
| `login_qr_create` | 二维码登录 - 生成二维码 |
| `login_qr_check` | 二维码登录 - 检测扫码状态 |
| `login_refresh` | 刷新登录状态 |
| `login_status` | 获取登录状态 |
| `logout` | 退出登录 |
| `captcha_sent` | 发送验证码 |
| `captcha_verify` | 校验验证码 |
| `register_cellphone` | 手机号注册 |
| `register_anonimous` | 匿名注册 |
| `cellphone_existence_check` | 检测手机号是否已注册 |
| `user_detail` | 获取用户详情 |
| `user_detail_new` | 获取用户详情(新版) |
| `user_account` | 账号信息 |
| `user_level` | 用户等级信息 |
| `user_binding` | 用户绑定信息 |
| `user_bindingcellphone` | 绑定手机 |
| `user_replacephone` | 更换绑定手机 |
| `user_subcount` | 获取用户歌单/收藏/mv/dj 数量 |
| `user_update` | 更新用户信息 |
| `user_medal` | 用户徽章 |
| `user_social_status` | 用户状态 |
| `user_social_status_edit` | 编辑用户状态 |
| `user_social_status_support` | 支持设置的状态 |
| `user_social_status_rcmd` | 相同状态的用户 |
| `user_mutualfollow_get` | 用户是否互相关注 |
| `activate_init_profile` | 初始化昵称 |
| `avatar_upload` | 更新头像 |
| `setting` | 设置 |
| `rebind` | 重新绑定 |
| `verify_getQr` | 验证接口 - 二维码生成 |
| `verify_qrcodestatus` | 验证接口 - 二维码检测 |
| `nickname_check` | 重复昵称检测 |
| `creator_authinfo_get` | 创作者认证信息 |

## 二、搜索

| 接口名 | 说明 |
|--------|------|
| `search` | 搜索 |
| `cloudsearch` | 云搜索（搜索多重匹配） |
| `search_suggest` | 搜索建议 |
| `search_hot` | 热搜列表（简略） |
| `search_hot_detail` | 热搜列表（详细） |
| `search_default` | 默认搜索关键词 |
| `search_match` | 搜索匹配 |
| `search_multimatch` | 搜索多重匹配 |
| `ugc_artist_search` | 搜索歌手 |

搜索类型枚举 `SearchType`：

| 值 | 类型 |
|----|------|
| 1 | 单曲 (single) |
| 10 | 专辑 (album) |
| 100 | 歌手 (artist) |
| 1000 | 歌单 (playlist) |
| 1002 | 用户 (user) |
| 1004 | MV (mv) |
| 1006 | 歌词 (lyric) |
| 1009 | 电台 (dj) |
| 1014 | 视频 (video) |
| 1018 | 综合 (complex) |

## 三、歌曲与音乐

| 接口名 | 说明 |
|--------|------|
| `song_detail` | 获取歌曲详情 |
| `song_url` | 获取音乐 url |
| `song_url_v1` | 获取音乐 url（新版） |
| `song_download_url` | 获取客户端歌曲下载 url |
| `song_download_url_v1` | 获取客户端歌曲下载链接（新版） |
| `song_music_detail` | 获取歌曲详情 |
| `check_music` | 音乐是否可用检查 |
| `lyric` | 获取歌词 |
| `lyric_new` | 获取歌词（新版） |
| `lyric_new` | 获取逐字歌词 |
| `song_dynamic_cover` | 歌曲动态封面 |
| `song_like_check` | 歌曲是否喜爱 |
| `song_red_count` | 歌曲红心数量 |
| `song_chorus` | 副歌时间 |
| `song_wiki_summary` | 歌曲简要百科信息 |
| `song_purchased` | 已购单曲 |
| `song_downlist` | 会员下载歌曲记录 |
| `song_monthdownlist` | 会员本月下载歌曲记录 |
| `song_singledownlist` | 已购买单曲 |
| `song_lyrics_mark` | 歌词摘录信息 |
| `song_lyrics_mark_add` | 添加/修改摘录歌词 |
| `song_lyrics_mark_del` | 删除摘录歌词 |
| `song_lyrics_mark_user_page` | 我的歌词本 |
| `like` | 喜欢音乐 |
| `likelist` | 喜欢音乐列表（无序） |
| `scrobble` | 听歌打卡 |
| `fm_trash` | 垃圾桶 |
| `personal_fm` | 私人 FM |
| `personal_fm_mode` | 私人 FM 模式选择 |
| `song_order_update` | 调整歌曲顺序 |
| `audio_match` | 听歌识曲 |
| `music_first_listen_info` | 歌曲首次收听信息 |

## 四、歌手

| 接口名 | 说明 |
|--------|------|
| `artists` | 获取歌手单曲 |
| `artist_album` | 获取歌手专辑 |
| `artist_desc` | 获取歌手描述 |
| `artist_detail` | 歌手详情 |
| `artist_detail_dynamic` | 歌手动态信息 |
| `artist_mv` | 获取歌手 mv |
| `artist_new_mv` | 关注歌手新 MV |
| `artist_new_song` | 关注歌手新歌 |
| `artist_songs` | 歌手全部歌曲 |
| `artist_top_song` | 歌手热门 50 首歌曲 |
| `artist_video` | 获取歌手视频 |
| `artist_list` | 歌手分类列表 |
| `artist_sub` | 收藏/取消收藏歌手 |
| `artist_sublist` | 收藏的歌手列表 |
| `artist_fans` | 歌手粉丝 |
| `artist_follow_count` | 歌手粉丝数量 |
| `top_artists` | 热门歌手 |
| `simi_artist` | 获取相似歌手 |
| `ugc_artist_get` | 歌手粉丝数量 |
| `follow` | 关注用户 |

## 五、专辑

| 接口名 | 说明 |
|--------|------|
| `album` | 获取专辑内容 |
| `album_detail` | 专辑详情 |
| `album_detail_dynamic` | 专辑动态信息 |
| `album_list` | 专辑列表 |
| `album_list_style` | 专辑列表（按风格） |
| `album_new` | 全部新碟 |
| `album_newest` | 最新专辑 |
| `album_privilege` | 专辑特权 |
| `album_songsaleboard` | 数字专辑销量 |
| `album_sub` | 收藏/取消收藏专辑 |
| `album_sublist` | 已收藏专辑列表 |
| `album_wiki_summary` | 专辑简要百科信息 |
| `top_album` | 新碟上架 |

## 六、歌单

| 接口名 | 说明 |
|--------|------|
| `playlist_detail` | 获取歌单详情 |
| `playlist_detail_dynamic` | 歌单详情动态 |
| `playlist_create` | 新建歌单 |
| `playlist_delete` | 删除歌单 |
| `playlist_update` | 更新歌单 |
| `playlist_name_update` | 更新歌单名 |
| `playlist_desc_update` | 更新歌单描述 |
| `playlist_tags_update` | 更新歌单标签 |
| `playlist_cover_update` | 歌单封面上传 |
| `playlist_subscribe` | 收藏/取消收藏歌单 |
| `playlist_subscribers` | 歌单收藏者列表 |
| `playlist_tracks` | 对歌单添加或删除歌曲 |
| `playlist_track_all` | 获取歌单所有歌曲 |
| `playlist_track_add` | 收藏单曲到歌单 |
| `playlist_track_delete` | 删除歌单里的歌曲 |
| `playlist_order_update` | 调整歌单顺序 |
| `playlist_privacy` | 公开隐私歌单 |
| `playlist_hot` | 歌单 (网友精选碟) |
| `playlist_catlist` | 歌单分类 |
| `playlist_category_list` | 歌单分类列表 |
| `playlist_highquality_tags` | 精品歌单标签列表 |
| `playlist_mylike` | 用户的创建歌单列表 |
| `playlist_user_collect` | 用户的收藏歌单列表 |
| `playlist_import_name_task_create` | 歌单导入 - 创建任务 |
| `playlist_import_task_status` | 歌单导入 - 任务状态 |
| `playlist_update_playcount` | 歌单更新播放量 |
| `playlist_detail_rcmd_get` | 相关歌单推荐 |
| `top_playlist` | 获取推荐歌单 |
| `top_playlist_highquality` | 获取精品歌单 |
| `related_playlist` | 相关歌单 |
| `personalized` | 推荐歌单 |
| `recommend_resource` | 获取每日推荐歌单 |
| `simi_playlist` | 获取相似歌单 |
| `user_playlist` | 获取用户歌单 |

## 七、歌词

| 接口名 | 说明 |
|--------|------|
| `lyric` | 获取歌词 |
| `lyric_new` | 获取歌词（新版，含逐字歌词） |
| `song_lyrics_mark` | 歌词摘录信息 |
| `song_lyrics_mark_add` | 添加/修改摘录歌词 |
| `song_lyrics_mark_del` | 删除摘录歌词 |
| `song_lyrics_mark_user_page` | 我的歌词本 |
| `voice_lyric` | 获取声音歌词 |

## 八、MV 与视频

| 接口名 | 说明 |
|--------|------|
| `mv_all` | 全部 mv |
| `mv_detail` | MV 详情 |
| `mv_detail_info` | 获取 mv 点赞转发评论数数据 |
| `mv_exclusive_rcmd` | 网易出品 mv |
| `mv_first` | 最新 mv |
| `mv_sub` | 收藏/取消收藏 MV |
| `mv_sublist` | 收藏的 MV 列表 |
| `mv_url` | mv 地址 |
| `top_mv` | 推荐 mv |
| `simi_mv` | 相似 mv |
| `personalized_mv` | 推荐 mv |
| `video_category_list` | 获取视频分类列表 |
| `video_detail` | 视频详情 |
| `video_detail_info` | 获取视频点赞转发评论数数据 |
| `video_group` | 获取视频标签/分类下的视频 |
| `video_group_list` | 获取视频标签列表 |
| `video_sub` | 收藏视频 |
| `video_timeline_all` | 获取全部视频列表 |
| `video_timeline_recommend` | 获取推荐视频 |
| `video_url` | 获取视频播放地址 |
| `related_allvideo` | 相关视频 |
| `mlog_url` | 获取 mlog 播放地址 |
| `mlog_to_video` | 将 mlog id 转为视频 id |
| `mlog_music_rcmd` | 获取推荐视频 |

## 九、评论

| 接口名 | 说明 |
|--------|------|
| `comment` | 发送/删除/回复评论 |
| `comment_music` | 歌曲评论 |
| `comment_album` | 专辑评论 |
| `comment_playlist` | 歌单评论 |
| `comment_mv` | mv 评论 |
| `comment_dj` | 电台节目评论 |
| `comment_video` | 视频评论 |
| `comment_event` | 动态评论 |
| `comment_floor` | 楼层评论 |
| `comment_hot` | 热门评论 |
| `comment_new` | 新版评论 |
| `comment_like` | 给评论点赞 |
| `comment_hotwall_list` | 热门话题评论 |
| `comment_hug_list` | 评论抱一抱列表 |
| `hug_comment` | 抱一抱评论 |
| `starpick_comments_summary` | 云村星评馆 - 简要评论 |

评论类型枚举 `CommentType`：

| 值 | 类型 |
|----|------|
| 0 | 歌曲 (song) |
| 1 | MV (mv) |
| 2 | 歌单 (playlist) |
| 3 | 专辑 (album) |
| 4 | 电台 (dj) |
| 5 | 视频 (video) |
| 6 | 动态 (event) |

## 十、电台 (DJ)

| 接口名 | 说明 |
|--------|------|
| `dj_banner` | 电台 banner |
| `dj_catelist` | 电台 - 分类 |
| `dj_category_recommend` | 电台 - 分类推荐 |
| `dj_category_excludehot` | 电台 - 非热门类型 |
| `dj_detail` | 电台 - 详情 |
| `dj_hot` | 热门电台 |
| `dj_paygift` | 电台 - 付费精品 |
| `dj_program` | 电台 - 节目 |
| `dj_program_detail` | 电台 - 节目详情 |
| `dj_program_toplist` | 电台 - 节目榜 |
| `dj_program_toplist_hours` | 电台 24 小时节目榜 |
| `dj_radio_hot` | 类别热门电台 |
| `dj_recommend` | 电台 - 推荐 |
| `dj_recommend_type` | 电台 - 推荐类型 |
| `dj_sub` | 电台 - 订阅 |
| `dj_sublist` | 订阅的电台列表 |
| `dj_subscriber` | 电台订阅者列表 |
| `dj_today_perfered` | 电台 - 今日优选 |
| `dj_toplist` | 电台排行榜 |
| `dj_toplist_hours` | 电台 24 小时主播榜 |
| `dj_toplist_newcomer` | 电台主播新人榜 |
| `dj_toplist_pay` | 电台付费精品榜 |
| `dj_toplist_popular` | 电台最热主播榜 |
| `djRadio_top` | 电台 - 新晋电台榜/热门电台榜 |
| `personalized_djprogram` | 推荐电台 |
| `program_recommend` | 推荐节目 |
| `user_dj` | 用户电台 |

## 十一、排行榜

| 接口名 | 说明 |
|--------|------|
| `top_list` | 排行榜 |
| `toplist` | 所有榜单 |
| `toplist_artist` | 歌手榜 |
| `toplist_detail` | 排行榜详情 |
| `toplist_detail_v2` | 排行榜详情 v2 |
| `top_song` | 新歌速递 |
| `personalized_newsong` | 推荐新音乐 |

## 十二、动态与消息

| 接口名 | 说明 |
|--------|------|
| `event` | 获取动态列表 |
| `event_del` | 删除动态 |
| `event_forward` | 转发动态 |
| `share_resource` | 分享歌曲/歌单/mv/电台到动态 |
| `user_event` | 获取用户动态 |
| `user_follows` | 获取用户关注列表 |
| `user_followeds` | 获取用户粉丝列表 |
| `user_follow_mixed` | 当前账号关注的用户/歌手 |
| `msg_comments` | 通知 - 评论 |
| `msg_forwards` | 通知 - @我 |
| `msg_notices` | 通知 - 通知 |
| `msg_private` | 通知 - 私信 |
| `msg_private_history` | 私信内容 |
| `msg_recentcontact` | 最近联系人 |
| `send_text` | 发送私信 |
| `send_song` | 私信音乐 |
| `send_album` | 发送私信（带专辑） |
| `send_playlist` | 发送私信歌单 |

## 十三、每日推荐

| 接口名 | 说明 |
|--------|------|
| `recommend_resource` | 获取每日推荐歌单 |
| `recommend_songs` | 获取每日推荐歌曲 |
| `recommend_songs_dislike` | 每日推荐歌曲 - 不感兴趣 |
| `history_recommend_songs` | 获取历史日推可用日期列表 |
| `history_recommend_songs_detail` | 获取历史日推详细数据 |

## 十四、云盘

| 接口名 | 说明 |
|--------|------|
| `user_cloud` | 云盘 |
| `user_cloud_detail` | 云盘数据详情 |
| `user_cloud_del` | 云盘歌曲删除 |
| `cloud_import` | 云盘导入歌曲 |
| `cloud_match` | 云盘歌曲信息匹配纠正 |
| `cloud` | 云盘数据详情 |

## 十五、数字专辑

| 接口名 | 说明 |
|--------|------|
| `digitalAlbum_detail` | 数字专辑详情 |
| `digitalAlbum_ordering` | 购买数字专辑 |
| `digitalAlbum_purchased` | 我的数字专辑 |
| `digitalAlbum_sales` | 数字专辑销量 |

## 十六、云贝

| 接口名 | 说明 |
|--------|------|
| `yunbei` | 云贝 |
| `yunbei_info` | 云贝账户信息 |
| `yunbei_sign` | 云贝签到 |
| `yunbei_today` | 云贝今日签到信息 |
| `yunbei_tasks` | 云贝所有任务 |
| `yunbei_tasks_todo` | 云贝 todo 任务 |
| `yunbei_task_finish` | 云贝完成任务 |
| `yunbei_receipt` | 云贝收入 |
| `yunbei_expense` | 云贝支出 |
| `yunbei_rcmd_song` | 云贝推歌 |
| `yunbei_rcmd_song_history` | 云贝推歌历史记录 |

## 十七、VIP 与会员

| 接口名 | 说明 |
|--------|------|
| `vip_info` | 获取 VIP 信息 |
| `vip_info_v2` | 获取 VIP 信息(app端) |
| `vip_growthpoint` | vip 成长值 |
| `vip_growthpoint_details` | vip 成长值获取记录 |
| `vip_growthpoint_get` | 领取 vip 成长值 |
| `vip_tasks` | vip 任务 |
| `vip_timemachine` | 黑胶时光机 |

## 十八、音乐人

| 接口名 | 说明 |
|--------|------|
| `musician_data_overview` | 音乐人数据概况 |
| `musician_play_trend` | 音乐人播放趋势 |
| `musician_sign` | 音乐人签到 |
| `musician_tasks` | 音乐人任务 |
| `musician_tasks_new` | 音乐人任务(新) |
| `musician_cloudbean` | 账号云豆数 |
| `musician_cloudbean_obtain` | 领取云豆 |

## 十九、广播电台

| 接口名 | 说明 |
|--------|------|
| `broadcast_category_region_get` | 广播电台 - 分类/地区信息 |
| `broadcast_channel_collect_list` | 广播电台 - 我的收藏 |
| `broadcast_channel_currentinfo` | 广播电台 - 电台信息 |
| `broadcast_channel_list` | 广播电台 - 全部电台 |
| `broadcast_sub` | 广播电台 - 收藏/取消收藏 |

## 二十、一起听

| 接口名 | 说明 |
|--------|------|
| `listentogether_room_create` | 创建一起听房间 |
| `listentogether_room_check` | 检查一起听房间 |
| `listentogether_status` | 一起听状态 |
| `listentogether_accept` | 接受一起听邀请 |
| `listentogether_end` | 结束一起听 |
| `listentogether_heatbeat` | 一起听心跳 |
| `listentogether_play_command` | 一起听播放命令 |
| `listentogether_sync_list_command` | 一起听同步列表 |
| `listentogether_sync_playlist_get` | 一起听同步歌单 |

## 二十一、助眠解压

| 接口名 | 说明 |
|--------|------|
| `sleep_recommend` | 特定时间场景下的推荐资源 |
| `sleep_tag_list` | 标签列表 |
| `sleep_tag_resource` | 获取标签下资源列表 |
| `sleep_simi_recommend` | 查看同类推荐 |
| `sleep_sub` | 收藏 |
| `sleep_sublist` | 收藏列表 |

## 二十二、曲风

| 接口名 | 说明 |
|--------|------|
| `style_list` | 曲风列表 |
| `style_preference` | 曲风偏好 |
| `style_detail` | 曲风详情 |
| `style_song` | 曲风 - 歌曲 |
| `style_album` | 曲风 - 专辑 |
| `style_playlist` | 曲风 - 歌单 |
| `style_artist` | 曲风 - 歌手 |

## 二十三、其他

| 接口名 | 说明 |
|--------|------|
| `banner` | banner |
| `batch` | 批量请求接口 |
| `countries_code_list` | 国家编码列表 |
| `daily_signin` | 签到 |
| `signin_progress` | 签到进度 |
| `homepage_block_page` | 首页 - 发现 |
| `homepage_dragon_ball` | 首页 - 发现 - 圆形图标入口列表 |
| `hot_topic` | 热门话题 |
| `topic_detail` | 话题详情 |
| `topic_detail_event_hot` | 话题详情热门动态 |
| `topic_sublist` | 收藏的专栏 |
| `calendar` | 音乐日历 |
| `personalized_privatecontent` | 独家放送 |
| `personalized_privatecontent_list` | 独家放送列表 |
| `related_allvideo` | 相关视频 |
| `sheet_list` | 乐谱列表 |
| `sheet_preview` | 乐谱内容 |
| `song_wiki_summary` | 歌曲简要百科信息 |
| `album_wiki_summary` | 专辑简要百科信息 |
| `artist_wiki_summary` | 歌手简要百科信息 |
| `mv_wiki_summary` | mv简要百科信息 |
| `playmode_intelligence_list` | 心动模式/智能播放 |
| `playmode_song_vector` | 歌曲向量 |
| `summary_annual` | 年度听歌报告 |
| `listen_data_year_report` | 听歌足迹 - 年度听歌足迹 |
| `listen_data_today_song` | 听歌足迹 - 今日收听 |
| `listen_data_total` | 听歌足迹 - 总收听时长 |
| `listen_data_realtime_report` | 听歌足迹 - 本周/本月收听时长 |
| `listen_data_report` | 听歌足迹 - 周/月/年收听报告 |
| `recent_listen_list` | 最近听歌列表 |
| `record_recent_song` | 最近播放 - 歌曲 |
| `record_recent_video` | 最近播放 - 视频 |
| `record_recent_voice` | 最近播放 - 声音 |
| `record_recent_playlist` | 最近播放 - 歌单 |
| `record_recent_album` | 最近播放 - 专辑 |
| `record_recent_dj` | 最近播放 - 播客 |
| `user_record` | 获取用户播放记录 |
| `user_audio` | 用户电台 |
| `user_comment_history` | 用户历史评论 |
| `pl_count` | 获取歌曲评论数 |
| `personalized_rcmd` | 私人 DJ |
| `inner_version` | 内部版本接口 |
| `weblog` | 日志上报 |
