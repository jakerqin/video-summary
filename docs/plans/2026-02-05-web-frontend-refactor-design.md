# Web 前端重构设计方案

**日期：** 2026-02-05
**目标：** 将 Electron 桌面应用重构为纯 Web 应用（React SPA + Python 后端）
**UI 风格：** 科技感/未来风（深色主题 + 霓虹色调）

---

## 一、架构变更概述

### 当前架构（Electron）

```
┌─────────────────────────────────┐
│   Electron 主进程               │
│   - PythonManager (管理后端)    │
│   - IPC 处理器                  │
└─────────────────────────────────┘
         ↕ IPC 通信
┌─────────────────────────────────┐
│   Electron 渲染进程 (React)     │
│   - ipcService (IPC调用)        │
│   - wsService (WebSocket)       │
└─────────────────────────────────┘
         ↕ HTTP/WS
┌─────────────────────────────────┐
│   Python FastAPI 后端           │
│   - 端口 9000                   │
└─────────────────────────────────┘
```

### 目标架构（纯Web）

```
┌─────────────────────────────────┐
│   浏览器 (React SPA)            │
│   - HTTP Client (axios/fetch)   │
│   - WebSocket Client            │
│   - 科技感UI (深色+霓虹)        │
└─────────────────────────────────┘
         ↕ HTTP/WS (直接通信)
┌─────────────────────────────────┐
│   Python FastAPI 后端           │
│   - 端口 9000                   │
│   - 用户手动启动                │
└─────────────────────────────────┘
```

### 核心变化

- **移除** Electron 主进程和 IPC 层
- **直接通信** React 应用通过 HTTP/WebSocket 与后端通信
- **手动启动** 用户需要手动启动后端（或使用启动脚本）
- **静态资源** 前端变为纯静态资源，使用 Vite 开发服务器

---

## 二、需要移除的内容

### 文件删除清单

**Electron 主进程相关：**
- `frontend/src/main/index.ts` - Electron 主进程入口
- `frontend/src/main/python-manager.ts` - Python 后端管理器
- `frontend/src/preload/index.ts` - 预加载脚本
- `frontend/electron-builder.yml` - Electron 打包配置（如果有）

**IPC 服务层：**
- `frontend/src/services/ipc.ts` - IPC 通信服务（需要替换为 HTTP 客户端）

### 依赖清理

**package.json 移除：**
```json
{
  "devDependencies": {
    "electron": "^28.2.0",
    "electron-builder": "^24.9.1",
    "vite-plugin-electron": "^0.28.2",
    "wait-on": "^7.2.0",
    "concurrently": "^8.2.2"
  }
}
```

**package.json 脚本调整：**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

移除：`electron:dev`, `electron:build`

### 配置文件调整

**vite.config.ts：**
- 移除 `vite-plugin-electron` 插件配置
- 保留 React 和 Tailwind 配置
- 可选：添加开发服务器代理配置（避免 CORS）

---

## 三、需要修改的内容

### 1. 服务层改造

**创建 `frontend/src/services/api.ts`**

替换原有的 `ipc.ts`，提供 HTTP 客户端：

```typescript
// 核心功能：
- 配置管理 (GET/POST /config)
- 视频信息获取 (POST /video/info)
- 视频处理 (POST /process)
- 健康检查 (GET /health)

// 使用 fetch 或 axios
// 基础 URL: http://localhost:9000
```

**修改 `frontend/src/services/websocket.ts`**
- 移除对 Electron 环境的检测
- 直接连接 `ws://localhost:9000/ws`
- 保持现有的消息处理逻辑

### 2. 组件层调整

**需要修改的组件：**

| 组件 | 修改内容 |
|------|---------|
| `DropZone.tsx` | 移除 IPC 文件选择，使用 HTML5 File API |
| `URLInput.tsx` | 将 IPC 调用改为 HTTP 请求 |
| `SettingsPanel.tsx` | 移除 IPC 对话框，使用 HTML5 input[type="file"] |
| `ProcessingQueue.tsx` | 移除 IPC 文件操作，改为下载链接 |
| `ExportPanel.tsx` | 移除 IPC shell 操作，改为浏览器下载 |

**修改原则：**
- **文件选择：** `<input type="file">` 替代 IPC dialog
- **文件保存：** `<a download>` 或 Blob URL 替代 IPC saveFile
- **打开文件夹：** 提示用户手动打开，或提供路径复制功能

### 3. 状态管理

**Zustand stores 调整：**
- `stores/app.ts` - 移除 `backendRunning` 状态（用户手动管理后端）
- `stores/queue.ts` - 保持不变
- `stores/settings.ts` - 保持不变

---

## 四、UI 设计方向（科技感/未来风）

### 色彩系统

```css
/* 主色调 */
--bg-primary: #0a0e27;
--bg-secondary: #1a1f3a;
--card-bg: rgba(26, 31, 58, 0.8);

/* 霓虹色 */
--neon-cyan: #00f0ff;
--neon-cyan-dark: #00d9ff;
--neon-purple: #b000ff;
--neon-purple-dark: #8b00ff;
--neon-pink: #ff00aa;
--neon-pink-dark: #ff3d9a;

/* 文字 */
--text-primary: #e0e7ff;
--text-secondary: #94a3b8;
```

### 视觉特效

**毛玻璃效果：**
```css
backdrop-filter: blur(20px);
background: rgba(26, 31, 58, 0.8);
```

**霓虹发光：**
```css
box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
border: 1px solid rgba(0, 240, 255, 0.3);
```

**渐变边框：**
```css
border-image: linear-gradient(135deg, #00f0ff, #b000ff) 1;
```

**扫描线动画：**
```css
background-image: repeating-linear-gradient(
  0deg,
  rgba(0, 240, 255, 0.03) 0px,
  transparent 2px,
  transparent 4px
);
```

### 交互动效

- **按钮悬停：** 霓虹光晕增强 + 轻微上浮（transform: translateY(-2px)）
- **卡片悬停：** 边框发光 + 阴影加深
- **进度条：** 渐变流动动画（background-position 动画）
- **加载状态：** 脉冲光效（opacity 动画）
- **页面切换：** 淡入淡出 + 轻微位移

### 组件风格

**按钮：**
- 深色背景 + 霓虹边框 + 发光效果
- 悬停时光晕增强

**输入框：**
- 透明背景 + 霓虹下划线
- 聚焦时发光效果

**卡片：**
- 毛玻璃效果 + 渐变边框
- 悬浮阴影

**侧边栏：**
- 深色半透明背景
- 霓虹图标和指示器

**进度条：**
- 渐变填充（青色到紫色）
- 流光动画

---

## 五、实施步骤

### 阶段1：清理和准备（优先级：高）

**步骤：**
1. 删除 Electron 相关文件和目录
2. 清理 `package.json` 依赖和脚本
3. 简化 `vite.config.ts`，移除 electron 插件
4. 创建新的 HTTP 客户端服务 `services/api.ts`
5. 修改 WebSocket 服务，移除 Electron 检测

**验证点：**
- ✅ `npm install` 成功，无 Electron 依赖
- ✅ `npm run dev` 启动 Vite 开发服务器
- ✅ 浏览器访问 `http://localhost:5173` 显示界面

---

### 阶段2：功能迁移（优先级：高）

**步骤：**
1. 替换所有 IPC 调用为 HTTP 请求
2. 修改文件选择为 HTML5 File API
3. 修改文件保存为浏览器下载
4. 更新状态管理，移除后端状态检测
5. 测试核心功能：上传视频、处理、下载结果

**验证点：**
- ✅ 视频上传功能正常
- ✅ WebSocket 实时进度更新
- ✅ 处理完成后可下载 Markdown

---

### 阶段3：UI 重设计（优先级：中）

**步骤：**
1. 使用 `frontend-design` skill 生成科技感组件
2. 更新 Tailwind 配置，添加自定义色彩和动画
3. 重构主要组件的视觉样式
4. 添加动效和交互反馈
5. 优化响应式布局

**验证点：**
- ✅ 深色主题应用到所有页面
- ✅ 霓虹效果和动画流畅
- ✅ 移动端适配良好

---

### 阶段4：优化和文档（优先级：低）

**步骤：**
1. 添加启动脚本（同时启动前后端）
2. 编写 README 说明部署方式
3. 性能优化（代码分割、懒加载）
4. 添加错误处理和用户提示
5. 浏览器兼容性测试

**验证点：**
- ✅ 一键启动脚本可用
- ✅ 文档清晰完整
- ✅ 主流浏览器测试通过

---

## 六、技术栈

### 保留
- React 18
- TypeScript
- Tailwind CSS
- Zustand (状态管理)
- Vite (构建工具)

### 新增
- Axios 或 Fetch API (HTTP 客户端)
- 可选：Framer Motion (动画库)

### 移除
- Electron
- Electron Builder
- Vite Plugin Electron
- IPC 相关代码

---

## 七、部署方式

### 开发环境

1. 启动后端：
```bash
cd backend
python main.py
```

2. 启动前端：
```bash
cd frontend
npm run dev
```

3. 访问：`http://localhost:5173`

### 生产环境

1. 构建前端：
```bash
cd frontend
npm run build
```

2. 部署静态文件（dist 目录）到任意 Web 服务器

3. 启动后端服务

4. 配置 CORS 和反向代理（如需要）

---

## 八、风险和注意事项

### 风险

1. **文件上传限制：** 浏览器对大文件上传有限制，需要处理分片上传或流式上传
2. **CORS 问题：** 需要确保后端正确配置 CORS 头
3. **文件系统访问：** 无法像 Electron 那样直接访问文件系统，需要用户手动选择文件

### 注意事项

1. **后端启动：** 用户需要手动启动后端，或提供启动脚本
2. **浏览器兼容性：** 确保目标浏览器支持所需的 Web API
3. **安全性：** 注意 XSS 和 CSRF 防护
4. **性能：** 大文件处理需要优化，避免阻塞 UI

---

## 九、成功标准

- ✅ 所有核心功能正常工作（上传、处理、下载）
- ✅ UI 符合科技感/未来风设计
- ✅ 响应式设计，支持桌面和移动端
- ✅ 性能良好，无明显卡顿
- ✅ 文档完整，易于部署和使用
- ✅ 代码质量高，易于维护

---

**设计完成日期：** 2026-02-05
**设计者：** Claude (Kiro)
**审核者：** 用户确认
