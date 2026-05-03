// ==UserScript==
// @name         BC.GAME Futures Auto Trader v11.1 – Ultimate (Fixed)
// @namespace    http://tampermonkey.net/
// @version      11.1
// @description  All-in-one: Trailing, Martingale, MTF, Partial TP, Account Risk, Toggle Delay, v.v.
// @author       Assistant
// @match        https://playglobal1.com/vi/trading/contract*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      api.binance.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ---------- CẤU HÌNH MẶC ĐỊNH ----------
    const DEFAULT_SETTINGS = {
        amountVND: 25000,
        leverage: 100,
        takeProfitVND: 50000,
        stopLossVND: 25000,
        autoTrade: false,
        strategy: 'trendFollow',
        selectedSymbol: 'BTCUSDT',
        delayEnabled: true,
        delaySeconds: 5,
        antiDetection: true,

        trailingStop: false,
        trailingPercent: 2,
        reverseTrade: false,
        martingaleEnabled: false,
        martingaleMultiplier: 2,
        martingaleMaxSteps: 3,
        priceAlertEnabled: false,
        priceAlertValue: 0,
        soundEnabled: true,

        accountRiskEnabled: false,
        accountRiskPercent: 30,
        mtfEnabled: false,
        mtfTimeframe: '5m',
        partialTPEnabled: false,
        partialTPPercent: 50,
        partialTPClosePercent: 50
    };

    let settings = GM_getValue('bc_v11_settings', DEFAULT_SETTINGS);

    const BINANCE_PAIRS = [
        'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT',
        'AVAXUSDT','LINKUSDT','DOTUSDT','LTCUSDT','BCHUSDT','TRXUSDT',
        'ARBUSDT','SUIUSDT','TONUSDT','APTUSDT','SEIUSDT','KASUSDT',
        'TIAUSDT','INJUSDT','JUPUSDT','ONDOUSDT','ENAUSDT','AAVEUSDT',
        'XMRUSDT','DASHUSDT','APEUSDT','HBARUSDT','STRKUSDT','RENDERUSDT',
        'WLDUSDT','WIFUSDT','TAOUSDT','BERAUSDT','POPCATUSDT','VIRTUALUSDT'
    ];

    let priceHistory = [];
    const MAX_HISTORY = 200;
    const parseNumber = (str) => parseFloat(str.replace(/,/g, ''));
    const formatVND = (num) => Math.round(num).toLocaleString('en-US');

    let currentPosition = null;
    let trailingInterval = null;
    let autoInterval = null;
    let countdownTimer = null;
    let countdownSeconds = 0;
    let consecutiveLosses = 0;
    let consecutiveWins = 0;
    let priceAlertInterval = null;
    let analysisLiveInterval = null;
    let partialTPInterval = null;
    let initialBalance = null;

    // ---------- STYLE ----------
    GM_addStyle(`
        .bc-v11-slider { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; background: #334155; outline: none; margin: 8px 0; }
        .bc-v11-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #38bdf8; cursor: pointer; border: 2px solid #0f172a; box-shadow: 0 0 4px rgba(56,189,248,0.5); }
        .bc-v11-label { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        .bc-v11-value { font-weight: bold; color: #38bdf8; min-width: 35px; text-align: right; }
        .bc-v11-menu-btn { background: transparent; border: none; color: #cbd5e1; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; }
        .bc-v11-menu-btn.active { background: #38bdf8; color: #0f172a; font-weight: bold; }
        .bc-v11-tab-content { display: none; }
        .bc-v11-tab-content.active { display: block; }
    `);

    // ---------- GIAO DIỆN ----------
    const panelHTML = `
    <div id="bc-v11-panel" style="
        position: fixed; top: 60px; right: 20px; z-index: 99999;
        background: #1e293b; color: #e2e8f0; border-radius: 12px;
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px;
        width: 430px; box-shadow: 0 8px 30px rgba(0,0,0,0.7);
    ">
        <div id="bc-v11-header" style="
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 15px; background: #0f172a; border-radius: 12px 12px 0 0;
            cursor: move;
        ">
            <span style="font-weight: bold; color: #38bdf8;">🤖 Trader v11.1 (Fixed)</span>
            <span id="bc-v11-toggle" style="cursor: pointer; font-size: 18px;">−</span>
        </div>
        <div id="bc-v11-body" style="padding: 12px 15px;">
            <!-- MENU -->
            <div style="display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap;">
                <button class="bc-v11-menu-btn active" data-tab="trade">📈 Giao dịch</button>
                <button class="bc-v11-menu-btn" data-tab="analysis">🔍 Phân tích</button>
                <button class="bc-v11-menu-btn" data-tab="guide">📖 Hướng dẫn</button>
                <button class="bc-v11-menu-btn" data-tab="history">📜 Lịch sử</button>
                <button class="bc-v11-menu-btn" data-tab="settings">⚙️ Cài đặt</button>
                <button class="bc-v11-menu-btn" data-tab="help">❓ Hỗ trợ</button>
            </div>

            <!-- TAB GIAO DỊCH -->
            <div id="bc-v11-tab-trade" class="bc-v11-tab-content active">
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Số dư ví</label>
                    <div style="font-size:14px; font-weight:bold; color:#38bdf8;" id="bc-v11-balance">--</div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Tổng lãi/lỗ (ước tính)</label>
                    <div style="font-size:14px; font-weight:bold;" id="bc-v11-total-pnl">--</div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Cặp giao dịch</label>
                    <div style="display: flex; gap: 5px;">
                        <select id="bc-v11-symbol" style="flex:1; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#e2e8f0; font-size:12px;"></select>
                        <button id="bc-v11-refresh-coins" style="background:#334155; border:none; color:white; padding:6px 8px; border-radius:4px; font-size:11px;" title="Quét danh sách coin">🔄</button>
                    </div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Số tiền ký quỹ (VNDFIAT)</label>
                    <input id="bc-v11-amount" type="text" value="${formatVND(settings.amountVND)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#e2e8f0;" inputmode="numeric">
                </div>

                <!-- SLIDER ĐÒN BẨY -->
                <div style="margin-bottom: 8px;">
                    <div class="bc-v11-label">
                        <span>Đòn bẩy</span>
                        <span class="bc-v11-value" id="bc-v11-leverage-val">${settings.leverage}x</span>
                    </div>
                    <input type="range" id="bc-v11-leverage-slider" class="bc-v11-slider" min="1" max="1000" value="${settings.leverage}" step="1">
                </div>

                <!-- SLIDER DELAY (ẩn/hiện theo checkbox) -->
                <div id="bc-v11-delay-slider-container" style="display:${settings.delayEnabled ? 'block' : 'none'};">
                    <div style="margin-bottom: 8px;">
                        <div class="bc-v11-label">
                            <span>Delay đặt lệnh (giây)</span>
                            <span class="bc-v11-value" id="bc-v11-delay-val">${settings.delaySeconds}s</span>
                        </div>
                        <input type="range" id="bc-v11-delay-slider" class="bc-v11-slider" min="5" max="60" value="${settings.delaySeconds}" step="1">
                    </div>
                </div>

                <!-- COUNTDOWN -->
                <div style="margin-bottom: 8px; text-align: center; font-size: 12px; color: #f59e0b;" id="bc-v11-countdown"></div>

                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                    <div style="flex:1;">
                        <label style="font-size: 11px; color: #10b981;">💚 Lãi (VND)</label>
                        <input id="bc-v11-tp" type="text" value="${formatVND(settings.takeProfitVND)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #10b981; border-radius:6px; color:#10b981;" inputmode="numeric">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size: 11px; color: #ef4444;">❤️ Cắt lỗ (VND)</label>
                        <input id="bc-v11-sl" type="text" value="${formatVND(settings.stopLossVND)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #ef4444; border-radius:6px; color:#ef4444;" inputmode="numeric">
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <button id="bc-v11-long" style="flex:1; background:#10b981; border:none; padding:10px; border-radius:6px; color:white; font-weight:bold;">📈 Long</button>
                    <button id="bc-v11-short" style="flex:1; background:#ef4444; border:none; padding:10px; border-radius:6px; color:white; font-weight:bold;">📉 Short</button>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                    <input type="checkbox" id="bc-v11-delay-enabled" ${settings.delayEnabled ? 'checked' : ''}>
                    <label for="bc-v11-delay-enabled" style="font-size: 11px;">⏳ Delay</label>
                    <input type="checkbox" id="bc-v11-auto" ${settings.autoTrade ? 'checked' : ''}>
                    <label for="bc-v11-auto" style="font-size: 11px;">Tự động giao dịch</label>
                    <select id="bc-v11-strategy" style="background:#0f172a; border:1px solid #334155; color:#e2e8f0; padding:4px; border-radius:4px; font-size:11px;">
                        <option value="trendFollow" ${settings.strategy === 'trendFollow' ? 'selected' : ''}>EMA</option>
                        <option value="rsi" ${settings.strategy === 'rsi' ? 'selected' : ''}>RSI</option>
                        <option value="bb" ${settings.strategy === 'bb' ? 'selected' : ''}>Bollinger</option>
                        <option value="macd" ${settings.strategy === 'macd' ? 'selected' : ''}>MACD</option>
                        <option value="combined" ${settings.strategy === 'combined' ? 'selected' : ''}>Tổng hợp</option>
                        <option value="scalping" ${settings.strategy === 'scalping' ? 'selected' : ''}>Scalping</option>
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <input type="checkbox" id="bc-v11-anti-detect" ${settings.antiDetection ? 'checked' : ''}>
                    <label for="bc-v11-anti-detect" style="font-size: 11px;">🛡️ Chống phát hiện</label>
                    <input type="checkbox" id="bc-v11-reverse" ${settings.reverseTrade ? 'checked' : ''}>
                    <label for="bc-v11-reverse" style="font-size: 11px;">🔄 Đảo chiều</label>
                    <input type="checkbox" id="bc-v11-sound" ${settings.soundEnabled ? 'checked' : ''}>
                    <label for="bc-v11-sound" style="font-size: 11px;">🔔</label>
                </div>
                <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;" id="bc-v11-live-status">Sẵn sàng</div>
                <div id="bc-v11-status" style="margin-top: 8px; font-size: 11px; color: #facc15;"></div>
            </div>

            <!-- TAB PHÂN TÍCH -->
            <div id="bc-v11-tab-analysis" class="bc-v11-tab-content">
                <div id="bc-v11-analysis-container">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <span style="font-size:14px; font-weight:bold;" id="bc-v11-analysis-symbol">--</span>
                        <span style="font-size:12px; color:#94a3b8;" id="bc-v11-analysis-price">--</span>
                        <span style="font-size:10px; background:#334155; padding:2px 6px; border-radius:4px;" id="bc-v11-analysis-source">--</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">RSI (14)</div>
                            <div style="font-size:16px; font-weight:bold;" id="bc-v11-rsi-val">--</div>
                            <div style="font-size:10px;" id="bc-v11-rsi-sig"></div>
                        </div>
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">EMA (12/26)</div>
                            <div style="font-size:12px;" id="bc-v11-ema-val">--</div>
                            <div style="font-size:10px;" id="bc-v11-ema-sig"></div>
                        </div>
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">MACD</div>
                            <div style="font-size:12px;" id="bc-v11-macd-val">--</div>
                            <div style="font-size:10px;" id="bc-v11-macd-sig"></div>
                        </div>
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">Bollinger</div>
                            <div style="font-size:12px;" id="bc-v11-bb-val">--</div>
                            <div style="font-size:10px;" id="bc-v11-bb-sig"></div>
                        </div>
                    </div>
                    <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="font-size:11px;">Khuyến nghị</span>
                            <span style="font-size:11px; font-weight:bold;" id="bc-v11-recommendation">--</span>
                        </div>
                        <div style="height:6px; background:#334155; border-radius:3px; margin-top:4px;">
                            <div id="bc-v11-score-bar" style="height:100%; width:0%; background:#38bdf8; border-radius:3px; transition: width 0.5s;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#64748b; margin-top:2px;">
                            <span>Bán mạnh</span><span>Bán</span><span>Trung lập</span><span>Mua</span><span>Mua mạnh</span>
                        </div>
                    </div>
                    <div id="bc-v11-debug-info" style="font-size:10px; color:#64748b;"></div>
                </div>
                <button id="bc-v11-refresh-analysis" style="width:100%; margin-top:8px; background:#334155; border:none; color:white; padding:6px; border-radius:4px; font-size:11px;">🔄 Phân tích lại</button>
            </div>

            <!-- TAB HƯỚNG DẪN (đầy đủ) -->
            <div id="bc-v11-tab-guide" class="bc-v11-tab-content">
    <div style="max-height: 400px; overflow-y: auto; padding-right:5px;">
        <!-- Header -->
        <div style="text-align:center; margin-bottom:15px;">
            <h3 style="color:#38bdf8; margin:0 0 5px;">📖 Hướng Dẫn Toàn Diện</h3>
            <p style="font-size:11px; color:#94a3b8; margin:0;">Mọi thứ bạn cần biết để làm chủ Auto Trader v11</p>
        </div>

        <!-- 1. TỔNG QUAN -->
        <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:12px; border-left:3px solid #38bdf8;">
            <h4 style="color:#38bdf8; margin:0 0 6px;">🚀 Tổng Quan</h4>
            <p style="font-size:11px; color:#cbd5e1; margin:0;">
                Script tự động hóa giao dịch Futures trên BC.GAME. Hỗ trợ đặt lệnh thủ công, tự động theo tín hiệu kỹ thuật, quản lý rủi ro nâng cao.
                Dữ liệu phân tích được lấy từ Binance API (cho các cặp phổ biến) hoặc từ giá hiển thị trên web.
            </p>
        </div>

        <!-- 2. CÁC TAB CHỨC NĂNG -->
        <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:12px; border-left:3px solid #f59e0b;">
            <h4 style="color:#f59e0b; margin:0 0 6px;">📂 Các Tab Chính</h4>
            <ul style="margin:0; padding-left:15px; font-size:11px; color:#cbd5e1;">
                <li><b>📈 Giao dịch</b> – Đặt lệnh, cấu hình cơ bản, bật/tắt Auto Trade.</li>
                <li><b>🔍 Phân tích</b> – Xem chỉ báo kỹ thuật real-time (RSI, EMA, MACD, Bollinger Bands).</li>
                <li><b>📖 Hướng dẫn</b> – Tab bạn đang xem.</li>
                <li><b>📜 Lịch sử</b> – Xem lại các lệnh đã thực hiện, trạng thái thành công/thất bại.</li>
                <li><b>⚙️ Cài đặt</b> – Tất cả tính năng nâng cao: Trailing, Martingale, MTF, Partial TP, Account Risk, Price Alert, Profile, Export CSV.</li>
                <li><b>❓ Hỗ trợ</b> – Thông tin liên hệ.</li>
            </ul>
        </div>

        <!-- 3. CHIẾN LƯỢC GIAO DỊCH -->
        <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:12px; border-left:3px solid #10b981;">
            <h4 style="color:#10b981; margin:0 0 6px;">📊 Chiến Lược Giao Dịch</h4>

            <!-- EMA -->
            <div style="background:#1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
                <h5 style="color:#facc15; margin:0 0 3px;">EMA – Theo Xu Hướng (Trend Follow)</h5>
                <p style="font-size:10px; color:#94a3b8; margin:0;">
                    <b>Nguyên lý:</b> Sử dụng EMA12 (nhanh) và EMA26 (chậm). Khi EMA12 cắt lên EMA26 → MUA. Khi cắt xuống → BÁN.<br>
                    <b>Phù hợp:</b> Thị trường có xu hướng rõ ràng.<br>
                    <b>Tín hiệu:</b> Trung bình (có thể trễ).
                </p>
            </div>

            <!-- RSI -->
            <div style="background:#1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
                <h5 style="color:#facc15; margin:0 0 3px;">RSI – Sức Mạnh Tương Đối</h5>
                <p style="font-size:10px; color:#94a3b8; margin:0;">
                    <b>Nguyên lý:</b> RSI(14) < 35 (quá bán) → MUA; RSI > 65 (quá mua) → BÁN.<br>
                    <b>Phù hợp:</b> Thị trường dao động (sideway).<br>
                    <b>Tín hiệu:</b> Sớm, dễ bị nhiễu nếu thị trường trend mạnh.
                </p>
            </div>

            <!-- Bollinger -->
            <div style="background:#1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
                <h5 style="color:#facc15; margin:0 0 3px;">Bollinger Bands – Dải Băng</h5>
                <p style="font-size:10px; color:#94a3b8; margin:0;">
                    <b>Nguyên lý:</b> Giá chạm dải dưới → MUA; chạm dải trên → BÁN.<br>
                    <b>Phù hợp:</b> Thị trường ít biến động mạnh.<br>
                    <b>Tín hiệu:</b> Khá tin cậy khi giá bật khỏi biên.
                </p>
            </div>

            <!-- MACD -->
            <div style="background:#1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
                <h5 style="color:#facc15; margin:0 0 3px;">MACD – Trung Bình Động Hội Tụ Phân Kỳ</h5>
                <p style="font-size:10px; color:#94a3b8; margin:0;">
                    <b>Nguyên lý:</b> MACD = EMA12 – EMA26. Signal = EMA9 của MACD. Khi MACD cắt lên Signal → MUA; cắt xuống → BÁN.<br>
                    <b>Phù hợp:</b> Xác nhận xu hướng và động lượng.<br>
                    <b>Tín hiệu:</b> Mạnh nhưng trễ hơn EMA.
                </p>
            </div>

            <!-- Combined -->
            <div style="background:#1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
                <h5 style="color:#facc15; margin:0 0 3px;">Tổng Hợp (Combined)</h5>
                <p style="font-size:10px; color:#94a3b8; margin:0;">
                    <b>Nguyên lý:</b> Kết hợp RSI, Bollinger, MACD, EMA. Mỗi chỉ báo cho điểm +1/+2 (Mua) hoặc -1/-2 (Bán). Tổng điểm ≥3 → MUA, ≤ -3 → BÁN.<br>
                    <b>Phù hợp:</b> Lọc nhiễu, tăng độ chính xác.<br>
                    <b>Tín hiệu:</b> Ít hơn nhưng chất lượng cao hơn.
                </p>
            </div>

            <!-- Scalping -->
            <div style="background:#1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
                <h5 style="color:#facc15; margin:0 0 3px;">Scalping – Lướt Sóng Nhanh (Rủi Ro Cao)</h5>
                <p style="font-size:10px; color:#94a3b8; margin:0;">
                    <b>Nguyên lý:</b> Biến động > 0.2% trong 5 giây gần nhất → MUA (nếu tăng) hoặc BÁN (nếu giảm).<br>
                    <b>Phù hợp:</b> Người thích mạo hiểm, khung thời gian rất ngắn.<br>
                    <b>Tín hiệu:</b> Rất nhanh, tỉ lệ thắng thấp hơn.
                </p>
            </div>
        </div>

        <!-- 4. TÍNH NĂNG NÂNG CAO -->
        <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:12px; border-left:3px solid #ef4444;">
            <h4 style="color:#ef4444; margin:0 0 6px;">⚙️ Tính Năng Nâng Cao</h4>
            <ul style="margin:0; padding-left:15px; font-size:11px; color:#cbd5e1;">
                <li><b>🔁 Trailing Stop:</b> Tự động di chuyển SL theo hướng có lợi khi giá đi đúng hướng.</li>
                <li><b>🔄 Reverse Trade:</b> Đảo ngược tín hiệu (Long → Short và ngược lại).</li>
                <li><b>📈 Martingale:</b> Tăng kích thước lệnh sau mỗi lần thua (theo cấp số nhân).</li>
                <li><b>📊 Multi-Timeframe (MTF):</b> Chỉ vào lệnh khi khung lớn (5m/15m/1h) đồng thuận với tín hiệu.</li>
                <li><b>✂️ Partial TP:</b> Tự động chốt một phần vị thế khi đạt % mục tiêu TP.</li>
                <li><b>🛡️ Account Risk:</b> Dừng toàn bộ bot nếu tài khoản lỗ vượt ngưỡng X%.</li>
                <li><b>🔔 Price Alert:</b> Phát âm thanh khi giá chạm mức cài đặt.</li>
                <li><b>🛡️ Anti-Detection:</b> Mô phỏng thao tác con người (delay ngẫu nhiên, click offset).</li>
                <li><b>⏱️ Delay:</b> Trì hoãn đặt lệnh từ 5-60 giây sau tín hiệu.</li>
                <li><b>💾 Multi-Profile:</b> Lưu/tải nhanh các bộ cài đặt khác nhau.</li>
                <li><b>📤 Export CSV:</b> Xuất lịch sử giao dịch ra file CSV.</li>
            </ul>
        </div>

        <!-- 5. CÁCH SỬ DỤNG NHANH -->
        <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:12px; border-left:3px solid #8b5cf6;">
            <h4 style="color:#8b5cf6; margin:0 0 6px;">🎯 Cách Sử Dụng Nhanh</h4>
            <ol style="margin:0; padding-left:15px; font-size:11px; color:#cbd5e1;">
                <li>Chọn cặp giao dịch từ dropdown (hoặc bấm 🔄 để quét lại).</li>
                <li>Nhập số tiền ký quỹ (VNDFIAT), điều chỉnh đòn bẩy bằng slider.</li>
                <li>Đặt mức Lãi và Cắt lỗ mong muốn (bằng VND).</li>
                <li>Chọn chiến lược (EMA, RSI, Bollinger…).</li>
                <li>Bật <b>Tự động giao dịch</b> nếu muốn bot chạy tự động.</li>
                <li>Theo dõi tín hiệu và trạng thái ở dòng live status.</li>
                <li>Vào tab <b>⚙️ Cài đặt</b> để kích hoạt các tính năng nâng cao.</li>
            </ol>
        </div>

        <!-- 6. LƯU Ý -->
        <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:12px; border-left:3px solid #facc15;">
            <h4 style="color:#facc15; margin:0 0 6px;">⚠️ Lưu Ý Quan Trọng</h4>
            <ul style="margin:0; padding-left:15px; font-size:11px; color:#cbd5e1;">
                <li>Script chỉ hoạt động trên trang <b>https://bcmail2.com/vi/trading/contract</b>.</li>
                <li>Không đảm bảo lợi nhuận – luôn có rủi ro trong giao dịch.</li>
                <li>Nên thử nghiệm với số vốn nhỏ hoặc tài khoản demo trước khi dùng thật.</li>
                <li>Các chiến lược kỹ thuật chỉ mang tính tham khảo, cần kết hợp quản lý vốn.</li>
                <li>Nếu giao diện BC.GAME thay đổi, script có thể cần cập nhật selector.</li>
            </ul>
        </div>

        <p style="text-align:center; font-size:10px; color:#64748b; margin-top:10px;">
            🤖 BC.GAME Futures Auto Trader v11 – Ultimate Edition<br>
            Phát triển bởi Souninjinma • Hỗ trợ: @souninjinma discord
        </p>
    </div>
</div>

            <!-- TAB CÀI ĐẶT (MỞ RỘNG) -->
            <div id="bc-v11-tab-settings" class="bc-v11-tab-content">
                <div style="max-height: 400px; overflow-y: auto; padding-right:5px;">
                    <h3 style="color:#38bdf8; margin-top:0;">⚙️ Cài đặt nâng cao</h3>

                    <!-- TRAILING -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">🔁 Trailing Stop Loss</h4>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="bc-v11-trailing" ${settings.trailingStop ? 'checked' : ''}>
                            <label for="bc-v11-trailing" style="font-size: 11px;">Kích hoạt</label>
                            <input id="bc-v11-trailing-percent" type="number" value="${settings.trailingPercent}" step="0.1" style="width:60px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                            <span>%</span>
                        </div>
                    </div>

                    <!-- MARTINGALE -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">📈 Martingale</h4>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <input type="checkbox" id="bc-v11-martingale" ${settings.martingaleEnabled ? 'checked' : ''}>
                            <label for="bc-v11-martingale" style="font-size: 11px;">Kích hoạt</label>
                            <label>Hệ số:</label>
                            <input id="bc-v11-martingale-mult" type="number" value="${settings.martingaleMultiplier}" step="0.1" style="width:60px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                            <label>Bước tối đa:</label>
                            <input id="bc-v11-martingale-steps" type="number" value="${settings.martingaleMaxSteps}" step="1" style="width:50px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                        </div>
                    </div>

                    <!-- PRICE ALERT -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">🔔 Cảnh báo giá</h4>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="bc-v11-price-alert" ${settings.priceAlertEnabled ? 'checked' : ''}>
                            <label for="bc-v11-price-alert" style="font-size: 11px;">Kích hoạt</label>
                            <input id="bc-v11-price-alert-value" type="number" value="${settings.priceAlertValue}" step="any" style="width:100px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                            <span>USDT</span>
                        </div>
                    </div>

                    <!-- ACCOUNT RISK -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">🛡️ Quản lý rủi ro tài khoản</h4>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="bc-v11-account-risk" ${settings.accountRiskEnabled ? 'checked' : ''}>
                            <label for="bc-v11-account-risk" style="font-size: 11px;">Dừng bot nếu lỗ &gt;</label>
                            <input id="bc-v11-account-risk-percent" type="number" value="${settings.accountRiskPercent}" step="1" style="width:70px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                            <span>% tài khoản</span>
                        </div>
                    </div>

                    <!-- MTF -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">📊 Bộ lọc đa khung (MTF)</h4>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="bc-v11-mtf" ${settings.mtfEnabled ? 'checked' : ''}>
                            <label for="bc-v11-mtf" style="font-size: 11px;">Kích hoạt</label>
                            <select id="bc-v11-mtf-timeframe" style="padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                                <option value="5m" ${settings.mtfTimeframe === '5m' ? 'selected' : ''}>5 phút</option>
                                <option value="15m" ${settings.mtfTimeframe === '15m' ? 'selected' : ''}>15 phút</option>
                                <option value="1h" ${settings.mtfTimeframe === '1h' ? 'selected' : ''}>1 giờ</option>
                            </select>
                        </div>
                    </div>

                    <!-- PARTIAL TP -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">✂️ Chốt lời từng phần</h4>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <input type="checkbox" id="bc-v11-partial-tp" ${settings.partialTPEnabled ? 'checked' : ''}>
                            <label for="bc-v11-partial-tp" style="font-size: 11px;">Kích hoạt</label>
                            <label>Chốt khi đạt</label>
                            <input id="bc-v11-partial-tp-percent" type="number" value="${settings.partialTPPercent}" step="1" style="width:60px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                            <span>% mục tiêu</span>
                            <label>Đóng</label>
                            <input id="bc-v11-partial-close-percent" type="number" value="${settings.partialTPClosePercent}" step="1" style="width:60px; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                            <span>% vị thế</span>
                        </div>
                    </div>

                    <!-- MULTI-PROFILE -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">💾 Profile</h4>
                        <div style="display: flex; gap: 5px;">
                            <select id="bc-v11-profile-select" style="flex:1; padding:4px; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#e2e8f0; font-size:11px;">
                                <option value="default">Default</option>
                            </select>
                            <button id="bc-v11-profile-save" style="background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px;">Lưu</button>
                            <button id="bc-v11-profile-load" style="background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px;">Tải</button>
                            <button id="bc-v11-profile-delete" style="background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px;">Xóa</button>
                        </div>
                    </div>

                    <!-- EXPORT CSV -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">📤 Xuất dữ liệu</h4>
                        <button id="bc-v11-export-csv" style="background:#334155; border:none; color:white; padding:6px 12px; border-radius:4px; font-size:11px;">Xuất CSV</button>
                    </div>
                </div>
            </div>

            <!-- TAB LỊCH SỬ -->
            <div id="bc-v11-tab-history" class="bc-v11-tab-content">
                <div id="bc-v11-history-list" style="max-height:200px; overflow-y:auto; font-size:11px;"></div>
                <button id="bc-v11-clear-history" style="margin-top:8px; background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px;">Xóa</button>
            </div>

            <!-- TAB HỖ TRỢ -->
            <div id="bc-v11-tab-help" class="bc-v11-tab-content">
                <p style="font-size:12px; color:#94a3b8;">Hỗ trợ: @your_telegram</p>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // ---------- DOM ----------
    const amountInput = document.getElementById('bc-v11-amount');
    const leverageSlider = document.getElementById('bc-v11-leverage-slider');
    const leverageVal = document.getElementById('bc-v11-leverage-val');
    const delaySlider = document.getElementById('bc-v11-delay-slider');
    const delayVal = document.getElementById('bc-v11-delay-val');
    const tpInput = document.getElementById('bc-v11-tp');
    const slInput = document.getElementById('bc-v11-sl');
    const btnLong = document.getElementById('bc-v11-long');
    const btnShort = document.getElementById('bc-v11-short');
    const autoCheck = document.getElementById('bc-v11-auto');
    const strategySelect = document.getElementById('bc-v11-strategy');
    const symbolSelect = document.getElementById('bc-v11-symbol');
    const refreshCoinsBtn = document.getElementById('bc-v11-refresh-coins');
    const antiDetectCheck = document.getElementById('bc-v11-anti-detect');
    const reverseCheck = document.getElementById('bc-v11-reverse');
    const soundCheck = document.getElementById('bc-v11-sound');
    const statusDiv = document.getElementById('bc-v11-status');
    const liveStatusDiv = document.getElementById('bc-v11-live-status');
    const balanceSpan = document.getElementById('bc-v11-balance');
    const totalPnlSpan = document.getElementById('bc-v11-total-pnl');
    const panel = document.getElementById('bc-v11-panel');
    const countdownDiv = document.getElementById('bc-v11-countdown');
    const delayEnabledCheck = document.getElementById('bc-v11-delay-enabled');

    // Cài đặt nâng cao
    const trailingCheck = document.getElementById('bc-v11-trailing');
    const trailingPercentInput = document.getElementById('bc-v11-trailing-percent');
    const martingaleCheck = document.getElementById('bc-v11-martingale');
    const martingaleMultInput = document.getElementById('bc-v11-martingale-mult');
    const martingaleStepsInput = document.getElementById('bc-v11-martingale-steps');
    const priceAlertCheck = document.getElementById('bc-v11-price-alert');
    const priceAlertValueInput = document.getElementById('bc-v11-price-alert-value');
    const accountRiskCheck = document.getElementById('bc-v11-account-risk');
    const accountRiskPercentInput = document.getElementById('bc-v11-account-risk-percent');
    const mtfCheck = document.getElementById('bc-v11-mtf');
    const mtfTimeframeSelect = document.getElementById('bc-v11-mtf-timeframe');
    const partialTPCheck = document.getElementById('bc-v11-partial-tp');
    const partialTPPercentInput = document.getElementById('bc-v11-partial-tp-percent');
    const partialClosePercentInput = document.getElementById('bc-v11-partial-close-percent');
    const profileSelect = document.getElementById('bc-v11-profile-select');
    const profileSaveBtn = document.getElementById('bc-v11-profile-save');
    const profileLoadBtn = document.getElementById('bc-v11-profile-load');
    const profileDeleteBtn = document.getElementById('bc-v11-profile-delete');
    const exportCsvBtn = document.getElementById('bc-v11-export-csv');

    // Khởi tạo giá trị
    amountInput.value = formatVND(settings.amountVND);
    leverageSlider.value = settings.leverage; leverageVal.textContent = settings.leverage + 'x';
    delaySlider.value = settings.delaySeconds; delayVal.textContent = settings.delaySeconds + 's';
    tpInput.value = formatVND(settings.takeProfitVND);
    slInput.value = formatVND(settings.stopLossVND);
    autoCheck.checked = settings.autoTrade;
    strategySelect.value = settings.strategy;
    antiDetectCheck.checked = settings.antiDetection;
    reverseCheck.checked = settings.reverseTrade;
    soundCheck.checked = settings.soundEnabled;
    delayEnabledCheck.checked = settings.delayEnabled;
    trailingCheck.checked = settings.trailingStop;
    trailingPercentInput.value = settings.trailingPercent;
    martingaleCheck.checked = settings.martingaleEnabled;
    martingaleMultInput.value = settings.martingaleMultiplier;
    martingaleStepsInput.value = settings.martingaleMaxSteps;
    priceAlertCheck.checked = settings.priceAlertEnabled;
    priceAlertValueInput.value = settings.priceAlertValue;
    accountRiskCheck.checked = settings.accountRiskEnabled;
    accountRiskPercentInput.value = settings.accountRiskPercent;
    mtfCheck.checked = settings.mtfEnabled;
    mtfTimeframeSelect.value = settings.mtfTimeframe;
    partialTPCheck.checked = settings.partialTPEnabled;
    partialTPPercentInput.value = settings.partialTPPercent;
    partialClosePercentInput.value = settings.partialTPClosePercent;

    // Toggle ẩn/hiện slider delay
    const delaySliderContainer = document.getElementById('bc-v11-delay-slider-container');
    if (delaySliderContainer) delaySliderContainer.style.display = settings.delayEnabled ? 'block' : 'none';

    delayEnabledCheck.addEventListener('change', () => {
        if (delaySliderContainer) delaySliderContainer.style.display = delayEnabledCheck.checked ? 'block' : 'none';
        saveSettings();
    });

    // Cập nhật slider hiển thị
    leverageSlider.addEventListener('input', () => { leverageVal.textContent = leverageSlider.value + 'x'; saveSettings(); });
    delaySlider.addEventListener('input', () => { delayVal.textContent = delaySlider.value + 's'; saveSettings(); });

    // ---------- QUẢN LÝ COIN ----------
    let coinList = [];
    function scanCoins() {
        coinList = [];
        const items = document.querySelectorAll('[id^="symbols-list-no-"]');
        items.forEach(item => {
            const id = item.id.replace('symbols-list-no-', '');
            if (id.includes('/USD')) {
                const symbol = id.replace('/USD', '') + 'USDT';
                const nameEl = item.querySelector('.truncate');
                const priceEl = item.querySelector('.flex-1');
                if (nameEl && priceEl) {
                    coinList.push({ symbol, name: nameEl.textContent.trim(), price: parseNumber(priceEl.textContent), element: item });
                }
            }
        });
        coinList.sort((a,b) => a.name.localeCompare(b.name));
        updateDropdown();
    }

    function updateDropdown() {
        symbolSelect.innerHTML = '';
        if (coinList.length === 0) return;
        coinList.forEach(coin => {
            const opt = document.createElement('option');
            opt.value = coin.symbol;
            opt.textContent = `${coin.name}/USDT`;
            if (coin.symbol === settings.selectedSymbol) opt.selected = true;
            symbolSelect.appendChild(opt);
        });
        if (!coinList.find(c => c.symbol === settings.selectedSymbol) && coinList.length > 0) {
            symbolSelect.value = coinList[0].symbol;
            settings.selectedSymbol = coinList[0].symbol;
            GM_setValue('bc_v11_settings', settings);
        }
    }

    function openCoinPopupAndScan() {
        const trigger = document.getElementById('trading-pair-trigger');
        if (trigger) {
            trigger.click();
            setTimeout(scanCoins, 500);
        } else {
            scanCoins();
        }
    }

    symbolSelect.addEventListener('change', () => {
        const selected = symbolSelect.value;
        if (selected) {
            const coin = coinList.find(c => c.symbol === selected);
            if (coin && coin.element) {
                coin.element.click();
                setTimeout(() => document.body.click(), 200);
            }
            settings.selectedSymbol = selected;
            GM_setValue('bc_v11_settings', settings);
            runFullAnalysis();
        }
    });

    refreshCoinsBtn.addEventListener('click', openCoinPopupAndScan);
    setTimeout(openCoinPopupAndScan, 2000);

    // ---------- THU THẬP GIÁ ----------
    function getCurrentPrice() {
        const el = document.querySelector('#trading-pair [class*="text-down"] span, #trading-pair [class*="text-up"] span');
        return el ? parseNumber(el.textContent) : null;
    }

    function collectPrice() {
        const price = getCurrentPrice();
        if (price && (priceHistory.length === 0 || priceHistory[priceHistory.length-1].price !== price)) {
            priceHistory.push({ time: Date.now(), price });
            if (priceHistory.length > MAX_HISTORY) priceHistory = priceHistory.slice(-MAX_HISTORY);
        }
    }
    setInterval(collectPrice, 1000);
    collectPrice();

    function getPriceCloses() {
        return priceHistory.map(p => p.price);
    }

    // ---------- HÀM WEBSITE ----------
    function getLeverageInput() {
        const container = document.getElementById('leverage-input');
        return container ? container.querySelector('input[type="text"]') : null;
    }

    function getAmountInputEl() {
        const container = document.getElementById('available-balance-input');
        return container ? container.querySelector('input[type="text"]') : null;
    }

    function clickTab(tabName) {
        const tabs = document.querySelectorAll('[role="tab"]');
        for (let tab of tabs) {
            if (tab.textContent.trim() === tabName) {
                tab.click();
                return true;
            }
        }
        return false;
    }

    function setReactValue(input, value) {
        if (!input) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function ensureTPSLChecked() {
        const cb = document.querySelector('[role="checkbox"][aria-checked]');
        if (cb && cb.getAttribute('aria-checked') !== 'true') cb.click();
    }

    function getPnLInputs() {
        const inputs = document.querySelectorAll('input[placeholder="Lợi nhuận"]');
        if (inputs.length >= 2) {
            let tpInp = null, slInp = null;
            for (let inp of inputs) {
                const parent = inp.closest('.detrade-input');
                if (parent) {
                    if (parent.classList.contains('text-up')) tpInp = inp;
                    else if (parent.classList.contains('text-down')) slInp = inp;
                }
            }
            if (!tpInp) tpInp = inputs[0];
            if (!slInp) slInp = inputs[1];
            return [tpInp, slInp];
        }
        return [null, null];
    }

    function clickMainButton(side) {
        const container = document.getElementById('future-bet-button');
        if (!container) return;
        const buttons = container.querySelectorAll('button');
        const text = side === 'buy' ? 'mua' : 'bán';
        for (let btn of buttons) {
            if (btn.textContent.trim().toLowerCase().includes(text)) {
                btn.click();
                return;
            }
        }
    }

    // ========== ANTI-DETECTION MODULE ==========
    function humanDelay(min, max) {
        return new Promise(resolve => {
            const delay = antiDetectCheck.checked ? Math.floor(Math.random() * (max - min + 1) + min) : 0;
            setTimeout(resolve, delay);
        });
    }

    async function humanClick(element) {
        if (!element) return;
        if (antiDetectCheck.checked) {
            await humanDelay(50, 150);
            const rect = element.getBoundingClientRect();
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height;
            element.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
            await humanDelay(20, 80);
            element.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
            element.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
        } else {
            element.click();
        }
    }

    // ========== ĐẶT LỆNH ==========
    async function placeOrderWithDelay(side, amountVND, leverage, tpVND, slVND, delaySec) {
        if (delaySec > 0) {
            liveStatusDiv.textContent = `⏳ Chờ ${delaySec}s trước khi đặt lệnh...`;
            await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
        }

        const levInput = getLeverageInput();
        if (!levInput) return false;
        setReactValue(levInput, leverage.toString());
        await humanDelay(100, 200);

        const amtInput = getAmountInputEl();
        if (!amtInput) return false;
        setReactValue(amtInput, formatVND(amountVND));
        await humanDelay(100, 200);

        ensureTPSLChecked();
        await humanDelay(50, 100);
        clickTab('TP/SL');
        await humanDelay(100, 200);

        const [tpPnL, slPnL] = getPnLInputs();
        if (tpPnL) setReactValue(tpPnL, formatVND(tpVND));
        if (slPnL) setReactValue(slPnL, formatVND(slVND));
        await humanDelay(100, 200);

        const buttons = document.querySelectorAll('#future-bet-button button');
        let targetButton = null;
        const text = side === 'buy' ? 'mua' : 'bán';
        for (let btn of buttons) {
            if (btn.textContent.trim().toLowerCase().includes(text)) {
                targetButton = btn;
                break;
            }
        }
        if (targetButton) {
            await humanClick(targetButton);
            return true;
        }
        return false;
    }

    // ========== ERROR POPUP ==========
    function checkForErrorPopup() {
        const errorKeywords = ['Unauthorized', 'Balance not enough', 'Insufficient', 'Error'];
        const errorDivs = document.querySelectorAll('div');
        for (let div of errorDivs) {
            if ((div.classList.contains('bg-black/75') || div.classList.contains('bg-black\\/75'))) {
                for (let keyword of errorKeywords) {
                    if (div.textContent.includes(keyword)) return keyword;
                }
            }
        }
        const fixedContainer = document.querySelector('.fixed.z-max');
        if (fixedContainer) {
            for (let keyword of errorKeywords) {
                if (fixedContainer.textContent.includes(keyword)) return keyword;
            }
        }
        return null;
    }

    function closeErrorPopup() {
        const popups = document.querySelectorAll('.bg-black\\/75, .bg-black/75');
        popups.forEach(popup => {
            if (popup.textContent.includes('Unauthorized') ||
                popup.textContent.includes('Balance not enough') ||
                popup.textContent.includes('Insufficient') ||
                popup.textContent.includes('Error')) {
                const closeBtn = popup.querySelector('svg, button, [class*="cursor-pointer"]');
                if (closeBtn) closeBtn.click();
                else popup.click();
            }
        });
    }
        // ========== TRAILING STOP ==========
    async function modifySL(newSLPrice) {
        clickTab('TP/SL');
        await humanDelay(200, 300);
        const slInputs = document.querySelectorAll('input[placeholder="Giá"]');
        if (slInputs.length >= 2) {
            setReactValue(slInputs[1], newSLPrice.toFixed(2));
            slInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        return false;
    }

    function startTrailing(position) {
        if (trailingInterval) clearInterval(trailingInterval);
        trailingInterval = setInterval(async () => {
            const currentPrice = getCurrentPrice();
            if (!currentPrice || !position) return;

            let newSL = position.slPrice;
            const trailingPct = parseFloat(trailingPercentInput.value) || 2;

            if (position.side === 'buy') {
                const potentialSL = currentPrice * (1 - trailingPct / 100);
                if (potentialSL > position.slPrice) newSL = potentialSL;
            } else if (position.side === 'sell') {
                const potentialSL = currentPrice * (1 + trailingPct / 100);
                if (potentialSL < position.slPrice) newSL = potentialSL;
            }

            if (newSL !== position.slPrice) {
                const success = await modifySL(newSL);
                if (success) {
                    position.slPrice = newSL;
                    liveStatusDiv.textContent = `🔁 Trailing SL cập nhật: ${newSL.toFixed(2)}`;
                }
            }

            if ((position.side === 'buy' && (currentPrice >= position.tpPrice || currentPrice <= position.slPrice)) ||
                (position.side === 'sell' && (currentPrice <= position.tpPrice || currentPrice >= position.slPrice))) {
                stopTrailing();
            }
        }, 2000);
    }

    function stopTrailing() {
        if (trailingInterval) {
            clearInterval(trailingInterval);
            trailingInterval = null;
        }
        currentPosition = null;
        liveStatusDiv.textContent = '⏹️ Trailing dừng';
    }

    // ========== CHỈ BÁO KỸ THUẬT ==========
    function calculateEMA(data, period) {
        if (data.length < period) return null;
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
        return ema;
    }

    function calculateRSI(closes, period = 14) {
        if (closes.length < period + 1) return null;
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return 100 - (100 / (1 + rs));
    }

    function calculateBollinger(closes, period = 20, multiplier = 2) {
        if (closes.length < period) return null;
        const slice = closes.slice(-period);
        const mean = slice.reduce((a,b) => a + b, 0) / period;
        const variance = slice.reduce((s,v) => s + Math.pow(v - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        return { upper: mean + multiplier * std, lower: mean - multiplier * std, mid: mean };
    }

    function getSignal(strategy, closes) {
        if (closes.length < 20) return 'hold';
        switch (strategy) {
            case 'trendFollow': {
                const ema12 = calculateEMA(closes, 12);
                const ema26 = calculateEMA(closes, 26);
                const prevCloses = closes.slice(0, -1);
                const prevEma12 = calculateEMA(prevCloses, 12);
                const prevEma26 = calculateEMA(prevCloses, 26);
                if (prevEma12 <= prevEma26 && ema12 > ema26) return 'buy';
                if (prevEma12 >= prevEma26 && ema12 < ema26) return 'sell';
                return 'hold';
            }
            case 'rsi': {
                const rsi = calculateRSI(closes, 14);
                if (rsi === null) return 'hold';
                if (rsi < 35) return 'buy';
                if (rsi > 65) return 'sell';
                return 'hold';
            }
            case 'bb': {
                const bb = calculateBollinger(closes, 20, 2);
                if (!bb) return 'hold';
                const last = closes[closes.length-1];
                if (last <= bb.lower * 1.005) return 'buy';
                if (last >= bb.upper * 0.995) return 'sell';
                return 'hold';
            }
            case 'macd': {
                if (closes.length < 35) return 'hold';
                const macdArr = [];
                for (let i = 25; i < closes.length; i++) {
                    const emaF = calculateEMA(closes.slice(0, i+1), 12);
                    const emaS = calculateEMA(closes.slice(0, i+1), 26);
                    macdArr.push(emaF - emaS);
                }
                if (macdArr.length < 9) return 'hold';
                const signalArr = [];
                for (let i = 0; i < macdArr.length; i++) {
                    if (i < 8) { signalArr.push(null); continue; }
                    signalArr.push(calculateEMA(macdArr.slice(0, i+1), 9));
                }
                const lastMacd = macdArr[macdArr.length-1];
                const lastSignal = signalArr[signalArr.length-1];
                const prevMacd = macdArr[macdArr.length-2];
                const prevSignal = signalArr[signalArr.length-2];
                if (prevMacd && prevSignal && prevMacd <= prevSignal && lastMacd > lastSignal) return 'buy';
                if (prevMacd && prevSignal && prevMacd >= prevSignal && lastMacd < lastSignal) return 'sell';
                return 'hold';
            }
            case 'combined': {
                let score = 0;
                const rsi = calculateRSI(closes, 14);
                if (rsi !== null) {
                    if (rsi < 30) score += 2;
                    else if (rsi < 40) score += 1;
                    else if (rsi > 70) score -= 2;
                    else if (rsi > 60) score -= 1;
                }
                const bb = calculateBollinger(closes);
                if (bb) {
                    const last = closes[closes.length-1];
                    if (last <= bb.lower) score += 2;
                    else if (last >= bb.upper) score -= 2;
                }
                const macdSig = getSignal('macd', closes);
                if (macdSig === 'buy') score += 2;
                else if (macdSig === 'sell') score -= 2;
                const emaSig = getSignal('trendFollow', closes);
                if (emaSig === 'buy') score += 1;
                else if (emaSig === 'sell') score -= 1;
                if (score >= 3) return 'buy';
                if (score <= -3) return 'sell';
                return 'hold';
            }
            case 'scalping': {
                if (closes.length < 5) return 'hold';
                const last = closes[closes.length-1];
                const prev = closes[closes.length-5];
                const change = (last - prev) / prev;
                if (change > 0.002) return 'buy';
                if (change < -0.002) return 'sell';
                return 'hold';
            }
            default: return 'hold';
        }
    }

    // ========== PHÂN TÍCH LIVE ==========
    async function runFullAnalysis() {
        const symbol = settings.selectedSymbol;
        document.getElementById('bc-v11-analysis-symbol').textContent = symbol.replace('USDT','') + '/USDT';
        let closes = [];
        let source = 'Web';
        if (BINANCE_PAIRS.includes(symbol)) {
            try {
                const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`;
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    closes = data.map(c => parseFloat(c[4]));
                    source = 'Binance';
                }
            } catch(e) {}
        }
        if (closes.length < 50) {
            closes = getPriceCloses();
            source = 'Web (live)';
        }

        document.getElementById('bc-v11-analysis-source').textContent = source;
        document.getElementById('bc-v11-analysis-price').textContent = closes.length > 0 ? closes[closes.length-1].toFixed(2) : '--';

        const rsi = calculateRSI(closes, 14);
        const ema12 = calculateEMA(closes, 12);
        const ema26 = calculateEMA(closes, 26);
        const bb = calculateBollinger(closes);
        const macdLine = (() => {
            if (closes.length < 26) return null;
            return calculateEMA(closes, 12) - calculateEMA(closes, 26);
        })();
        const signalLine = (() => {
            if (closes.length < 35) return null;
            const macdArr = [];
            for (let i = 25; i < closes.length; i++) {
                macdArr.push(calculateEMA(closes.slice(0,i+1), 12) - calculateEMA(closes.slice(0,i+1), 26));
            }
            return calculateEMA(macdArr, 9);
        })();

        document.getElementById('bc-v11-rsi-val').textContent = rsi?.toFixed(1) || '--';
        document.getElementById('bc-v11-rsi-sig').textContent = rsi ? (rsi < 35 ? '🟢 Quá bán' : (rsi > 65 ? '🔴 Quá mua' : '⚪ Trung tính')) : '';
        document.getElementById('bc-v11-ema-val').textContent = ema12 && ema26 ? `${ema12.toFixed(2)} / ${ema26.toFixed(2)}` : '--';
        document.getElementById('bc-v11-ema-sig').textContent = ema12 && ema26 ? (ema12 > ema26 ? '🟢 EMA12 > EMA26' : '🔴 EMA12 < EMA26') : '';
        document.getElementById('bc-v11-macd-val').textContent = macdLine && signalLine ? `${macdLine.toFixed(4)} / ${signalLine.toFixed(4)}` : '--';
        document.getElementById('bc-v11-macd-sig').textContent = macdLine && signalLine ? (macdLine > signalLine ? '🟢 MACD > Signal' : '🔴 MACD < Signal') : '';
        document.getElementById('bc-v11-bb-val').textContent = bb ? `${bb.lower.toFixed(2)} - ${bb.upper.toFixed(2)}` : '--';
        document.getElementById('bc-v11-bb-sig').textContent = bb ? (closes[closes.length-1] <= bb.lower ? '🟢 Chạm dải dưới' : (closes[closes.length-1] >= bb.upper ? '🔴 Chạm dải trên' : '⚪ Trong dải')) : '';

        const signals = [ getSignal('rsi', closes), getSignal('trendFollow', closes), getSignal('bb', closes), getSignal('macd', closes) ];
        let buyVotes = 0, sellVotes = 0;
        signals.forEach(s => { if (s === 'buy') buyVotes++; else if (s === 'sell') sellVotes++; });
        let recommendation, scorePercent;
        if (buyVotes > sellVotes && buyVotes >= 2) { recommendation = '🟢 MUA'; scorePercent = 60 + buyVotes * 10; }
        else if (sellVotes > buyVotes && sellVotes >= 2) { recommendation = '🔴 BÁN'; scorePercent = 40 - sellVotes * 10; }
        else { recommendation = '⚪ TRUNG LẬP'; scorePercent = 50; }
        document.getElementById('bc-v11-recommendation').textContent = recommendation;
        document.getElementById('bc-v11-score-bar').style.width = `${scorePercent}%`;
        document.getElementById('bc-v11-score-bar').style.background = scorePercent > 60 ? '#10b981' : (scorePercent < 40 ? '#ef4444' : '#f59e0b');
        document.getElementById('bc-v11-debug-info').textContent = `Số phiếu Mua: ${buyVotes}, Bán: ${sellVotes}`;
    }

    function startAnalysisLive() {
        if (analysisLiveInterval) clearInterval(analysisLiveInterval);
        runFullAnalysis();
        analysisLiveInterval = setInterval(runFullAnalysis, 5000);
    }
    function stopAnalysisLive() {
        if (analysisLiveInterval) { clearInterval(analysisLiveInterval); analysisLiveInterval = null; }
    }

    // ========== COUNTDOWN TIMER ==========
    function startCountdown(seconds) {
        countdownSeconds = seconds;
        if (countdownTimer) clearInterval(countdownTimer);
        updateCountdownDisplay();
        countdownTimer = setInterval(() => {
            countdownSeconds--;
            if (countdownSeconds <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                countdownDiv.textContent = '';
                return;
            }
            updateCountdownDisplay();
        }, 1000);
    }

    function updateCountdownDisplay() {
        const mins = Math.floor(countdownSeconds / 60);
        const secs = countdownSeconds % 60;
        countdownDiv.textContent = `⏱️ Lần kiểm tra tiếp theo: ${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ========== MTF HELPER ==========
    async function getMTFTrend(symbol, timeframe) {
        if (!BINANCE_PAIRS.includes(symbol)) return null;
        try {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=100`;
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const data = await resp.json();
            const closes = data.map(c => parseFloat(c[4]));
            if (closes.length < 50) return null;
            const ema12 = calculateEMA(closes, 12);
            const ema26 = calculateEMA(closes, 26);
            if (!ema12 || !ema26) return null;
            return ema12 > ema26 ? 'up' : 'down';
        } catch(e) {
            return null;
        }
    }

    // ========== PARTIAL TP ==========
    async function executePartialClose(closePercent) {
        const positionTab = Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Vị thế'));
        if (positionTab) positionTab.click();
        await humanDelay(300, 500);
        const halfBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '1/2');
        if (halfBtn) {
            halfBtn.click();
            await humanDelay(200, 300);
            const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Đóng' || b.textContent.trim().toLowerCase() === 'close');
            if (closeBtn) closeBtn.click();
        } else {
            console.log('Partial TP: không tìm thấy nút 1/2');
        }
    }

    function startPartialTPMonitor(position) {
        if (partialTPInterval) clearInterval(partialTPInterval);
        partialTPInterval = setInterval(async () => {
            if (!partialTPCheck.checked || !position) return;
            const currentPrice = getCurrentPrice();
            if (!currentPrice) return;
            const targetPrice = position.tpPrice;
            const entryPrice = position.entryPrice;
            const side = position.side;
            const tpPercent = parseFloat(partialTPPercentInput.value) || 50;
            const closePercent = parseFloat(partialClosePercentInput.value) || 50;

            let progress = 0;
            if (side === 'buy') {
                if (targetPrice <= entryPrice) { clearInterval(partialTPInterval); partialTPInterval = null; return; }
                progress = ((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100;
            } else {
                if (targetPrice >= entryPrice) { clearInterval(partialTPInterval); partialTPInterval = null; return; }
                progress = ((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100;
            }

            if (progress >= tpPercent) {
                liveStatusDiv.textContent = `✂️ Chốt ${closePercent}% vị thế (đạt ${progress.toFixed(0)}% TP)`;
                await executePartialClose(closePercent);
                clearInterval(partialTPInterval);
                partialTPInterval = null;
            }
        }, 2000);
    }

    // ========== EXECUTE TRADE ==========
    async function executeTrade(side) {
        const price = getCurrentPrice();
        if (!price) { statusDiv.textContent = '❌ Không lấy được giá'; return; }

        // Kiểm tra Account Risk
        if (accountRiskCheck.checked) {
            const currentBalanceText = balanceSpan.textContent.replace(/[^0-9]/g, '');
            const currentBalance = parseInt(currentBalanceText);
            if (!isNaN(currentBalance) && initialBalance) {
                const lossPercent = ((initialBalance - currentBalance) / initialBalance) * 100;
                if (lossPercent >= parseFloat(accountRiskPercentInput.value)) {
                    statusDiv.textContent = `🛑 Dừng bot: lỗ ${lossPercent.toFixed(1)}% tài khoản`;
                    if (autoCheck.checked) {
                        autoCheck.checked = false;
                        stopAuto();
                    }
                    return;
                }
            }
        }

        // MTF Filter
        let actualSide = side;
        if (reverseCheck.checked) actualSide = side === 'buy' ? 'sell' : 'buy';

        if (mtfCheck.checked) {
            const mtfTrend = await getMTFTrend(settings.selectedSymbol, mtfTimeframeSelect.value);
            if (mtfTrend === 'up' && actualSide !== 'buy') {
                statusDiv.textContent = '⛔ MTF: Xu hướng lớn tăng, không vào Short';
                return;
            } else if (mtfTrend === 'down' && actualSide !== 'sell') {
                statusDiv.textContent = '⛔ MTF: Xu hướng lớn giảm, không vào Long';
                return;
            } else if (!mtfTrend) {
                statusDiv.textContent = '⚠️ MTF: Không lấy được dữ liệu khung lớn';
            }
        }

        // Martingale
        let adjustedAmountVND = parseNumber(amountInput.value);
        if (martingaleCheck.checked) {
            const history = GM_getValue('bc_v11_history', []);
            if (history.length > 0) {
                const lastTrade = history[0];
                const martingaleMult = parseFloat(martingaleMultInput.value) || 2;
                const maxSteps = parseInt(martingaleStepsInput.value) || 3;
                if (lastTrade.status === 'THẤT BẠI') {
                    consecutiveLosses++;
                    consecutiveWins = 0;
                    if (consecutiveLosses <= maxSteps) {
                        adjustedAmountVND = parseNumber(amountInput.value) * Math.pow(martingaleMult, consecutiveLosses);
                    } else {
                        consecutiveLosses = 0;
                    }
                } else {
                    consecutiveWins++;
                    consecutiveLosses = 0;
                    adjustedAmountVND = parseNumber(amountInput.value);
                }
            }
        }

        const leverage = parseInt(leverageSlider.value);
        const tpVND = parseNumber(tpInput.value);
        const slVND = parseNumber(slInput.value);
        const delaySec = delayEnabledCheck.checked ? parseInt(delaySlider.value) : 0;

        if (isNaN(adjustedAmountVND) || adjustedAmountVND <= 0) {
            statusDiv.textContent = '❌ Số ký quỹ không hợp lệ';
            return;
        }

        statusDiv.textContent = `⏳ Sẽ đặt lệnh ${actualSide.toUpperCase()} sau ${delaySec}s...`;
        const ok = await placeOrderWithDelay(actualSide, adjustedAmountVND, leverage, tpVND, slVND, delaySec);
        if (!ok) {
            statusDiv.textContent = '❌ Không thể điền form';
            return;
        }

        // Âm thanh
        if (soundCheck.checked) {
            try {
                new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2qEcP+1j2OIMDOAqdDtqGqEbgD9lWNfKjA5hq3S66d0fW8C8YBXZkI4Moiv0uuqZn1yAPx8aV4vKjOIqtXtr2Z3cAD4fGhbMD1AjarM7L1kX2EA94lnUCspNoSqzuu2Z3NjAPeJYEsyMUGJpMfnsmxZTADohlw9KSgyhqTC47ZwYlMA6H1XRSsnMoSnweO4amJSANhzXz4tHi6EprvitnBiWwDVaVlBKSAwhKO75Lxxa1sAyWFUPy0hK4KisuO/bGhdAMhbVj4rICeBm7bjwGJiXQDBX2E/JyEph6C/38NQWF4AuWJePSgkKoGiuuPBTVtsAKtmWjgqISOBmrfkyk5iYADDa1U8JyMphaO74MZTXFsAumhjPCglI4GXvObIXV1kALlxXD8sIyqEnr3gz1ZfYADDcVs7LSQhhpjC4MxgYWAAvHZeQCsjJoSWwuDLYmNjALlzX0MrIyWDmMPhz2ZlYwC5dWBFLCQihJbE4M9pZWUAuHVhRy0kIYSYxODQa2ZlALd2Y0kuJCOFmcbh0G5naAC4eGRLLyQjhprG4dJvaGoAtntmTjAlJIacyOLSbmprALZ7aE8zJiWHnszl0nBubQC1fmxROCsniKDO5dNycnAAtoBtVDwuK4mj0ObVdHRzALeFcVZALS2KpdLn1nh5eQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').play();
            } catch(e) {}
        }

        setTimeout(() => {
            const errorType = checkForErrorPopup();
            const isError = errorType !== null;
            const status = isError ? 'THẤT BẠI' : 'Thành công';
            const msg = isError ? `❌ ${actualSide.toUpperCase()} thất bại (${errorType})` : `✅ ${actualSide.toUpperCase()} | TP: +${formatVND(tpVND)} | SL: -${formatVND(slVND)}`;
            statusDiv.textContent = msg;
            const history = GM_getValue('bc_v11_history', []);
            history.unshift({ time: new Date().toISOString(), side: actualSide, price, amountVND: adjustedAmountVND, leverage, tpVND, slVND, symbol: settings.selectedSymbol, status, errorType: errorType || '' });
            if (history.length > 50) history.pop();
            GM_setValue('bc_v11_history', history);
            if (isError) closeErrorPopup();

            // Trailing + Partial TP
            if (!isError) {
                if (trailingCheck.checked) {
                    const slPrice = actualSide === 'buy' ? price * (1 - (slVND / (adjustedAmountVND * leverage)) * 100 / 100) : price * (1 + (slVND / (adjustedAmountVND * leverage)) * 100 / 100);
                    const tpPrice = actualSide === 'buy' ? price * (1 + (tpVND / (adjustedAmountVND * leverage)) * 100 / 100) : price * (1 - (tpVND / (adjustedAmountVND * leverage)) * 100 / 100);
                    currentPosition = { side: actualSide, entryPrice: price, slPrice, tpPrice, trailingActive: true };
                    startTrailing(currentPosition);
                }
                if (partialTPCheck.checked) {
                    const slPrice = actualSide === 'buy' ? price * (1 - (slVND / (adjustedAmountVND * leverage)) * 100 / 100) : price * (1 + (slVND / (adjustedAmountVND * leverage)) * 100 / 100);
                    const tpPrice = actualSide === 'buy' ? price * (1 + (tpVND / (adjustedAmountVND * leverage)) * 100 / 100) : price * (1 - (tpVND / (adjustedAmountVND * leverage)) * 100 / 100);
                    currentPosition = { side: actualSide, entryPrice: price, slPrice, tpPrice };
                    startPartialTPMonitor(currentPosition);
                }
            }
        }, 2500);
    }

    btnLong.addEventListener('click', () => executeTrade('buy'));
    btnShort.addEventListener('click', () => executeTrade('sell'));

    // ========== AUTO TRADE ==========
    async function autoCheckAndTrade() {
        if (!autoCheck.checked) return;
        liveStatusDiv.textContent = '⏳ Đang phân tích...';
        const symbol = settings.selectedSymbol;
        let closes = [];
        if (BINANCE_PAIRS.includes(symbol)) {
            try {
                const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`;
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    closes = data.map(c => parseFloat(c[4]));
                }
            } catch(e) {}
        }
        if (closes.length < 50) closes = getPriceCloses();

        const strategy = strategySelect.value;
        const signal = getSignal(strategy, closes);
        if (signal === 'buy') {
            liveStatusDiv.textContent = '🟢 Tín hiệu MUA – đang đặt lệnh...';
            await executeTrade('buy');
        } else if (signal === 'sell') {
            liveStatusDiv.textContent = '🔴 Tín hiệu BÁN – đang đặt lệnh...';
            await executeTrade('sell');
        } else {
            liveStatusDiv.textContent = '⚪ Không có tín hiệu';
        }
        startCountdown(15);
    }

    function startAuto() {
        if (autoInterval) clearInterval(autoInterval);
        autoInterval = setInterval(autoCheckAndTrade, 15000);
        statusDiv.textContent = '🔄 Auto trade (15s)...';
        liveStatusDiv.textContent = '🔄 Auto đang chạy...';
        autoCheckAndTrade();
    }
    function stopAuto() {
        if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
        statusDiv.textContent = '⏸️ Dừng auto';
        liveStatusDiv.textContent = '⏸️ Đã dừng';
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; countdownDiv.textContent = ''; }
    }
    autoCheck.addEventListener('change', () => {
        saveSettings();
        if (autoCheck.checked) startAuto();
        else stopAuto();
    });
    if (autoCheck.checked) startAuto();

    // ========== PRICE ALERT ==========
    function checkPriceAlert() {
        if (!priceAlertCheck.checked) return;
        const currentPrice = getCurrentPrice();
        const alertValue = parseFloat(priceAlertValueInput.value);
        if (currentPrice && alertValue && Math.abs(currentPrice - alertValue) / alertValue < 0.001) {
            liveStatusDiv.textContent = `🔔 Giá đã chạm ${alertValue}!`;
            if (soundCheck.checked) { try { new Audio('data:audio/wav;base64,...').play(); } catch(e) {} }
        }
    }

    // ========== MULTI-PROFILE ==========
    const PROFILES_KEY = 'bc_v11_profiles';
    function loadProfiles() {
        const profiles = GM_getValue(PROFILES_KEY, null);
        return profiles || { default: DEFAULT_SETTINGS };
    }
    function saveProfile(name) {
        const profiles = loadProfiles();
        const currentSettings = {
            amountVND: parseNumber(amountInput.value),
            leverage: parseInt(leverageSlider.value),
            takeProfitVND: parseNumber(tpInput.value),
            stopLossVND: parseNumber(slInput.value),
            delayEnabled: delayEnabledCheck.checked,
            delaySeconds: parseInt(delaySlider.value),
            antiDetection: antiDetectCheck.checked,
            trailingStop: trailingCheck.checked,
            trailingPercent: parseFloat(trailingPercentInput.value),
            reverseTrade: reverseCheck.checked,
            martingaleEnabled: martingaleCheck.checked,
            martingaleMultiplier: parseFloat(martingaleMultInput.value),
            martingaleMaxSteps: parseInt(martingaleStepsInput.value),
            priceAlertEnabled: priceAlertCheck.checked,
            priceAlertValue: parseFloat(priceAlertValueInput.value),
            soundEnabled: soundCheck.checked,
            strategy: strategySelect.value,
            selectedSymbol: symbolSelect.value,
            accountRiskEnabled: accountRiskCheck.checked,
            accountRiskPercent: parseFloat(accountRiskPercentInput.value),
            mtfEnabled: mtfCheck.checked,
            mtfTimeframe: mtfTimeframeSelect.value,
            partialTPEnabled: partialTPCheck.checked,
            partialTPPercent: parseFloat(partialTPPercentInput.value),
            partialTPClosePercent: parseFloat(partialClosePercentInput.value)
        };
        profiles[name] = currentSettings;
        GM_setValue(PROFILES_KEY, profiles);
        updateProfileList();
    }
    function loadProfile(name) {
        const profiles = loadProfiles();
        const p = profiles[name];
        if (p) {
            amountInput.value = formatVND(p.amountVND);
            leverageSlider.value = p.leverage; leverageVal.textContent = p.leverage + 'x';
            delaySlider.value = p.delaySeconds; delayVal.textContent = p.delaySeconds + 's';
            delayEnabledCheck.checked = p.delayEnabled;
            if (delaySliderContainer) delaySliderContainer.style.display = p.delayEnabled ? 'block' : 'none';
            tpInput.value = formatVND(p.takeProfitVND);
            slInput.value = formatVND(p.stopLossVND);
            antiDetectCheck.checked = p.antiDetection;
            trailingCheck.checked = p.trailingStop;
            trailingPercentInput.value = p.trailingPercent;
            reverseCheck.checked = p.reverseTrade;
            martingaleCheck.checked = p.martingaleEnabled;
            martingaleMultInput.value = p.martingaleMultiplier;
            martingaleStepsInput.value = p.martingaleMaxSteps;
            priceAlertCheck.checked = p.priceAlertEnabled;
            priceAlertValueInput.value = p.priceAlertValue;
            soundCheck.checked = p.soundEnabled;
            strategySelect.value = p.strategy;
            symbolSelect.value = p.selectedSymbol;
            accountRiskCheck.checked = p.accountRiskEnabled;
            accountRiskPercentInput.value = p.accountRiskPercent;
            mtfCheck.checked = p.mtfEnabled;
            mtfTimeframeSelect.value = p.mtfTimeframe;
            partialTPCheck.checked = p.partialTPEnabled;
            partialTPPercentInput.value = p.partialTPPercent;
            partialClosePercentInput.value = p.partialTPClosePercent;
            saveSettings();
        }
    }
    function deleteProfile(name) {
        const profiles = loadProfiles();
        delete profiles[name];
        GM_setValue(PROFILES_KEY, profiles);
        updateProfileList();
    }
    function updateProfileList() {
        const profiles = loadProfiles();
        const names = Object.keys(profiles);
        profileSelect.innerHTML = '';
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            profileSelect.appendChild(opt);
        });
    }
    profileSaveBtn.addEventListener('click', () => {
        const name = prompt('Nhập tên profile:');
        if (name) saveProfile(name);
    });
    profileLoadBtn.addEventListener('click', () => {
        const name = profileSelect.value;
        if (name) loadProfile(name);
    });
    profileDeleteBtn.addEventListener('click', () => {
        const name = profileSelect.value;
        if (name && confirm(`Xóa profile "${name}"?`)) deleteProfile(name);
    });
    updateProfileList();

    // ========== EXPORT CSV ==========
    exportCsvBtn.addEventListener('click', () => {
        const history = GM_getValue('bc_v11_history', []);
        if (!history.length) return alert('Không có giao dịch');
        let csv = 'Thời gian,Bên,Cặp,Giá,Ký quỹ,Đòn bẩy,TP,SL,Trạng thái,Lỗi\n';
        history.forEach(h => {
            csv += `${h.time},${h.side},${h.symbol},${h.price},${h.amountVND},${h.leverage},${h.tpVND},${h.slVND},${h.status},${h.errorType || ''}\n`;
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bc_trade_history.csv';
        a.click();
    });

    // ========== SỐ DƯ & LÃI/LỖ ==========
    function updateBalance() {
        const vndImg = document.querySelector('img[src*="VND.rect"]');
        if (vndImg) {
            const container = vndImg.closest('.flex.flex-auto');
            if (container) {
                const amountEl = container.querySelector('.font-extrabold');
                if (amountEl) {
                    const balanceText = amountEl.textContent.replace(/[^0-9]/g, '');
                    balanceSpan.textContent = parseInt(balanceText).toLocaleString('en-US') + ' ₫';
                }
            }
        }
    }

    function getInitialBalance() {
        if (!initialBalance) {
            const vndImg = document.querySelector('img[src*="VND.rect"]');
            if (vndImg) {
                const container = vndImg.closest('.flex.flex-auto');
                if (container) {
                    const amountEl = container.querySelector('.font-extrabold');
                    if (amountEl) {
                        const balanceText = amountEl.textContent.replace(/[^0-9]/g, '');
                        initialBalance = parseInt(balanceText);
                        GM_setValue('bc_v11_initial_balance', initialBalance);
                    }
                }
            }
        }
        return initialBalance;
    }

    function updateTotalPnL() {
        const currentBalanceText = balanceSpan.textContent.replace(/[^0-9]/g, '');
        const currentBalance = parseInt(currentBalanceText);
        const initBal = getInitialBalance();
        if (!isNaN(currentBalance) && initBal !== null && !isNaN(initBal)) {
            const pnl = currentBalance - initBal;
            const formatted = pnl >= 0 ? `+${formatVND(Math.abs(pnl))}` : `-${formatVND(Math.abs(pnl))}`;
            totalPnlSpan.textContent = `${formatted} ₫`;
            totalPnlSpan.style.color = pnl >= 0 ? '#10b981' : '#ef4444';
        } else {
            totalPnlSpan.textContent = '--';
            totalPnlSpan.style.color = '#94a3b8';
        }
    }

    setInterval(() => {
        updateBalance();
        updateTotalPnL();
        checkPriceAlert();
    }, 5000);
    updateBalance();
    updateTotalPnL();
    setTimeout(() => { getInitialBalance(); updateTotalPnL(); }, 3000);

    // ========== LƯU CÀI ĐẶT ==========
    function saveSettings() {
        settings.amountVND = parseNumber(amountInput.value);
        settings.leverage = parseInt(leverageSlider.value);
        settings.takeProfitVND = parseNumber(tpInput.value);
        settings.stopLossVND = parseNumber(slInput.value);
        settings.autoTrade = autoCheck.checked;
        settings.strategy = strategySelect.value;
        settings.selectedSymbol = symbolSelect.value;
        settings.delayEnabled = delayEnabledCheck.checked;
        settings.delaySeconds = parseInt(delaySlider.value);
        settings.antiDetection = antiDetectCheck.checked;
        settings.trailingStop = trailingCheck.checked;
        settings.trailingPercent = parseFloat(trailingPercentInput.value);
        settings.reverseTrade = reverseCheck.checked;
        settings.martingaleEnabled = martingaleCheck.checked;
        settings.martingaleMultiplier = parseFloat(martingaleMultInput.value);
        settings.martingaleMaxSteps = parseInt(martingaleStepsInput.value);
        settings.priceAlertEnabled = priceAlertCheck.checked;
        settings.priceAlertValue = parseFloat(priceAlertValueInput.value);
        settings.soundEnabled = soundCheck.checked;
        settings.accountRiskEnabled = accountRiskCheck.checked;
        settings.accountRiskPercent = parseFloat(accountRiskPercentInput.value);
        settings.mtfEnabled = mtfCheck.checked;
        settings.mtfTimeframe = mtfTimeframeSelect.value;
        settings.partialTPEnabled = partialTPCheck.checked;
        settings.partialTPPercent = parseFloat(partialTPPercentInput.value);
        settings.partialTPClosePercent = parseFloat(partialClosePercentInput.value);
        GM_setValue('bc_v11_settings', settings);
    }
    [amountInput, leverageSlider, tpInput, slInput, autoCheck, strategySelect, symbolSelect, delayEnabledCheck, delaySlider, antiDetectCheck, trailingCheck, trailingPercentInput, reverseCheck, martingaleCheck, martingaleMultInput, martingaleStepsInput, priceAlertCheck, priceAlertValueInput, soundCheck, accountRiskCheck, accountRiskPercentInput, mtfCheck, mtfTimeframeSelect, partialTPCheck, partialTPPercentInput, partialClosePercentInput].forEach(el => {
        el.addEventListener('change', saveSettings);
        el.addEventListener('input', saveSettings);
    });

    // ========== MENU ==========
    document.querySelectorAll('#bc-v11-panel .bc-v11-menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#bc-v11-panel .bc-v11-menu-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.querySelectorAll('#bc-v11-panel .bc-v11-tab-content').forEach(c => {
                c.classList.remove('active');
                if (c.id === `bc-v11-tab-${tabId}`) c.classList.add('active');
            });
            if (tabId === 'analysis') startAnalysisLive();
            else stopAnalysisLive();
            if (tabId === 'history') renderHistory();
        });
    });

    // ========== KÉO PANEL ==========
    const header = document.getElementById('bc-v11-header');
    let dragging = false, sx, sy, il, it;
    header.addEventListener('mousedown', e => {
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        const r = panel.getBoundingClientRect();
        il = r.left; it = r.top;
        document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        panel.style.left = `${il + e.clientX - sx}px`;
        panel.style.top = `${it + e.clientY - sy}px`;
        panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; document.body.style.userSelect = ''; });

    document.getElementById('bc-v11-toggle').addEventListener('click', () => {
        const body = document.getElementById('bc-v11-body');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? 'block' : 'none';
        document.getElementById('bc-v11-toggle').textContent = hidden ? '−' : '+';
    });

    // ========== LỊCH SỬ ==========
    function renderHistory() {
        const list = document.getElementById('bc-v11-history-list');
        const history = GM_getValue('bc_v11_history', []);
        if (!history.length) { list.innerHTML = '<p style="color:#94a3b8;">Chưa có giao dịch</p>'; return; }
        list.innerHTML = history.map(h => `
            <div style="border-bottom:1px solid #334155; padding:4px 0;">
                <b>${h.side.toUpperCase()}</b> ${h.symbol} @ ${h.price} | Vốn: ${formatVND(h.amountVND)}<br>
                Lãi: +${formatVND(h.tpVND)} | Cắt lỗ: -${formatVND(h.slVND)}<br>
                <small>${new Date(h.time).toLocaleString()} | <span style="color:${h.status === 'THẤT BẠI' ? '#ef4444' : '#10b981'}">${h.status}${h.errorType ? ': ' + h.errorType : ''}</span></small>
            </div>
        `).join('');
    }
    document.getElementById('bc-v11-clear-history').addEventListener('click', () => {
        GM_setValue('bc_v11_history', []);
        renderHistory();
    });

})();