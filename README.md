# OmniRouter 🚀

> **Free, local-first AI API gateway for Windows 10/11.**  
> Aggregate official AI providers (OpenAI, Anthropic Claude, Google Gemini, Ollama) behind a single, high-performance, OpenAI-compatible local endpoint with intelligent failover, encrypted storage, an embedded React dashboard, and native Windows System Tray integration.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black.svg)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF.svg)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle_ORM-003B57.svg)](https://orm.drizzle.team/)
[![Vitest](https://img.shields.io/badge/Tests-64%2F64_Passed-success.svg)](https://vitest.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0078D4.svg)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📑 Mục lục / Table of Contents
- [Tính năng nổi bật / Key Features](#-tính-năng-nổi-bật--key-features)
- [Kiến trúc hệ thống / Architecture](#-kiến-trúc-hệ-thống--architecture)
- [Yêu cầu hệ thống / Prerequisites](#-yêu-cầu-hệ-thống--prerequisites)
- [Cài đặt & Khởi chạy nhanh / Quick Start](#-cài-đặt--khởi-chạy-nhanh--quick-start)
- [Quản lý Windows Daemon & System Tray](#-quản-lý-windows-daemon--system-tray)
- [Giao diện Dashboard / Web UI](#-giao-diện-dashboard--web-ui)
- [Tích hợp với Client (Cursor, Continue, Cline, Python, cURL)](#-tích-hợp-với-client)
- [Cấu hình môi trường / Configuration](#-cấu-hình-môi-trường--configuration)
- [Kiểm thử / Testing](#-kiểm-thử--testing)
- [Bảo mật / Security](#-bảo-mật--security)

---

## ✨ Tính năng nổi bật / Key Features

1. **Chuẩn OpenAI tương thích 100%:**
   - Cung cấp endpoints tiêu chuẩn `/v1/chat/completions` (hỗ trợ cả Server-Sent Events SSE streaming và non-streaming) và `/v1/models`.
   - Sử dụng liền mạch với mọi công cụ hỗ trợ OpenAI (Cursor, Cline, Continue.dev, Chatbox, Python/Node.js OpenAI SDKs).

2. **Hỗ trợ đa nhà cung cấp (Multi-Provider Adapters):**
   - **OpenAI:** GPT-4o, GPT-4o-mini, o1, o3-mini (API Key hoặc OAuth).
   - **Anthropic:** Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus (tự động chuyển đổi sang Messages API).
   - **Google Gemini:** Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash (chuyển đổi định dạng REST/SSE song song).
   - **Ollama / Local LLMs:** Tự động khám phá các model offline nội bộ (Llama 3, Qwen 2.5, DeepSeek R1, Mistral).

3. **Điều hướng thông minh & Tự động phục hồi (Intelligent Failover):**
   - Tự động chuyển tiếp request sang model dự phòng (fallback chain) khi gặp lỗi quá hạn ngạch (HTTP 429), gián đoạn mạng hoặc lỗi máy chủ nhà cung cấp (HTTP 5xx).

4. **Lưu trữ mã hóa cục bộ an toàn (Encrypted Persistence):**
   - Cơ sở dữ liệu SQLite siêu nhẹ với **Drizzle ORM** (zero Docker).
   - Toàn bộ API Key của nhà cung cấp và OAuth tokens được mã hóa chuẩn quân sự **AES-256-GCM** với IV ngẫu nhiên và auth tag xác thực tính toàn vẹn.

5. **Xác thực OAuth 2.0 PKCE chính quy (RFC 7636):**
   - Tích hợp luồng PKCE an toàn, local loopback callback server tự động bắt mã xác thực và background auto-refresh token trước khi hết hạn (60s buffer).

6. **Web Dashboard tích hợp sẵn (React 18 + Vite + Tailwind + Lucide):**
   - Được phục vụ trực tiếp tại `http://127.0.0.1:3000/` trên cùng một cổng với Gateway.
   - **Overview:** Theo dõi tổng số request, token vào/ra, độ trễ thời gian thực và lịch sử gọi API.
   - **Playground:** Thử nghiệm tương tác prompt trực tiếp với mọi model.
   - **API Keys:** Tạo, sao chép và thu hồi key gateway (`omni-live-...`).
   - **Providers:** Quản lý key hoặc kết nối OAuth cho từng nhà cung cấp chỉ với 1 click.

7. **Trải nghiệm Windows Workstation hoàn chỉnh:**
   - **Windows Background Daemon:** Chạy ngầm êm ái, quản lý tiến trình qua file `.omnirouter.pid`.
   - **System Tray Applet:** Biểu tượng khay hệ thống Windows (Taskbar Tray) với menu chuột phải điều khiển tiện lợi.
   - **Windows Native Notifications:** Thông báo Toast gốc Windows 10/11 khi khởi động hoặc failover.
   - **Auto-Start on Login:** Bật/tắt tự khởi động cùng Windows chỉ với 1 lệnh.
   - **One-Click Launcher (`omnirouter.cmd`):** Nhấp đúp chuột để khởi chạy ngay lập tức.

---

## 🏛 Kiến trúc hệ thống / Architecture

```
+-----------------------------------------------------------------------------------+
|                            Client Tools / AI IDEs                                 |
|             (Cursor, Continue.dev, Cline, Python/Node SDK, cURL)                  |
+------------------------------------------+----------------------------------------+
                                           | OpenAI-compatible requests
                                           v
+-----------------------------------------------------------------------------------+
|                      OmniRouter Fastify Gateway (Port 3000)                        |
|                                                                                   |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |  Auth Middleware   |  |  Usage Tracker     |  | Embedded React Dashboard    |  |
|  |  (omni-live-...)   |  |  (Tokens & Latency)|  | (http://127.0.0.1:3000/)    |  |
|  +---------+----------+  +---------+----------+  +-----------------------------+  |
|            |                       |                                              |
|            +-----------------------+                                              |
|                                    |                                              |
|                                    v                                              |
|  +-----------------------------------------------------------------------------+  |
|  |                  Provider Registry & Intelligent Failover                   |  |
|  |   - Primary Route Resolution: gpt-* | claude-* | gemini-* | ollama:*        |  |
|  |   - Failover Strategy: Fallback chain on 429 / 5xx / timeout                |  |
|  +------+--------------------+--------------------+--------------------+------+  |
|         |                    |                    |                    |          |
+---------|--------------------|--------------------|--------------------|----------+
          |                    |                    |                    |
          v                    v                    v                    v
+------------------+  +------------------+  +------------------+  +------------------+
| OpenAI Adapter   |  | Anthropic Adapter|  | Gemini Adapter   |  | Ollama Adapter   |
| (API / OAuth)    |  | (Messages API)   |  | (v1beta REST/SSE)|  | (Local 11434)    |
+------------------+  +------------------+  +------------------+  +------------------+
          |                    |                    |                    |
          +--------------------+--------------------+--------------------+
                               |
                               v
+-----------------------------------------------------------------------------------+
|                        Encrypted Storage & Windows Layer                          |
|  - SQLite (better-sqlite3) + Drizzle ORM (data/omnirouter.db)                     |
|  - AES-256-GCM Vault: Credentials & OAuth Tokens                                  |
|  - Windows Background Daemon (daemon.ps1) & Taskbar System Tray (tray.ps1)        |
+-----------------------------------------------------------------------------------+
```

---

## 💻 Yêu cầu hệ thống / Prerequisites

- **Hệ điều hành:** Windows 10 hoặc Windows 11 (64-bit).
- **Node.js:** Phiên bản 18.0.0 trở lên (khuyên dùng Node 20 hoặc 22 LTS).
- **PowerShell:** PowerShell 5.1 trở lên (đã có sẵn trên Windows 10/11).
- **Git:** Đã cài đặt trên máy.

---

## 🚀 Cài đặt & Khởi chạy nhanh / Quick Start

### Bước 1: Clone Repository
```powershell
git clone https://github.com/Anhquocqh25/OmniRouter.git
cd OmniRouter
```

### Bước 2: Cài đặt Dependencies & Build
```powershell
# Cài đặt backend dependencies
npm install

# Cài đặt frontend dependencies & biên dịch toàn bộ hệ thống
cd frontend
npm install
cd ..
npm run build
```

### Bước 3: Khởi chạy Gateway

Bạn có thể chọn 1 trong các cách sau:

#### Cách 1: Chạy 1 chạm bằng file `omnirouter.cmd` (Khuyên dùng)
- **Nhấp đúp chuột** vào file `omnirouter.cmd` trong thư mục gốc.
- Hoặc chạy từ terminal:
  ```powershell
  .\omnirouter.cmd
  ```
  *Tiến trình sẽ tự khởi chạy ngầm trong Windows và tự mở trình duyệt Dashboard tại `http://127.0.0.1:3000/`.*

#### Cách 2: Khởi chạy dạng Desktop Daemon qua npm
```powershell
npm run gateway:start
```

#### Cách 3: Chạy trực tiếp trong terminal (Foreground console)
```powershell
npm run start
```

---

## 🖥 Quản lý Windows Daemon & System Tray

OmniRouter cung cấp bộ công cụ PowerShell tích hợp sẵn trong `package.json`:

| Lệnh npm | Mô tả chức năng |
|---|---|
| `npm run gateway:start` | Khởi chạy OmniRouter dưới dạng tiến trình ngầm (Background Daemon). |
| `npm run gateway:stop` | Dừng tiến trình OmniRouter đang chạy ngầm an toàn. |
| `npm run gateway:status` | Kiểm tra tình trạng hoạt động (ONLINE/OFFLINE), RAM, PID và health check. |
| `npm run gateway:restart` | Khởi động lại gateway. |
| `npm run gateway:tray` | Mở ứng dụng **System Tray** ở thanh tác vụ góc dưới bên phải Windows. |
| `npm run gateway:autostart enable` | Cấu hình tự động khởi chạy OmniRouter khi bạn đăng nhập Windows. |
| `npm run gateway:autostart disable` | Tắt tự động khởi động cùng Windows. |

### Tính năng của Khay Hệ Thống (System Tray):
- **Nhấp đúp chuột:** Tự động mở Dashboard `http://127.0.0.1:3000/`.
- **Nhấp chuột phải:**
  - *Open Dashboard:* Truy cập trang quản trị.
  - *View Models (`/v1/models`):* Kiểm tra danh sách model khả dụng.
  - *Check Health Status:* Kiểm tra tình trạng kết nối.
  - *Start / Stop / Restart Gateway:* Điều khiển tiến trình gateway tức thì.
  - *Exit System Tray:* Thoát ứng dụng khay.

---

## 📊 Giao diện Dashboard / Web UI

Truy cập `http://127.0.0.1:3000/` sau khi khởi chạy:

1. **Tab Overview:**
   - Thống kê thời gian thực: Tổng lượt gọi, Prompt Tokens, Completion Tokens, Độ trễ trung bình (ms).
   - Biểu đồ phân bổ token & bảng nhật ký (Live Request Logs) chi tiết từng request.
2. **Tab Playground:**
   - Trực tiếp chat thử nghiệm với mọi model (`gpt-4o`, `claude-3-5-sonnet`, `gemini-2.0-flash`, `ollama:...`).
   - Tùy chỉnh `system prompt`, `temperature`, và chế độ streaming trực quan.
3. **Tab API Keys:**
   - Tạo khóa Gateway cá nhân (định dạng `omni-live-...`).
   - Sao chép khóa 1 lần duy nhất, theo dõi thời điểm sử dụng gần nhất và thu hồi (Revoke) khóa khi cần.
4. **Tab Providers:**
   - Quản lý trạng thái và cấu hình API Key của OpenAI, Anthropic, Gemini, Ollama.
   - Hỗ trợ đăng nhập OAuth 2.0 PKCE 1-click cho các nhà cung cấp hỗ trợ.

---

## 🔌 Tích hợp với Client

OmniRouter tương thích 100% với đặc tả OpenAI API. Bạn chỉ cần trỏ **Base URL** về `http://127.0.0.1:3000/v1`.

### 1. Cursor
- Mở **Cursor Settings** -> **Models**.
- Thêm hoặc bật model mong muốn (ví dụ: `gpt-4o`, `claude-3-5-sonnet`, `gemini-2.0-flash`).
- Trong mục **OpenAI API Key**, bật cấu hình Override OpenAI Base URL:
  - **Base URL:** `http://127.0.0.1:3000/v1`
  - **API Key:** Khóa gateway của bạn (`omni-live-...`) hoặc bất kỳ chuỗi nào nếu chưa kích hoạt gateway auth.

### 2. Continue.dev (VS Code / JetBrains)
Thêm vào file `config.json` của Continue:
```json
{
  "models": [
    {
      "title": "OmniRouter - Claude 3.5 Sonnet",
      "provider": "openai",
      "model": "claude-3-5-sonnet",
      "apiBase": "http://127.0.0.1:3000/v1",
      "apiKey": "omni-live-your-key-here"
    },
    {
      "title": "OmniRouter - GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "apiBase": "http://127.0.0.1:3000/v1",
      "apiKey": "omni-live-your-key-here"
    }
  ]
}
```

### 3. Python SDK (`openai`)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:3000/v1",
    api_key="omni-live-your-key-here"  # Tạo từ dashboard
)

response = client.chat.completions.create(
    model="claude-3-5-sonnet", # Hoặc gpt-4o, gemini-2.0-flash
    messages=[
        {"role": "user", "content": "Xin chào! Bạn có thể giúp gì cho tôi?"}
    ]
)

print(response.choices[0].message.content)
```

### 4. cURL
```bash
curl http://127.0.0.1:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer omni-live-your-key-here" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello OmniRouter!"}]
  }'
```

---

## ⚙️ Cấu hình môi trường / Configuration

Tạo file `.env` tại thư mục gốc (tham khảo `.env.example`):

```ini
PORT=3000
HOST=127.0.0.1
NODE_ENV=development

# Khóa bí mật mã hóa AES-256 (ít nhất 32 ký tự)
ENCRYPTION_KEY=omnirouter-default-secret-key-32bytes!

# Khóa Master Gateway (Tùy chọn - nếu để trống, quản lý qua Dashboard/DB)
GATEWAY_KEY=

# API Key mặc định (Có thể nhập trực tiếp trên Dashboard UI)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

---

## 🧪 Kiểm thử / Testing

OmniRouter được kiểm thử toàn diện với **Vitest**:

```powershell
# Chạy toàn bộ 64 tests
npm test

# Kiểm tra TypeScript type safety
npm run typecheck

# Chạy test ở chế độ watch
npm run test:watch
```

Kết quả:
```text
 Test Files  18 passed (18)
      Tests  64 passed (64)
```

---

## 🔒 Bảo mật / Security

- **Zero Key Exposure:** Không bao giờ ghi log hoặc để lộ API Key, OAuth tokens hay bearer headers trong logs.
- **AES-256-GCM Encryption:** Khóa và token nhạy cảm trong SQLite luôn được mã hóa hai chiều chuẩn xác thực.
- **Localhost Bound:** Gateway mặc định chỉ lắng nghe trên `127.0.0.1`, không mở port ra internet trừ khi bạn chủ động cấu hình.
- **Strict Validation:** Toàn bộ payload HTTP, tham số query và cấu hình đều được thẩm định nghiêm ngặt qua **Zod**.

---

## 📄 License

Dự án được phân phối dưới giấy phép **MIT License**. Bạn hoàn toàn tự do sử dụng cho mục đích cá nhân hoặc thương mại.
