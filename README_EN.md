# AI Workbench - Obsidian Plugin

[![GitHub release](https://img.shields.io/github/v/release/zfz584521-collab/obsidian-ai-workb?include_prereleases)](https://github.com/zfz584521-collab/obsidian-ai-workb/releases)
[![GitHub license](https://img.shields.io/github/license/zfz584521-collab/obsidian-ai-workb)](LICENSE)
[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%483699&label=downloads&query=%24%5B%22ai-workbench%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=ai-workbench)

AI-powered Obsidian workbench for one-click note summarization, translation, mind mapping, and more.

[简体中文](./README.md) | English

## ✨ Features

### 🎯 Core Features

- **Quick Actions**: Summarize, outline, translate, format, mind map, Mermaid diagrams
- **Custom Prompts**: Create your own AI processing actions
- **Preset Templates**: 25+ built-in templates (Xiaohongshu, short videos, WeChat articles, etc.)
- **Selected Text Processing**: Process only selected text
- **Claudian Integration**: Send to Claude Code for advanced processing
- **Context Menu**: Quick access to AI operations
- **Backup Management**: Auto backup with easy recovery
- **Preview & Compare**: Preview changes before applying
- **Usage Statistics**: Token usage and cost tracking

### 🎨 Template Categories

| Category | Count | Description |
|----------|-------|-------------|
| 📝 Basic Processing | 5 | Polish/Expand/Simplify/Extract/FAQ |
| 📕 Xiaohongshu | 3 | Notes/Titles/Hashtags |
| 📱 Short Videos | 5 | Scripts/Voiceovers/Titles/Comments/Livestream |
| 📰 WeChat Articles | 5 | Layout/Titles/Intros/Images/Quotes |
| 🌍 Translation | 2 | Chinese-English translation |
| 💻 Code | 2 | Comments/Explanation |
| 🛠 Others | 3 | SEO/First-person/Learning notes |

## 📖 Documentation

- **[User Guide (Chinese)](./使用说明.md)** - Complete tutorial and configuration guide
- **[Developer Guide](./DEVELOPMENT.md)** - Development and contribution guide
- **[Changelog](./CHANGELOG.md)** - Version update history

## 🚀 Quick Start

### Method 1: Download and Install (Recommended)

1. Visit the [Releases](https://github.com/zfz584521-collab/obsidian-ai-workb/releases) page
2. Download the latest `main.js`, `manifest.json`, and `styles.css`
3. Create a directory in your Obsidian vault: `.obsidian/plugins/ai-workbench/`
4. Copy the downloaded files to that directory
5. Restart Obsidian and enable the AI Workbench plugin in settings

### Method 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/zfz584521-collab/obsidian-ai-workb.git

# Navigate to the directory
cd obsidian-ai-workb

# Install dependencies
npm install

# Build
npm run build
```

## ⚙️ Configuration

### API Configuration

The plugin supports OpenAI-compatible APIs:

- **OpenAI API**: `https://api.openai.com/v1`
- **Claude API**: Requires compatibility layer
- **Proxy Services**: Enter the corresponding endpoint
- **Local Ollama**: `http://localhost:11434/v1`

### Configuration Steps

1. Open Obsidian Settings → Community Plugins → AI Workbench
2. Fill in the configuration:
   - **API Endpoint**: Your API address
   - **API Key**: Your secret key
   - **Model**: gpt-4o-mini / gpt-4 / other models
3. Save settings

### Keyboard Shortcuts

| Feature | Default Shortcut | Description |
|---------|------------------|-------------|
| Summarize | `Ctrl/Cmd + Alt + S` | Summarize current note |
| Outline | `Ctrl/Cmd + Alt + O` | Generate outline |
| Translate | `Ctrl/Cmd + Alt + T` | Translate text |
| Format | `Ctrl/Cmd + Alt + F` | Format note |
| Mind Map | `Ctrl/Cmd + Alt + M` | Generate mind map |

## 📁 Project Structure

```
obsidian-ai-workb/
├── manifest.json          # Plugin metadata
├── package.json           # Node.js configuration
├── main.ts                # Plugin entry point
├── styles.css             # Styles
├── src/                   # Source code
│   ├── types/             # Type definitions
│   ├── services/          # Service layer
│   ├── actions/           # Action handlers
│   └── settings.ts        # Settings panel
├── prompts/               # Preset prompts
└── docs/                  # Documentation
```

## 🔒 Security

- ✅ **Local Storage**: API keys are stored locally only, never uploaded to any server
- ✅ **Encrypted Transmission**: All API requests use HTTPS encryption
- ✅ **No Data Collection**: No user data is collected
- ✅ **Open Source**: Fully open source, code is auditable

## 🤝 Contributing

Contributions are welcome! Feel free to contribute code, report issues, or suggest features.

### How to Contribute

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Submit a Pull Request

See the [Developer Guide](./DEVELOPMENT.md) for more details.

## 📝 Roadmap

- [ ] Support for more AI models (Claude, Gemini)
- [ ] Streaming output support
- [ ] Multi-language support
- [ ] Template marketplace
- [ ] Batch processing functionality

See the [Roadmap](./ROADMAP.md) for more details.

## 📄 License

This project is licensed under the [MIT License](LICENSE)

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md/) - Excellent knowledge management tool
- [OpenAI](https://openai.com/) - Powerful AI capabilities
- All contributors and users

## 📮 Contact

- **Issues**: [GitHub Issues](https://github.com/zfz584521-collab/obsidian-ai-workb/issues)
- **Discussions**: [GitHub Discussions](https://github.com/zfz584521-collab/obsidian-ai-workb/discussions)

---

**If this project helps you, please give it a ⭐ Star to show your support!**
