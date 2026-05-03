// ==UserScript==
// @name         BC.GAME Futures Auto Trader v8.1 – Live Analysis Fix
// @namespace    http://tampermonkey.net/
// @version      8.1
// @description  Tab Phân tích tự động live 5s, sửa lỗi Long/Short, tổng lãi/lỗ, Scalping
// @author       Souninjinma
// @match        https://bcmail2.com/vi/trading/contract*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.binance.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ---------- CẤU HÌNH ----------
    const DEFAULT_SETTINGS = {
        amountVND: 25000,
        leverage: 100,
        takeProfitVND: 50000,
        stopLossVND: 25000,
        autoTrade: false,
        strategy: 'trendFollow',
        selectedSymbol: 'BTCUSDT'
    };
    let settings = GM_getValue('bc_v8_settings', DEFAULT_SETTINGS);

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

    // ---------- GIAO DIỆN ----------
    const panelHTML = `
    <div id="bc-v8-panel" style="
        position: fixed; top: 60px; right: 20px; z-index: 99999;
        background: #1e293b; color: #e2e8f0; border-radius: 12px;
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px;
        width: 390px; box-shadow: 0 8px 30px rgba(0,0,0,0.7);
    ">
        <div id="bc-v8-header" style="
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 15px; background: #0f172a; border-radius: 12px 12px 0 0;
            cursor: move;
        ">
            <span style="font-weight: bold; color: #38bdf8;">🤖 Trader v8.1 (Live)</span>
            <span id="bc-v8-toggle" style="cursor: pointer; font-size: 18px;">−</span>
        </div>
        <div id="bc-v8-body" style="padding: 12px 15px;">
            <!-- MENU -->
            <div style="display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap;">
                <button class="bc-v8-menu-btn active" data-tab="trade">📈 Giao dịch</button>
                <button class="bc-v8-menu-btn" data-tab="analysis">🔍 Phân tích</button>
                <button class="bc-v8-menu-btn" data-tab="guide">📖 Hướng dẫn</button>
                <button class="bc-v8-menu-btn" data-tab="history">📜 Lịch sử</button>
                <button class="bc-v8-menu-btn" data-tab="help">❓ Hỗ trợ</button>
            </div>

            <!-- TAB GIAO DỊCH -->
            <div id="bc-v8-tab-trade" class="bc-v8-tab-content" style="display:block;">
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Số dư ví</label>
                    <div style="font-size:14px; font-weight:bold; color:#38bdf8;" id="bc-v8-balance">--</div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Tổng lãi/lỗ (ước tính)</label>
                    <div style="font-size:14px; font-weight:bold;" id="bc-v8-total-pnl">--</div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Cặp giao dịch</label>
                    <div style="display: flex; gap: 5px;">
                        <select id="bc-v8-symbol" style="flex:1; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#e2e8f0; font-size:12px;"></select>
                        <button id="bc-v8-refresh-coins" style="background:#334155; border:none; color:white; padding:6px 8px; border-radius:4px; font-size:11px; cursor:pointer;" title="Quét danh sách coin">🔄</button>
                    </div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Số tiền ký quỹ (VNDFIAT)</label>
                    <input id="bc-v8-amount" type="text" value="${formatVND(settings.amountVND)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#e2e8f0;" inputmode="numeric">
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: #94a3b8;">Đòn bẩy</label>
                    <input id="bc-v8-leverage" type="number" value="${settings.leverage}" min="1" max="1000" style="width:100%; padding:6px; background:#0f172a; border:1px solid #334155; border-radius:6px; color:#e2e8f0;">
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                    <div style="flex:1;">
                        <label style="font-size: 11px; color: #10b981;">💚 Lãi (VND)</label>
                        <input id="bc-v8-tp" type="text" value="${formatVND(settings.takeProfitVND)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #10b981; border-radius:6px; color:#10b981;" inputmode="numeric">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size: 11px; color: #ef4444;">❤️ Cắt lỗ (VND)</label>
                        <input id="bc-v8-sl" type="text" value="${formatVND(settings.stopLossVND)}" style="width:100%; padding:6px; background:#0f172a; border:1px solid #ef4444; border-radius:6px; color:#ef4444;" inputmode="numeric">
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <button id="bc-v8-long" style="flex:1; background:#10b981; border:none; padding:10px; border-radius:6px; color:white; font-weight:bold;">📈 Long</button>
                    <button id="bc-v8-short" style="flex:1; background:#ef4444; border:none; padding:10px; border-radius:6px; color:white; font-weight:bold;">📉 Short</button>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <input type="checkbox" id="bc-v8-auto" ${settings.autoTrade ? 'checked' : ''}>
                    <label for="bc-v8-auto" style="font-size: 11px;">Tự động giao dịch</label>
                    <select id="bc-v8-strategy" style="margin-left: auto; background:#0f172a; border:1px solid #334155; color:#e2e8f0; padding:4px; border-radius:4px; font-size:11px;">
                        <option value="trendFollow" ${settings.strategy === 'trendFollow' ? 'selected' : ''}>EMA</option>
                        <option value="rsi" ${settings.strategy === 'rsi' ? 'selected' : ''}>RSI</option>
                        <option value="bb" ${settings.strategy === 'bb' ? 'selected' : ''}>Bollinger</option>
                        <option value="macd" ${settings.strategy === 'macd' ? 'selected' : ''}>MACD</option>
                        <option value="combined" ${settings.strategy === 'combined' ? 'selected' : ''}>Tổng hợp</option>
                        <option value="scalping" ${settings.strategy === 'scalping' ? 'selected' : ''}>Scalping (RR cao)</option>
                    </select>
                </div>
                <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;" id="bc-v8-live-status">Sẵn sàng</div>
                <div id="bc-v8-status" style="margin-top: 8px; font-size: 11px; color: #facc15;"></div>
            </div>

            <!-- TAB PHÂN TÍCH -->
            <div id="bc-v8-tab-analysis" class="bc-v8-tab-content" style="display:none;">
                <div id="bc-v8-analysis-container">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <span style="font-size:14px; font-weight:bold;" id="bc-v8-analysis-symbol">--</span>
                        <span style="font-size:12px; color:#94a3b8;" id="bc-v8-analysis-price">--</span>
                        <span style="font-size:10px; background:#334155; padding:2px 6px; border-radius:4px;" id="bc-v8-analysis-source">--</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">RSI (14)</div>
                            <div style="font-size:16px; font-weight:bold;" id="bc-v8-rsi-val">--</div>
                            <div style="font-size:10px;" id="bc-v8-rsi-sig"></div>
                        </div>
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">EMA (12/26)</div>
                            <div style="font-size:12px;" id="bc-v8-ema-val">--</div>
                            <div style="font-size:10px;" id="bc-v8-ema-sig"></div>
                        </div>
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">MACD</div>
                            <div style="font-size:12px;" id="bc-v8-macd-val">--</div>
                            <div style="font-size:10px;" id="bc-v8-macd-sig"></div>
                        </div>
                        <div style="background:#0f172a; border-radius:6px; padding:8px;">
                            <div style="color:#94a3b8; font-size:10px;">Bollinger</div>
                            <div style="font-size:12px;" id="bc-v8-bb-val">--</div>
                            <div style="font-size:10px;" id="bc-v8-bb-sig"></div>
                        </div>
                    </div>
                    <div style="background:#0f172a; border-radius:8px; padding:10px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="font-size:11px;">Khuyến nghị</span>
                            <span style="font-size:11px; font-weight:bold;" id="bc-v8-recommendation">--</span>
                        </div>
                        <div style="height:6px; background:#334155; border-radius:3px; margin-top:4px;">
                            <div id="bc-v8-score-bar" style="height:100%; width:0%; background:#38bdf8; border-radius:3px; transition: width 0.5s;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#64748b; margin-top:2px;">
                            <span>Bán mạnh</span><span>Bán</span><span>Trung lập</span><span>Mua</span><span>Mua mạnh</span>
                        </div>
                    </div>
                    <div id="bc-v8-debug-info" style="font-size:10px; color:#64748b;"></div>
                </div>
                <button id="bc-v8-refresh-analysis" style="width:100%; margin-top:8px; background:#334155; border:none; color:white; padding:6px; border-radius:4px; font-size:11px;">🔄 Phân tích lại</button>
            </div>

            <!-- TAB HƯỚNG DẪN (đầy đủ) -->
            <div id="bc-v8-tab-guide" class="bc-v8-tab-content" style="display:none;">
                <div style="max-height: 400px; overflow-y: auto; padding-right:5px;">
                    <h3 style="color:#38bdf8; margin-top:0;">📖 Hướng dẫn chiến lược giao dịch</h3>
                    <p style="font-size:11px; color:#cbd5e1; margin-bottom:15px;">
                        Mỗi chiến lược sử dụng dữ liệu giá lịch sử để đưa ra tín hiệu <b>MUA</b> (Long) hoặc <b>BÁN</b> (Short).
                        Dữ liệu ưu tiên từ Binance API (nếu có), fallback về giá web thu thập theo thời gian thực.
                        Khung thời gian phân tích: <b>1 phút</b>.
                    </p>
                    <!-- 1. EMA -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">1. EMA – Đường trung bình động hàm mũ</h4>
                        <p style="margin:0; font-size:11px; color:#cbd5e1;">
                            <b>Nguyên lý:</b> Sử dụng hai đường EMA nhanh (12 chu kỳ) và chậm (26 chu kỳ).
                            Khi EMA nhanh cắt lên trên EMA chậm, xu hướng tăng được xác nhận. Ngược lại, khi cắt xuống, xu hướng giảm chiếm ưu thế.
                            <br><br>
                            <b>Tín hiệu MUA:</b> EMA12 cắt lên trên EMA26.
                            <br>
                            <b>Tín hiệu BÁN:</b> EMA12 cắt xuống dưới EMA26.
                            <br><br>
                            <i>Ưu điểm:</i> Bắt đúng xu hướng lớn, ít tín hiệu nhiễu trong thị trường có trend.
                            <br>
                            <i>Nhược điểm:</i> Độ trễ cao, thường vào lệnh muộn khi thị trường đảo chiều nhanh.
                        </p>
                    </div>
                    <!-- 2. RSI -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">2. RSI – Chỉ số sức mạnh tương đối</h4>
                        <p style="margin:0; font-size:11px; color:#cbd5e1;">
                            <b>Nguyên lý:</b> RSI đo lường tốc độ và sự thay đổi của biến động giá, dao động từ 0 đến 100.
                            Giá trị thấp (<35) cho thấy thị trường đang bị quá bán, có khả năng hồi phục.
                            Giá trị cao (>65) báo hiệu quá mua, có thể sắp giảm.
                            <br><br>
                            <b>Tín hiệu MUA:</b> RSI(14) < 35 (vùng quá bán).
                            <br>
                            <b>Tín hiệu BÁN:</b> RSI(14) > 65 (vùng quá mua).
                            <br><br>
                            <i>Ưu điểm:</i> Cảnh báo sớm các điểm đảo chiều tiềm năng.
                            <br>
                            <i>Nhược điểm:</i> Trong xu hướng mạnh, RSI có thể duy trì ở vùng quá mua/quá bán trong thời gian dài.
                        </p>
                    </div>
                    <!-- 3. Bollinger Bands -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">3. Bollinger Bands – Dải băng Bollinger</h4>
                        <p style="margin:0; font-size:11px; color:#cbd5e1;">
                            <b>Nguyên lý:</b> Gồm một MA(20) và hai dải trên/dưới cách MA ±2 độ lệch chuẩn.
                            Giá thường di chuyển trong dải. Khi chạm hoặc vượt biên, khả năng cao quay trở lại vùng trung bình.
                            <br><br>
                            <b>Tín hiệu MUA:</b> Giá chạm hoặc phá dải dưới.
                            <br>
                            <b>Tín hiệu BÁN:</b> Giá chạm hoặc vượt dải trên.
                            <br><br>
                            <i>Ưu điểm:</i> Xác định vùng quá bán/quá mua thống kê.
                            <br>
                            <i>Nhược điểm:</i> Trong xu hướng mạnh, giá có thể bám dải.
                        </p>
                    </div>
                    <!-- 4. MACD -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">4. MACD – Trung bình động hội tụ phân kỳ</h4>
                        <p style="margin:0; font-size:11px; color:#cbd5e1;">
                            <b>Nguyên lý:</b> MACD = EMA12 – EMA26. Signal = EMA9 của MACD.
                            Giao cắt giữa MACD và Signal cho thấy thay đổi động lượng và xu hướng.
                            <br><br>
                            <b>Tín hiệu MUA:</b> MACD cắt lên trên Signal.
                            <br>
                            <b>Tín hiệu BÁN:</b> MACD cắt xuống dưới Signal.
                            <br><br>
                            <i>Ưu điểm:</i> Kết hợp xu hướng và động lượng, tín hiệu mạnh.
                            <br>
                            <i>Nhược điểm:</i> Độ trễ lớn.
                        </p>
                    </div>
                    <!-- 5. Tổng hợp -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">5. Tổng hợp (Combined)</h4>
                        <p style="margin:0; font-size:11px; color:#cbd5e1;">
                            <b>Nguyên lý:</b> Kết hợp RSI, Bollinger, MACD, EMA. Mỗi chỉ báo được chấm điểm (+1/+2 cho Mua, -1/-2 cho Bán). Tổng ≥3 → MUA, ≤ -3 → BÁN.
                            <br><br>
                            <i>Ưu điểm:</i> Giảm nhiễu, tăng độ chính xác.
                            <br>
                            <i>Nhược điểm:</i> Có thể bỏ lỡ khi các chỉ báo mâu thuẫn.
                        </p>
                    </div>
                    <!-- 6. Scalping -->
                    <div style="margin-bottom:15px; background:#0f172a; border-radius:8px; padding:10px;">
                        <h4 style="color:#f59e0b; margin:0 0 5px;">6. Scalping – Lướt sóng siêu nhanh (Rủi ro cao)</h4>
                        <p style="margin:0; font-size:11px; color:#cbd5e1;">
                            <b>Nguyên lý:</b> Dựa trên biến động giá trong 5 giây gần nhất.
                            Nếu giá thay đổi >0.2% trong 5 giây → MUA/BÁN ngay.
                            <br><br>
                            <b>Ưu điểm:</b> Nhanh, bắt kịp các cú bứt phá mạnh.
                            <br>
                            <b>Nhược điểm:</b> Rủi ro cao, dễ bị quét stop-loss. Chỉ dành cho người thích mạo hiểm.
                        </p>
                    </div>
                    <p style="font-size:10px; color:#64748b; margin-top:5px;">
                        ⚡ <b>Lưu ý:</b> Các chiến lược chỉ mang tính chất tham khảo, không đảm bảo lợi nhuận.
                        Hãy quản lý vốn và rủi ro chặt chẽ.
                    </p>
                </div>
            </div>

            <!-- TAB LỊCH SỬ -->
            <div id="bc-v8-tab-history" class="bc-v8-tab-content" style="display:none;">
                <div id="bc-v8-history-list" style="max-height:200px; overflow-y:auto; font-size:11px;"></div>
                <button id="bc-v8-clear-history" style="margin-top:8px; background:#334155; border:none; color:white; padding:4px 8px; border-radius:4px;">Xóa</button>
            </div>

            <!-- TAB HỖ TRỢ -->
            <div id="bc-v8-tab-help" class="bc-v8-tab-content" style="display:none;">
                <p style="font-size:12px; color:#94a3b8;">Hỗ trợ: @your_telegram</p>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', panelHTML);
    GM_addStyle(`
        .bc-v8-menu-btn { background: transparent; border: none; color: #cbd5e1; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; }
        .bc-v8-menu-btn.active { background: #38bdf8; color: #0f172a; font-weight: bold; }
    `);

    // ---------- DOM ----------
    const amountInput = document.getElementById('bc-v8-amount');
    const leverageInput = document.getElementById('bc-v8-leverage');
    const tpInput = document.getElementById('bc-v8-tp');
    const slInput = document.getElementById('bc-v8-sl');
    const btnLong = document.getElementById('bc-v8-long');
    const btnShort = document.getElementById('bc-v8-short');
    const autoCheck = document.getElementById('bc-v8-auto');
    const strategySelect = document.getElementById('bc-v8-strategy');
    const symbolSelect = document.getElementById('bc-v8-symbol');
    const refreshCoinsBtn = document.getElementById('bc-v8-refresh-coins');
    const statusDiv = document.getElementById('bc-v8-status');
    const liveStatusDiv = document.getElementById('bc-v8-live-status');
    const balanceSpan = document.getElementById('bc-v8-balance');
    const totalPnlSpan = document.getElementById('bc-v8-total-pnl');
    const panel = document.getElementById('bc-v8-panel');

    amountInput.value = formatVND(settings.amountVND);
    leverageInput.value = settings.leverage;
    tpInput.value = formatVND(settings.takeProfitVND);
    slInput.value = formatVND(settings.stopLossVND);
    autoCheck.checked = settings.autoTrade;
    strategySelect.value = settings.strategy;

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
            GM_setValue('bc_v8_settings', settings);
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
            GM_setValue('bc_v8_settings', settings);
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

    // ---------- ĐẶT LỆNH (FIX) ----------
    function placeOrder(side, amountVND, leverage, tpVND, slVND) {
        const levInput = getLeverageInput();
        if (!levInput) return false;
        setReactValue(levInput, leverage.toString());

        setTimeout(() => {
            const amtInput = getAmountInputEl();
            if (!amtInput) return;
            setReactValue(amtInput, formatVND(amountVND));

            setTimeout(() => {
                ensureTPSLChecked();
                clickTab('TP/SL');

                setTimeout(() => {
                    const [tpPnL, slPnL] = getPnLInputs();
                    if (tpPnL) setReactValue(tpPnL, formatVND(tpVND));
                    if (slPnL) setReactValue(slPnL, formatVND(slVND));

                    setTimeout(() => {
                        clickMainButton(side);
                    }, 200);
                }, 200);
            }, 200);
        }, 200);
        return true;
    }

    function executeTrade(side) {
        const price = getCurrentPrice();
        if (!price) {
            statusDiv.textContent = '❌ Không lấy được giá';
            return;
        }
        const amountVND = parseNumber(amountInput.value);
        const leverage = parseInt(leverageInput.value);
        const tpVND = parseNumber(tpInput.value);
        const slVND = parseNumber(slInput.value);
        if (isNaN(amountVND) || amountVND <= 0) {
            statusDiv.textContent = '❌ Số ký quỹ không hợp lệ';
            return;
        }
        statusDiv.textContent = `⏳ Đang đặt lệnh ${side.toUpperCase()}...`;
        const ok = placeOrder(side, amountVND, leverage, tpVND, slVND);
        if (!ok) {
            statusDiv.textContent = '❌ Không thể điền form';
            return;
        }

        setTimeout(() => {
            const isError = checkForUnauthorizedPopup();
            const status = isError ? 'THẤT BẠI' : 'Thành công';
            const msg = isError ? `❌ ${side.toUpperCase()} thất bại (Unauthorized)` : `✅ ${side.toUpperCase()} | TP: +${formatVND(tpVND)} | SL: -${formatVND(slVND)}`;
            statusDiv.textContent = msg;
            const history = GM_getValue('bc_v8_history', []);
            history.unshift({ time: new Date().toISOString(), side, price, amountVND, leverage, tpVND, slVND, symbol: settings.selectedSymbol, status });
            if (history.length > 50) history.pop();
            GM_setValue('bc_v8_history', history);
            if (isError) closeErrorPopup();
        }, 2500);
    }

    btnLong.addEventListener('click', () => executeTrade('buy'));
    btnShort.addEventListener('click', () => executeTrade('sell'));

    // ---------- POPUP UNAUTHORIZED ----------
    function checkForUnauthorizedPopup() {
        const allDivs = document.querySelectorAll('div');
        for (let div of allDivs) {
            if (div.textContent.includes('Unauthorized') &&
                (div.classList.contains('bg-black/75') || div.classList.contains('bg-black\\/75'))) {
                return true;
            }
        }
        const fixedContainer = document.querySelector('.fixed.z-max');
        if (fixedContainer && fixedContainer.textContent.includes('Unauthorized')) {
            return true;
        }
        return false;
    }

    function closeErrorPopup() {
        const popups = document.querySelectorAll('.bg-black\\/75, .bg-black/75');
        popups.forEach(popup => {
            if (popup.textContent.includes('Unauthorized')) {
                const closeBtn = popup.querySelector('svg, button, [class*="cursor-pointer"]');
                if (closeBtn) closeBtn.click();
                else popup.click();
            }
        });
    }

    // ---------- CHỈ BÁO ----------
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

    // ---------- PHÂN TÍCH LIVE ----------
    async function runFullAnalysis() {
        const symbol = settings.selectedSymbol;
        document.getElementById('bc-v8-analysis-symbol').textContent = symbol.replace('USDT','') + '/USDT';
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

        document.getElementById('bc-v8-analysis-source').textContent = source;
        document.getElementById('bc-v8-analysis-price').textContent = closes.length > 0 ? closes[closes.length-1].toFixed(2) : '--';

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

        document.getElementById('bc-v8-rsi-val').textContent = rsi?.toFixed(1) || '--';
        document.getElementById('bc-v8-rsi-sig').textContent = rsi ? (rsi < 35 ? '🟢 Quá bán' : (rsi > 65 ? '🔴 Quá mua' : '⚪ Trung tính')) : '';
        document.getElementById('bc-v8-ema-val').textContent = ema12 && ema26 ? `${ema12.toFixed(2)} / ${ema26.toFixed(2)}` : '--';
        document.getElementById('bc-v8-ema-sig').textContent = ema12 && ema26 ? (ema12 > ema26 ? '🟢 EMA12 > EMA26' : '🔴 EMA12 < EMA26') : '';
        document.getElementById('bc-v8-macd-val').textContent = macdLine && signalLine ? `${macdLine.toFixed(4)} / ${signalLine.toFixed(4)}` : '--';
        document.getElementById('bc-v8-macd-sig').textContent = macdLine && signalLine ? (macdLine > signalLine ? '🟢 MACD > Signal' : '🔴 MACD < Signal') : '';
        document.getElementById('bc-v8-bb-val').textContent = bb ? `${bb.lower.toFixed(2)} - ${bb.upper.toFixed(2)}` : '--';
        document.getElementById('bc-v8-bb-sig').textContent = bb ? (closes[closes.length-1] <= bb.lower ? '🟢 Chạm dải dưới' : (closes[closes.length-1] >= bb.upper ? '🔴 Chạm dải trên' : '⚪ Trong dải')) : '';

        const signals = [ getSignal('rsi', closes), getSignal('trendFollow', closes), getSignal('bb', closes), getSignal('macd', closes) ];
        let buyVotes = 0, sellVotes = 0;
        signals.forEach(s => { if (s === 'buy') buyVotes++; else if (s === 'sell') sellVotes++; });
        let recommendation, scorePercent;
        if (buyVotes > sellVotes && buyVotes >= 2) { recommendation = '🟢 MUA'; scorePercent = 60 + buyVotes * 10; }
        else if (sellVotes > buyVotes && sellVotes >= 2) { recommendation = '🔴 BÁN'; scorePercent = 40 - sellVotes * 10; }
        else { recommendation = '⚪ TRUNG LẬP'; scorePercent = 50; }
        document.getElementById('bc-v8-recommendation').textContent = recommendation;
        document.getElementById('bc-v8-score-bar').style.width = `${scorePercent}%`;
        document.getElementById('bc-v8-score-bar').style.background = scorePercent > 60 ? '#10b981' : (scorePercent < 40 ? '#ef4444' : '#f59e0b');
        document.getElementById('bc-v8-debug-info').textContent = `Số phiếu Mua: ${buyVotes}, Bán: ${sellVotes}`;
    }

    // Live update cho tab Analysis
    let analysisLiveInterval = null;
    function startAnalysisLive() {
        if (analysisLiveInterval) clearInterval(analysisLiveInterval);
        runFullAnalysis();
        analysisLiveInterval = setInterval(runFullAnalysis, 5000);
    }
    function stopAnalysisLive() {
        if (analysisLiveInterval) { clearInterval(analysisLiveInterval); analysisLiveInterval = null; }
    }

    // Luôn chạy live khi tab Analysis đang active, dùng MutationObserver hoặc biến trạng thái
    let currentTab = 'trade';
    document.querySelectorAll('#bc-v8-panel .bc-v8-menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#bc-v8-panel .bc-v8-menu-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.querySelectorAll('#bc-v8-panel .bc-v8-tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(`bc-v8-tab-${tabId}`).style.display = 'block';
            currentTab = tabId;
            if (tabId === 'analysis') {
                startAnalysisLive();
            } else {
                stopAnalysisLive();
            }
            if (tabId === 'history') renderHistory();
        });
    });

    // Nếu tab Analysis đang mở khi mới load? Mặc định là trade nên không cần.
    // Nút refresh vẫn hoạt động
    document.getElementById('bc-v8-refresh-analysis').addEventListener('click', runFullAnalysis);

    // ---------- AUTO TRADE ----------
    let autoInterval = null;
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
            executeTrade('buy');
        } else if (signal === 'sell') {
            liveStatusDiv.textContent = '🔴 Tín hiệu BÁN – đang đặt lệnh...';
            executeTrade('sell');
        } else {
            liveStatusDiv.textContent = '⚪ Không có tín hiệu';
        }
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
    }
    autoCheck.addEventListener('change', () => {
        saveSettings();
        if (autoCheck.checked) startAuto();
        else stopAuto();
    });
    if (autoCheck.checked) startAuto();

    // ---------- SỐ DƯ VÍ ----------
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
        let initial = GM_getValue('bc_v8_initial_balance', null);
        if (initial === null) {
            const vndImg = document.querySelector('img[src*="VND.rect"]');
            if (vndImg) {
                const container = vndImg.closest('.flex.flex-auto');
                if (container) {
                    const amountEl = container.querySelector('.font-extrabold');
                    if (amountEl) {
                        const balanceText = amountEl.textContent.replace(/[^0-9]/g, '');
                        initial = parseInt(balanceText);
                        GM_setValue('bc_v8_initial_balance', initial);
                    }
                }
            }
        }
        return initial;
    }

    function updateTotalPnL() {
        const currentBalanceText = balanceSpan.textContent.replace(/[^0-9]/g, '');
        const currentBalance = parseInt(currentBalanceText);
        const initialBalance = getInitialBalance();
        if (!isNaN(currentBalance) && initialBalance !== null && !isNaN(initialBalance)) {
            const pnl = currentBalance - initialBalance;
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
    }, 5000);
    updateBalance();
    updateTotalPnL();
    setTimeout(() => {
        getInitialBalance();
        updateTotalPnL();
    }, 3000);

    // ---------- LƯU CÀI ĐẶT ----------
    function saveSettings() {
        settings.amountVND = parseNumber(amountInput.value);
        settings.leverage = parseInt(leverageInput.value);
        settings.takeProfitVND = parseNumber(tpInput.value);
        settings.stopLossVND = parseNumber(slInput.value);
        settings.autoTrade = autoCheck.checked;
        settings.strategy = strategySelect.value;
        settings.selectedSymbol = symbolSelect.value;
        GM_setValue('bc_v8_settings', settings);
    }
    [amountInput, leverageInput, tpInput, slInput, autoCheck, strategySelect, symbolSelect].forEach(el => {
        el.addEventListener('change', saveSettings);
        el.addEventListener('input', saveSettings);
    });

    // ---------- KÉO PANEL ----------
    const header = document.getElementById('bc-v8-header');
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

    document.getElementById('bc-v8-toggle').addEventListener('click', () => {
        const body = document.getElementById('bc-v8-body');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? 'block' : 'none';
        document.getElementById('bc-v8-toggle').textContent = hidden ? '−' : '+';
    });

    // ---------- LỊCH SỬ ----------
    function renderHistory() {
        const list = document.getElementById('bc-v8-history-list');
        const history = GM_getValue('bc_v8_history', []);
        if (!history.length) { list.innerHTML = '<p style="color:#94a3b8;">Chưa có giao dịch</p>'; return; }
        list.innerHTML = history.map(h => `
            <div style="border-bottom:1px solid #334155; padding:4px 0;">
                <b>${h.side.toUpperCase()}</b> ${h.symbol} @ ${h.price} | Vốn: ${formatVND(h.amountVND)}<br>
                Lãi: +${formatVND(h.tpVND)} | Cắt lỗ: -${formatVND(h.slVND)}<br>
                <small>${new Date(h.time).toLocaleString()} | <span style="color:${h.status === 'THẤT BẠI' ? '#ef4444' : '#10b981'}">${h.status || 'Thành công'}</span></small>
            </div>
        `).join('');
    }
    document.getElementById('bc-v8-clear-history').addEventListener('click', () => {
        GM_setValue('bc_v8_history', []);
        renderHistory();
    });

})();
