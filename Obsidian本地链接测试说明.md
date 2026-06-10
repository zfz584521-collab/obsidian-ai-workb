# AI Workbench 本地链接测试说明

本文说明如何在 Windows 电脑上使用目录联接（Junction），把本地开发中的 AI Workbench 插件接入 Obsidian，方便修改代码后直接测试，无需反复复制插件文件。

## 一、当前路径

本文使用以下路径：

```text
Obsidian 仓库：
E:\Obsidian

AI Workbench 源码：
E:\project\Obsidian插件\ai-workbench

Obsidian 插件入口：
E:\Obsidian\.obsidian\plugins\ai-workbench
```

如果以后更换 Obsidian 仓库，需要相应修改命令中的仓库路径。

## 二、目录联接的作用

创建目录联接后：

```text
E:\Obsidian\.obsidian\plugins\ai-workbench
```

会指向：

```text
E:\project\Obsidian插件\ai-workbench
```

Obsidian 访问插件目录时，实际读取的是源码项目中的文件。因此，运行开发构建并生成新的 `main.js` 后，不需要再次复制文件。

链接建立后的关系如下：

```text
Obsidian
  └─ E:\Obsidian\.obsidian\plugins\ai-workbench
       └─ Junction
            └─ E:\project\Obsidian插件\ai-workbench
                 ├─ manifest.json
                 ├─ main.js
                 ├─ styles.css
                 ├─ main.ts
                 └─ src\
```

## 三、操作前注意事项

1. 操作前关闭 Obsidian，避免插件文件或配置正在被使用。
2. 不要直接删除已有的 `ai-workbench` 目录。
3. 原插件目录中可能存在 `data.json`，其中保存插件设置，并可能包含 API Key。
4. 本项目的 `.gitignore` 已忽略 `data.json`，恢复配置后不应将其提交到 Git。

## 四、检查已有同名目录

打开 PowerShell，执行：

```powershell
Get-Item "E:\Obsidian\.obsidian\plugins\ai-workbench" |
  Format-List FullName,LinkType,Target
```

结果判断：

- `LinkType` 为空：当前是普通目录，需要先重命名备份。
- `LinkType` 为 `Junction`：当前已经是目录联接，应检查 `Target` 是否指向正确源码目录。
- 提示路径不存在：可以跳过备份步骤，直接创建目录联接。

也可以查看原插件目录中的文件：

```powershell
Get-ChildItem -Force "E:\Obsidian\.obsidian\plugins\ai-workbench"
```

重点检查是否存在：

```text
data.json
```

## 五、备份原插件目录

确认 Obsidian 已关闭后，执行：

```powershell
Rename-Item `
  -LiteralPath "E:\Obsidian\.obsidian\plugins\ai-workbench" `
  -NewName "ai-workbench-backup"
```

执行后，原插件目录变为：

```text
E:\Obsidian\.obsidian\plugins\ai-workbench-backup
```

检查备份：

```powershell
Get-ChildItem -Force `
  "E:\Obsidian\.obsidian\plugins\ai-workbench-backup"
```

如果 `ai-workbench-backup` 已经存在，不要覆盖。可以改用带日期的名称，例如：

```powershell
Rename-Item `
  -LiteralPath "E:\Obsidian\.obsidian\plugins\ai-workbench" `
  -NewName "ai-workbench-backup-20260609"
```

## 六、创建目录联接

确认以下路径不存在：

```text
E:\Obsidian\.obsidian\plugins\ai-workbench
```

然后在 PowerShell 中执行：

```powershell
New-Item -ItemType Junction `
  -Path "E:\Obsidian\.obsidian\plugins\ai-workbench" `
  -Target "E:\project\Obsidian插件\ai-workbench"
```

注意，`-Path` 必须包含插件目录名 `ai-workbench`，不能只写：

```text
E:\Obsidian\.obsidian\plugins
```

否则含义会变成尝试把整个 `plugins` 目录作为链接。

## 七、验证目录联接

执行：

```powershell
Get-Item "E:\Obsidian\.obsidian\plugins\ai-workbench" |
  Format-List FullName,LinkType,Target
```

正确结果应满足：

```text
LinkType : Junction
Target   : E:\project\Obsidian插件\ai-workbench
```

继续检查 Obsidian 能否通过链接读取插件文件：

```powershell
Get-ChildItem `
  "E:\Obsidian\.obsidian\plugins\ai-workbench"
```

至少应看到：

```text
manifest.json
main.js
styles.css
```

最终的 `manifest.json` 路径必须是：

```text
E:\Obsidian\.obsidian\plugins\ai-workbench\manifest.json
```

不能多套一层目录，例如：

```text
E:\Obsidian\.obsidian\plugins\ai-workbench\ai-workbench\manifest.json
```

## 八、恢复原插件配置

如果备份目录中存在 `data.json`，可以把配置复制到源码项目：

```powershell
Copy-Item `
  -LiteralPath "E:\Obsidian\.obsidian\plugins\ai-workbench-backup\data.json" `
  -Destination "E:\project\Obsidian插件\ai-workbench\data.json"
```

如果使用了带日期的备份目录，请修改命令中的备份目录名称。

复制后检查：

```powershell
Test-Path `
  "E:\project\Obsidian插件\ai-workbench\data.json"
```

返回 `True` 表示配置文件已经存在。

安全提示：

- `data.json` 可能包含 API Key，不要公开分享。
- 不要把 `data.json` 提交到 Git。
- 本项目 `.gitignore` 已包含 `data.json`。

可以用下面的命令确认 Git 没有准备跟踪它：

```powershell
git -C "E:\project\Obsidian插件\ai-workbench" status --short
```

输出中不应出现 `data.json`。

## 九、启动开发构建

进入源码目录：

```powershell
Set-Location "E:\project\Obsidian插件\ai-workbench"
```

启动监听构建：

```powershell
npm run dev
```

该命令会持续运行。当修改 `main.ts` 或相关源码时，esbuild 会重新生成：

```text
E:\project\Obsidian插件\ai-workbench\main.js
```

由于 Obsidian 插件目录已经链接到源码项目，Obsidian 可以直接读取最新的 `main.js`。

停止监听构建时，在运行命令的 PowerShell 窗口按：

```text
Ctrl+C
```

## 十、在 Obsidian 中启用

1. 启动 Obsidian。
2. 打开“设置”。
3. 进入“社区插件”。
4. 确认已经关闭“受限模式”。
5. 点击刷新，或者重启 Obsidian。
6. 找到 `AI Workbench`。
7. 启用插件。

如果插件已经启用但没有加载新代码，可以：

1. 在社区插件页面关闭 `AI Workbench`。
2. 再次启用 `AI Workbench`。

也可以使用 Obsidian 的重新加载应用命令。

## 十一、日常开发流程

以后每次开发可以按以下流程操作：

```text
1. 在源码目录运行 npm run dev
2. 修改 main.ts、src\ 或 styles.css
3. 等待 main.js 构建完成
4. 在 Obsidian 中重新加载应用或重新启用插件
5. 测试修改结果
```

不需要重复创建 Junction，也不需要反复复制 `main.js`、`manifest.json` 和 `styles.css`。

## 十二、常见问题

### 1. 创建 Junction 时提示文件已经存在

原因是这个路径仍然存在：

```text
E:\Obsidian\.obsidian\plugins\ai-workbench
```

先检查：

```powershell
Get-Item "E:\Obsidian\.obsidian\plugins\ai-workbench" |
  Format-List FullName,LinkType,Target
```

如果是普通目录，请先重命名备份；如果已经是 Junction，则不需要重复创建。

### 2. Obsidian 中看不到插件

检查以下文件是否存在：

```powershell
Test-Path "E:\Obsidian\.obsidian\plugins\ai-workbench\manifest.json"
Test-Path "E:\Obsidian\.obsidian\plugins\ai-workbench\main.js"
```

两个结果都应该是 `True`。

还需要确认当前打开的 Obsidian 仓库确实是：

```text
E:\Obsidian
```

### 3. 修改代码后没有生效

依次检查：

1. `npm run dev` 是否仍在运行。
2. 构建窗口是否显示错误。
3. `main.js` 的修改时间是否已经更新。
4. 是否重新加载了 Obsidian 或重新启用了插件。

查看 `main.js` 修改时间：

```powershell
Get-Item "E:\project\Obsidian插件\ai-workbench\main.js" |
  Select-Object FullName,LastWriteTime,Length
```

### 4. 插件设置丢失

检查源码项目中是否存在：

```text
E:\project\Obsidian插件\ai-workbench\data.json
```

如果不存在，但备份目录中存在，可以按照“恢复原插件配置”一节复制回来。

### 5. PowerShell 提示没有权限

目录联接通常不需要管理员权限。如果当前环境仍然提示权限不足，可以关闭当前 PowerShell，然后使用“以管理员身份运行 PowerShell”重新执行创建命令。

## 十三、撤销链接并恢复原插件

操作前先关闭 Obsidian。

### 1. 确认当前目录是 Junction

```powershell
Get-Item "E:\Obsidian\.obsidian\plugins\ai-workbench" |
  Format-List FullName,LinkType,Target
```

必须确认：

```text
LinkType : Junction
```

### 2. 删除目录联接

```powershell
Remove-Item -LiteralPath `
  "E:\Obsidian\.obsidian\plugins\ai-workbench"
```

删除 Junction 只会移除链接，不会删除实际源码目录：

```text
E:\project\Obsidian插件\ai-workbench
```

### 3. 恢复原插件目录

```powershell
Rename-Item `
  -LiteralPath "E:\Obsidian\.obsidian\plugins\ai-workbench-backup" `
  -NewName "ai-workbench"
```

然后重新启动 Obsidian。

## 十四、完整命令速查

在已有同名普通目录的情况下，可以依次执行：

```powershell
# 1. 关闭 Obsidian

# 2. 备份原插件目录
Rename-Item `
  -LiteralPath "E:\Obsidian\.obsidian\plugins\ai-workbench" `
  -NewName "ai-workbench-backup"

# 3. 创建目录联接
New-Item -ItemType Junction `
  -Path "E:\Obsidian\.obsidian\plugins\ai-workbench" `
  -Target "E:\project\Obsidian插件\ai-workbench"

# 4. 验证链接
Get-Item "E:\Obsidian\.obsidian\plugins\ai-workbench" |
  Format-List FullName,LinkType,Target

# 5. 恢复配置（仅当备份中存在 data.json 时执行）
Copy-Item `
  -LiteralPath "E:\Obsidian\.obsidian\plugins\ai-workbench-backup\data.json" `
  -Destination "E:\project\Obsidian插件\ai-workbench\data.json"

# 6. 启动开发构建
Set-Location "E:\project\Obsidian插件\ai-workbench"
npm run dev
```

完成后启动 Obsidian，在“设置 → 社区插件”中刷新并启用 `AI Workbench`。
