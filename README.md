# AI 客服翻译助手 (AI Customer Service Translator Helper)

这是一个基于 **Electron + React + TailwindCSS** 开发的智能悬浮窗式客服翻译辅助工具。它能够帮助跨境电商或外贸客服人员快速将简体中文转化为地道的台湾客服常用繁体口吻以及自然的英文客服表达，并支持自由智能对话。

---

## 🌟 核心功能与页面设计

应用采用了现代化的顶部 Tab 导航栏，提供了四个核心功能区块：

### 1. 翻译主界面 (主界面 Tab)
- **原文输入**：输入简体中文，通过 `Ctrl + Enter` (或 Mac 上的 `Cmd + Enter`) 或点击“开始智能翻译”按钮一键翻译。
- **智能输出**：自动生成符合台湾当地习惯（礼貌、语气温和、像真人客服而非机器翻译）的繁体版和口吻自然的英文版。
- **一键复制**：提供独立的“复制繁体”和“复制英文”按钮，带有一步到位的 2 秒“已复制”绿色动画提示。
- **折叠历史**：主页面底部设有最近 10 条快速翻译记录抽屉，方便二次复用。

### 2. 正常提问聊天 (正常提问 Tab)
- **上下文聊天**：支持在客服场景下与 AI 展开多次连续性对话，帮助组织回复话术。
- **便捷控制**：`Enter` 直接发送消息，`Shift + Enter` 换行。
- **会话重置**：提供“重置对话”按钮，可以清空上下文，开启全新的会话。

### 3. 历史记录中心 (历史记录 Tab)
- **双分类检索**：支持在“翻译历史”与“聊天对话”之间切换，以卡片化时间降序展现历史记录。
- **操作互动**：支持点击历史条目重新载入数据、点击垃圾桶图标单独删除某条，或一键清空全部历史。

### 4. 系统设置中心 (设置 Tab)
- **密钥及地址管理**：可配置 `OpenAI API Key` (支持密码眼一键隐藏/显现)、自定义 `API Base URL`（适配各类中转代理节点）和默认模型（如 `gpt-4o-mini`）。
- **本地持久化**：设置在保存后自动保存于本地的 `settings.json` 中，再次启动应用自动读取加载。

---

## 📁 项目文件结构

```
ai_translator/
├── package.json         # 项目依赖与 electron-builder 打包设置
├── vite.config.js       # Vite 配置文件
├── tailwind.config.js   # Tailwind 主题与字体集
├── postcss.config.js    # PostCSS 配置
├── update.bat           # Windows 更新脚本
├── build.bat            # Windows 自动打包脚本
├── README.md            # 项目说明文档
├── src/
│   ├── main/
│   │   ├── main.js      # Electron 主进程
│   │   ├── preload.js   # 进程间通信 IPC Bridge
│   │   └── services/
│   │       └── openai.js# 统一的 OpenAI 服务层（含超时/重试机制）
│   └── renderer/
│       ├── index.html   # 主页面入口
│       └── src/
│           ├── main.jsx # React 入口
│           ├── App.jsx  # React 多标签交互面板
│           └── index.css# 引入 Tailwind 并集成毛玻璃等样式
```

---

## 🚀 启动与开发

### 准备工作

1. 克隆或下载本项目至本地。
2. 在项目根目录下，将 `.env.example` 重命名为 `.env`。
3. 打开 `.env` 配置您的 `OPENAI_API_KEY`（或跳过此步，直接运行并在应用的“设置”页面中填写保存）。

### 启动开发环境

```bash
# 安装项目依赖
npm install

# 启动开发服务器（将同时启动 Vite 及 Electron）
npm run dev
```

---

## 🛠️ Windows 运维脚本

为了方便在 Windows 环境下更新与快速交付，我们在根目录下添加了两个 `.bat` 批处理文件：

### 1. `update.bat` (一键更新项目)
- **作用**：自动执行 `git pull` 拉取最新代码，并自动运行 `npm install` 升级可能变动的依赖库。
- **用法**：在 Windows 上双击 `update.bat` 运行即可。

### 2. `build.bat` (一键自动打包)
- **作用**：自动安装缺失依赖，执行 `npm run build` 静态资源编译，并运行 `npm run dist` 直接在 `release/` 目录中生成安装程序。
- **用法**：在 Windows 上双击 `build.bat` 运行即可。

---

## 📦 Electron 打包与分发

应用在 `package.json` 中预置了完整的 `electron-builder` 打包参数，输出规范的 **Windows 安装包 (NSIS)**，并具有如下特性：
- 支持选择安装路径。
- 自动在桌面和开始菜单建立“AI 客服翻译助手”快捷方式。
- 打包输出目录默认为 `release/`（避免覆盖前端 Vite 构建的 `dist/` 静态文件夹）。

要在非 Windows 环境或手动打包程序，可以执行以下命令：

```bash
# 自动编译前端资源，并由 electron-builder 打包 Windows exe 安装文件
npm run dist
```

打包完成后，您可以在 **`release/`** 文件夹中找到编译好的安装文件，例如：`AI-Translator-Helper Setup 1.0.0.exe`。
