# 🤖 Automate-It-To-Get-It

An automation toolkit for job seekers to streamline repetitive tasks on job portals such as Naukri.com.

![GitHub](https://img.shields.io/github/license/imshaiknasir/automate-it-to-get-it?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/imshaiknasir/automate-it-to-get-it?style=flat-square)

## 🌟 Features

- **Headless Execution**: Run tests without displaying a browser window
- **Stealth Mode**: Uses stealth plugins to avoid detection by anti-bot systems

## 🛠️ Tech Stack

- **TypeScript**: For type-safe code
- **Playwright**: Browser automation framework
- **Playwright-Extra**: Extended capabilities for Playwright
- **Stealth Plugin**: To bypass anti-bot detection
- **dotenv**: For environment variable management

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git

## 🚀 Getting Started

### Clone the Repository

```bash
git clone git@github.com:imshaiknasir/automate-it-to-get-it.git
cd automate-it-to-get-it
```

### Install Dependencies

```bash
npm ci
```

### Configure Environment Variables

1. Copy the example environment file:
```bash
cp example.env .env
```

2. Edit the `.env` file with your credentials:
```
USER_EMAIL=your_email@example.com
USER_PASSWORD=your_password
NAUKRI_URL=https://www.example.com/
```

### 💻 Development Mode

For development with automatic rebuilding:

```bash
npm run dev
```

## 📂 Project Structure

```
├── src/
│   ├── helperFunctions/      # Reusable automation functions
│   │   └── loginFunctions.ts # Login-specific helper functions
│   └── scripts/              # Main automation scripts
│       └── checkLoginFlow.ts # Login flow verification script
├── dist/                     # Compiled JavaScript output
├── .env                      # Environment variables (private)
├── example.env               # Example environment variables
└── package.json              # Project dependencies and scripts
```

## 📜 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Playwright](https://playwright.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Naukri.com](https://www.naukri.com/)

---

Made with ❤️ by [Shaik Nasir](https://github.com/imshaiknasir) 