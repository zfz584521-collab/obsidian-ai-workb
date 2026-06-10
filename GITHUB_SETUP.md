# GitHub 仓库创建指南

## 步骤 1：创建新仓库

1. 访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `ai-workbench` 或 `obsidian-ai-workbench`
   - **Description**: `AI 驱动的 Obsidian 笔记工作台，一键完成总结、翻译、思维导图等操作`
   - **可见性**:
     - ✅ **Public**（推荐）- 开源项目，其他用户可以发现和使用
     - 🔒 **Private** - 仅自己可见
   - ⚠️ **不要勾选**：
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
     （因为本地已经有这些文件）

3. 点击 **"Create repository"**

## 步骤 2：推送代码到 GitHub

创建仓库后，GitHub 会显示推送命令。请根据你的情况选择：

### 方案 A：推送到新的 GitHub 仓库

```bash
# 1. 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/ai-workbench.git

# 2. 推送代码
git push -u origin master

# 或者如果你想推送到 main 分支（GitHub 默认）
git branch -M main
git push -u origin main
```

### 方案 B：使用 SSH（更安全，推荐）

```bash
# 1. 如果你配置了 SSH key
git remote add origin git@github.com:YOUR_USERNAME/ai-workbench.git

# 2. 推送代码
git push -u origin master
```

## 步骤 3：验证上传

1. 刷新 GitHub 仓库页面
2. 检查所有文件是否正确上传
3. 确认 README.md 正常显示

## 🔒 安全检查清单

- ✅ API Key 仅存储在用户本地（data.json 不会上传）
- ✅ .gitignore 已配置，防止敏感文件泄露
- ✅ 没有硬编码的密钥或密码
- ✅ 用户配置文件（data.json）已排除

## 📝 推荐的后续步骤

1. **添加 Topics 标签**：
   - obsidian-plugin
   - obsidian
   - ai
   - gpt
   - productivity

2. **创建 Release**：
   - 打包 main.js、manifest.json、styles.css
   - 发布第一个版本 v0.1.0

3. **更新 README.md**：
   - 添加仓库实际 URL
   - 添加截图或演示 GIF
   - 添加安装徽章

4. **添加 LICENSE 文件**（如果需要开源）
