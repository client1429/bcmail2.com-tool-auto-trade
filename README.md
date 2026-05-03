# 🤖 BC.GAME Futures Auto Trader v11 – Ultimate Edition

<p align="center">
  <img src="https://img.shields.io/badge/version-11.0-blue?style=for-the-badge" alt="version" />
  <img src="https://img.shields.io/badge/platform-Tampermonkey-green?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/language-JavaScript-yellow?style=for-the-badge" alt="language" />
  <br/>
  <img src="https://img.shields.io/badge/trading-futures-red?style=flat-square" alt="trading" />
  <img src="https://img.shields.io/badge/technical analysis-all%20in%20one-purple?style=flat-square" alt="analysis" />
  <img src="https://img.shields.io/badge/risk%20management-professional-orange?style=flat-square" alt="risk management" />
</p>

<p align="center">
  <b>🇻🇳 [Tiếng Việt](#tiếng-việt) | 🇬🇧 [English](#english)</b>
</p>

---

## 🇻🇳 Tiếng Việt

### 🔥 Giới Thiệu

**BC.GAME Futures Auto Trader** là một Userscript mạnh mẽ dành cho nền tảng giao dịch hợp đồng tương lai BC.GAME. Script này cung cấp bộ công cụ giao dịch tự động toàn diện, bao gồm:

-   Đặt lệnh thủ công / tự động với các chiến lược kỹ thuật (EMA, RSI, Bollinger Bands, MACD, Tổng hợp, Scalping).
-   Phân tích kỹ thuật real‑time từ Binance API hoặc giá web.
-   Quản lý rủi ro chuyên nghiệp: Trailing Stop, Martingale, Account Risk Limit, Multi‑Timeframe Filter, Partial Take Profit.
-   Hỗ trợ đầy đủ các công cụ hỗ trợ: Cảnh báo giá, Âm thanh, Chống phát hiện (anti‑detection), Multi‑Profile, Xuất CSV.

Script hoạt động trực tiếp trên trang `https://bcmail2.com/vi/trading/contract` thông qua Tampermonkey.

### ✨ Tính Năng Chính

| Tính năng | Mô tả |
|-----------|-------|
| 📈 Giao dịch thủ công / tự động | Đặt lệnh Long/Short chỉ với một cú nhấp chuột hoặc để bot tự chạy theo tín hiệu. |
| 📊 Phân tích kỹ thuật đa nguồn | EMA, RSI, Bollinger Bands, MACD, Tổng hợp, Scalping. Dữ liệu từ Binance API hoặc giá hiển thị trên web. |
| 🔁 Trailing Stop Loss | Tự động điều chỉnh mức cắt lỗ theo hướng có lợi, bảo vệ lợi nhuận. |
| 📈 Martingale | Tăng kích thước lệnh sau khi thua để gỡ lại vốn (có thể cấu hình số bước và hệ số). |
| 📊 Bộ lọc đa khung thời gian (MTF) | Chỉ vào lệnh khi khung lớn (5m, 15m, 1h) đồng thuận với tín hiệu. |
| ✂️ Chốt lời từng phần (Partial TP) | Tự động đóng một phần vị thế khi đạt % mục tiêu lợi nhuận, giảm rủi ro. |
| 🛡️ Quản lý rủi ro tài khoản | Dừng toàn bộ bot nếu tài khoản lỗ vượt ngưỡng X%. |
| 🛡️ Chống phát hiện (Anti‑Detection) | Mô phỏng thao tác con người với delay ngẫu nhiên và click offset. |
| 🔔 Cảnh báo giá (Price Alert) | Phát âm thanh khi giá chạm mức cài đặt. |
| 💾 Multi‑Profile | Lưu và tải nhanh các bộ cài đặt khác nhau (scalping, swing, an toàn…). |
| 📤 Export CSV | Xuất lịch sử giao dịch ra file CSV để phân tích. |
| ⏱️ Delay đặt lệnh | Có thể trì hoãn lệnh từ 5–60 giây sau tín hiệu. |
| 🔄 Reverse Trade | Đảo ngược tín hiệu (Long thành Short và ngược lại). |
| 🖱️ Giao diện trực quan | Panel kéo thả, tab đa chức năng, slider đòn bẩy & delay trực quan. |

### 📥 Cài Đặt

1.  Cài đặt tiện ích mở rộng **Tampermonkey** cho trình duyệt của bạn:
    -   [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmjfajjejblffkgolomiel)
    -   [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
    -   [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/ljfpldnlpnemicmhcagbcikijobpchae)
2.  Mở Tampermonkey, chọn **Create a new script**.
3.  Xóa toàn bộ code mẫu.
4.  Copy toàn bộ code của script (`BC.GAME.Futures.Auto.Trader.v11.user.js`) và dán vào.
5.  Nhấn **File → Save** (Ctrl+S).
6.  Truy cập `https://bcmail2.com/vi/trading/contract`. Bạn sẽ thấy bảng điều khiển **🤖 Trader v11 (Ultimate)** xuất hiện ở góc phải màn hình.

### 🚀 Cách Sử Dụng Nhanh

1.  **Chọn cặp giao dịch** từ dropdown (bấm 🔄 để quét lại danh sách coin).
2.  **Nhập số tiền ký quỹ** (VNDFIAT), điều chỉnh **đòn bẩy** và **delay đặt lệnh** bằng các slider.
3.  Đặt mức **Lãi (TP)** và **Cắt lỗ (SL)** mong muốn (bằng VND).
4.  Chọn **chiến lược** (EMA, RSI, Bollinger…).
5.  Bật **Tự động giao dịch** nếu muốn bot tự chạy.
6.  Theo dõi tín hiệu qua dòng **live status**.
7.  Vào tab **⚙️ Cài đặt** để kích hoạt các tính năng nâng cao (Trailing, Martingale, MTF, Partial TP, Account Risk, Price Alert, Profile, Export CSV).

### ⚙️ Các Tab Chức Năng

-   **📈 Giao dịch** – Đặt lệnh, cấu hình cơ bản, bật/tắt Auto Trade.
-   **🔍 Phân tích** – Xem chỉ báo kỹ thuật real‑time (RSI, EMA, MACD, Bollinger Bands).
-   **📖 Hướng dẫn** – Giải thích chi tiết từng chiến lược và tính năng.
-   **📜 Lịch sử** – Xem lại các lệnh đã thực hiện, trạng thái thành công/thất bại.
-   **⚙️ Cài đặt** – Tất cả tính năng nâng cao.
-   **❓ Hỗ trợ** – Thông tin liên hệ.

### ⚠️ Lưu Ý Quan Trọng

-   Script chỉ hoạt động trên trang `https://bcmail2.com/vi/trading/contract`.
-   **Giao dịch tiền mã hóa có rủi ro cao.** Không có chiến lược nào đảm bảo lợi nhuận 100%.
-   Hãy luôn quản lý vốn và rủi ro chặt chẽ.
-   Nên thử nghiệm với số vốn nhỏ hoặc tài khoản demo trước khi dùng tiền thật.
-   Nếu giao diện BC.GAME thay đổi, script có thể cần cập nhật lại các selector. Hãy theo dõi repo để nhận phiên bản mới nhất.

### 📞 Hỗ Trợ

Nếu bạn có câu hỏi hoặc cần trợ giúp, vui lòng mở một issue trên GitHub hoặc liên hệ qua Discord : **@souninjinma**.

---

## 🇬🇧 English

### 🔥 Introduction

**BC.GAME Futures Auto Trader** is a powerful Userscript for the BC.GAME futures trading platform. It provides a comprehensive set of automated trading tools, including:

-   Manual / automated order placement with technical strategies (EMA, RSI, Bollinger Bands, MACD, Combined, Scalping).
-   Real‑time technical analysis from Binance API or web price.
-   Professional risk management: Trailing Stop, Martingale, Account Risk Limit, Multi‑Timeframe Filter, Partial Take Profit.
-   Full support tools: Price Alert, Sound, Anti‑Detection, Multi‑Profile, CSV Export.

The script runs directly on `https://bcmail2.com/vi/trading/contract` via Tampermonkey.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📈 Manual / Auto Trading | Place Long/Short orders with one click or let the bot follow signals automatically. |
| 📊 Multi‑source Technical Analysis | EMA, RSI, Bollinger Bands, MACD, Combined, Scalping. Data from Binance API or on‑screen price. |
| 🔁 Trailing Stop Loss | Automatically moves SL in the profitable direction, protecting gains. |
| 📈 Martingale | Increase order size after losses to recover capital (configurable steps and multiplier). |
| 📊 Multi‑Timeframe Filter (MTF) | Only enter trades when the higher timeframe (5m, 15m, 1h) agrees with the signal. |
| ✂️ Partial Take Profit | Automatically close a portion of the position when a % of TP target is reached. |
| 🛡️ Account Risk Management | Stop the entire bot if account drawdown exceeds X%. |
| 🛡️ Anti‑Detection | Simulates human‑like actions with random delays and click offsets. |
| 🔔 Price Alert | Plays a sound when the price reaches a preset level. |
| 💾 Multi‑Profile | Save and quickly load different setting presets (scalping, swing, safe…). |
| 📤 CSV Export | Export trade history to a CSV file for analysis. |
| ⏱️ Order Delay | Delay order placement by 5–60 seconds after the signal. |
| 🔄 Reverse Trade | Reverse the signal (Long → Short and vice versa). |
| 🖱️ Intuitive UI | Draggable panel, multi‑tab, visual leverage & delay sliders. |

### 📥 Installation

1.  Install the **Tampermonkey** extension for your browser:
    -   [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmjfajjejblffkgolomiel)
    -   [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
    -   [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/ljfpldnlpnemicmhcagbcikijobpchae)
2.  Open Tampermonkey and select **Create a new script**.
3.  Delete the default template code.
4.  Copy the entire script code (`BC.GAME.Futures.Auto.Trader.v11.user.js`) and paste it.
5.  Press **File → Save** (Ctrl+S).
6.  Navigate to `https://bcmail2.com/vi/trading/contract`. You will see the **🤖 Trader v11 (Ultimate)** panel appear on the right side of the screen.

### 🚀 Quick Start

1.  **Select a trading pair** from the dropdown (click 🔄 to refresh the coin list).
2.  **Enter margin** (VNDFIAT), adjust **leverage** and **order delay** using the sliders.
3.  Set your desired **Take Profit (TP)** and **Stop Loss (SL)** in VND.
4.  Choose a **strategy** (EMA, RSI, Bollinger…).
5.  Enable **Auto Trade** if you want the bot to run automatically.
6.  Watch the signal on the **live status** line.
7.  Go to the **⚙️ Settings** tab to activate advanced features (Trailing, Martingale, MTF, Partial TP, Account Risk, Price Alert, Profile, CSV Export).

### ⚙️ Functional Tabs

-   **📈 Trade** – Manual order placement, basic settings, Auto Trade on/off.
-   **🔍 Analysis** – Real‑time indicators (RSI, EMA, MACD, Bollinger Bands).
-   **📖 Guide** – Detailed explanation of each strategy and feature.
-   **📜 History** – Review past trades with success/failure status.
-   **⚙️ Settings** – All advanced features.
-   **❓ Help** – Contact information.

### ⚠️ Important Notes

-   The script only works on `https://bcmail2.com/vi/trading/contract`.
-   **Cryptocurrency trading involves high risk.** No strategy can guarantee 100% profit.
-   Always manage your capital and risk carefully.
-   Test with a small amount or a demo account before using real funds.
-   If the BC.GAME interface changes, the script may require selector updates. Watch the repo for the latest version.

### 📞 Support

If you have questions or need assistance, please open a GitHub issue or contact us via Discord: @Souninjinma.

---

<p align="center">
  <b>⭐ Đừng quên để lại một Star nếu bạn thấy dự án hữu ích! / Don't forget to leave a Star if you find this project useful! ⭐</b>
</p>
```
