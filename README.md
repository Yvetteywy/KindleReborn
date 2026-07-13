<div align="center">

# KindleReborn

### 让闲置 Kindle 变成一块安静、耐看的墨水屏信息板

[![Node.js](https://img.shields.io/badge/Node.js-22-111111?logo=nodedotjs)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-111111?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-111111)](LICENSE)

[在线体验](https://kindle.keyu.party/) · [快速开始](#-快速开始) · [环境变量](#-环境变量)

</div>

KindleReborn 是一个专为 Kindle 与其他墨水屏设备设计的单页日历。它把时间、月历、天气、空气质量、逐小时预报、农历黄历、星座运势和次日穿衣建议压进一张 **560 × 780** 的黑白画布里。

没有动画、没有远程字体、没有厚重前端框架。页面采用高对比度排版和兼容旧版 WebKit 的基础 HTML/CSS/JavaScript，让一台吃灰的 Kindle 重新成为桌面上最克制的信息终端。

## ✨ 功能亮点

| 模块 | 内容 |
| --- | --- |
| 时间与日历 | UTC+8 分钟级时钟、公历月历、星期与农历日期 |
| 实时天气 | 温度、体感、湿度、风力、空气质量、紫外线、降水概率 |
| 趋势信息 | 四组逐小时天气与次日天气、穿衣建议 |
| 传统日历 | 每日宜忌，最多各显示 5 项 |
| 星座运势 | 综合、事业、财运、感情、健康、幸运色与幸运数字 |
| 墨水屏优化 | 启动及每 30 分钟执行全黑→全白整屏重绘，缓解残影 |
| 弱网可用 | 浏览器本地缓存兜底；星座运势在服务端按天持久化 |

## 🧭 数据如何流动

```mermaid
flowchart LR
    K[Kindle 浏览器] -->|每 30 分钟| S[Express 服务]
    S --> W[Open-Meteo 天气与空气质量]
    S --> L[lunar-javascript 黄历]
    S --> J[聚合数据 星座运势]
    J --> C[(每日 JSON 缓存)]
    S --> K
    K --> B[(浏览器本地缓存)]
```

- 天气、空气质量与地理编码来自 [Open-Meteo](https://open-meteo.com/)，无需 API Key。
- 黄历由 [lunar-javascript](https://github.com/6tail/lunar-javascript) 在服务端计算。
- 星座运势可选接入聚合数据 API；未配置时自动展示内置兜底内容。

## 🚀 快速开始

需要 Node.js 22 或更高版本。

```bash
git clone https://github.com/keyu-0915/KindleReborn.git
cd KindleReborn
npm install
cp .env.example .env
npm run dev
```

访问 `http://localhost:3000/`。通过查询参数切换城市：

```text
http://localhost:3000/?city=广州
```

城市会保存在浏览器本地，下次打开时继续使用。

## 🔐 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 否 | `3000` | 服务监听端口 |
| `CONSTELLATION` | 否 | `水瓶座` | 星座运势名称 |
| `JUHE_CONSTELLATION_KEY` | 否 | — | 聚合数据星座运势 API Key，仅在服务端使用 |

星座接口结果保存在 `data/constellation.json`，同一星座每天最多请求一次。不要把真实 Key 写入前端代码或提交到 Git。

## 🧰 常用命令

```bash
npm run dev      # 开发模式
npm run lint     # TypeScript 类型检查
npm run build    # 构建服务端产物
npm start        # 运行已构建产物
```

## 📁 项目结构

```text
KindleReborn/
├─ assets/             # 黑白天气 SVG 图标
├─ src/
│  ├─ app.js           # Kindle 端 ES5 风格脚本
│  └─ index.css        # 固定画布与旧 WebKit 兼容样式
├─ index.html          # 单页界面
└─ server.ts           # 天气、黄历、运势聚合服务
```

## 🖋️ 设计取舍

- 使用表格、浮动和基础 DOM API，优先兼容老 Kindle 浏览器。
- 所有图标均为本地黑白 SVG，不依赖图标字体或外部 CDN。
- 时钟每秒检查一次，但只在分钟变化时更新 DOM。
- 天气响应缓存 29 分钟；星座运势按天缓存。
- 网页只能通过黑白整屏重绘缓解残影，无法直接调用 Kindle 的硬件全刷。

## 🤝 参与贡献

欢迎提交 Issue 或 Pull Request。若调整布局，请优先在 **560 × 780** 视口验证无横向或纵向溢出，并尽量保留旧版 WebKit 兼容性。

## 📄 许可证

[MIT](LICENSE) © 2026 keyu-0915

> 星座运势仅供娱乐，不应作为医疗、财务或其他重要决策依据。
