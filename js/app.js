// ================= Data Model =================
        const STORAGE_KEY = 'fund_tracker_data';
        // snapshots: [{ key: "2026-08-20", balances: {channelId: amount}, debts: number }]
        let state = {
            title: '资金渠道追踪',
            channels: [],     // [{ id, name, type, color }]
            debts: [],        // [{ id, name, type, amount, channelId, note }]
            snapshots: [],    // [{ key, balances, debts }]
            view: 'month',
            currentMonth: getYM(new Date()),
            currentYear: new Date().getFullYear(),
            trendYear: new Date().getFullYear(),
            hiddenChannels: new Set(),
            chFilter: 'all',
            sectionTitles: {}    // { channels: '资金渠道', debts: '欠款管理' }
        };

        let editingChannelId = null;
        let editingDebtId = null;
        let confirmCallback = null;
        let curveChart = null;
        let monthChart = null;
        let yearChart = null;
        let privMode = false;    // 小眼睛隐私模式（不持久化）

        const CHANNEL_COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16', '#d946ef', '#eab308'];
        const DEBT_ICONS = { '货款': '🧾', '借款': '🤝', '信用卡': '💳', '花呗/白条': '💸', '其他': '📦' };
        const INVEST_TYPES = ['gold', 'nasdaq', 'fund', 'stock'];
        const INVEST_GROUPS = [
            { type: 'gold', label: '积存金', icon: '🥇' },
            { type: 'nasdaq', label: '纳指', icon: '💹' },
            { type: 'fund', label: '基金', icon: '📈' },
            { type: 'stock', label: '股票', icon: '📊' }
        ];
        const TYPE_LABELS = {
            bank: '银行卡', alipay: '支付宝', wechat: '微信', cash: '现金', credit: '信用卡',
            gold: '积存金', nasdaq: '纳指', fund: '基金', stock: '股票', wallet: '虚拟币/钱包', other: '其他'
        };

        const typeIcons = {
            bank: '🏦', alipay: '💰', wechat: '💬', cash: '💵',
            gold: '🥇', nasdaq: '💹', fund: '📈', stock: '📊', wallet: '🪙', other: '📦'
        };

        // ===== 类型支持（输入框 + 快捷标签，统一归一化） =====
        const PRESET_TYPES = Object.keys(typeIcons).concat(['credit']);
        // 中文类型名 -> 预设类型 key（手动输入"支付宝"等文字时自动归一为内置类型）
        const TYPE_KEY_BY_CN = {
            '银行卡': 'bank', '支付宝': 'alipay', '微信': 'wechat', '现金': 'cash', '信用卡': 'credit',
            '积存金': 'gold', '黄金': 'gold', '纳指': 'nasdaq', '基金': 'fund', '股票': 'stock',
            '虚拟币': 'wallet', '钱包': 'wallet', '其他': 'other'
        };
        // 归一化类型值：命中内置名称 -> 内置 key；否则保留原输入文字（自定义类型）
        function normalizeType(v) {
            const s = String(v == null ? '' : v).trim();
            if (!s) return '';
            return TYPE_KEY_BY_CN[s] || s;
        }
        // 是否投资类型：内置 key，或文字包含投资关键词（兼容"纳指ETF"等自定义写法）
        function isInvestType(t) {
            if (INVEST_TYPES.includes(t)) return true;
            const s = String(t || '').toLowerCase();
            return ['积存金', '黄金', '纳指', '基金', '股票', 'etf', '指数'].some(k => s.includes(k));
        }
        // 常见自定义类型的图标提示（按文字模糊匹配）
        const CUSTOM_ICON_HINTS = [
            ['电子卡', '💳'], ['e卡', '💳'], ['购物卡', '🛍️'], ['礼品卡', '🎁'],
            ['零钱', '🪙'], ['红包', '🧧'], ['积分', '⭐'], ['优惠券', '🎟️'],
            ['纳指', '💹'], ['指数', '💹'], ['黄金', '🥇'],
            ['卡', '💳'], ['券', '🎟️'], ['金', '🥇']
        ];
        // 获取渠道类型图标：预设类型用内置图标，自定义类型按文字猜测，否则兜底标签
        function typeIconOf(t) {
            if (typeIcons[t]) return typeIcons[t];
            const lower = String(t || '').toLowerCase();
            for (const [kw, icon] of CUSTOM_ICON_HINTS) {
                if (lower.includes(kw)) return icon;
            }
            return '🏷️';
        }

        // ================= Utilities =================
        function getYM(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
        function getYMD(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
        function todayYMD() { return getYMD(new Date()); }
        function monthOf(key) { return String(key).slice(0, 7); }
        function fmtSnapKey(k) {
            k = String(k);
            // '2026-08-20' → '8/20'；旧数据 '2026-08' 原样显示
            return k.length >= 10 ? `${Number(k.slice(5,7))}/${Number(k.slice(8,10))}` : k;
        }
        function fmtUpdateTime(t) {
            // ISO 时间戳 → '今天 17:32' / '8月20日 17:32' / '2025年8月20日 17:32'
            if (!t) return null;
            const d = new Date(t);
            if (isNaN(d.getTime())) return null;
            const now = new Date();
            const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const md = `${d.getMonth()+1}月${d.getDate()}日`;
            const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
            if (sameDay) return `今天 ${hm}`;
            if (d.getFullYear() === now.getFullYear()) return `${md} ${hm}`;
            return `${d.getFullYear()}年${md} ${hm}`;
        }
        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        function ymd(y, m) { return `${y}-${String(m).padStart(2,'0')}`; }
        function fmtMoney(v, showPlus = false) {
            const num = Number(v) || 0;
            const prefix = showPlus ? (num > 0 ? '+' : '') : '';
            return prefix + '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        function fmtShort(v) {
            const num = Number(v) || 0;
            const abs = Math.abs(num);
            if (abs >= 100000000) return '¥' + (num/100000000).toFixed(2) + '亿';
            if (abs >= 10000) return '¥' + (num/10000).toFixed(2) + '万';
            return '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 0 });
        }
        // 金额输入过滤：只允许数字与小数点，全角句号/小数点/数字自动转半角，最多 2 位小数
        function filterMoney(el) {
            let v = String(el.value).replace(/。/g, '.').replace(/．/g, '.');
            v = v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
            v = v.replace(/[^\d.]/g, '');
            const dot = v.indexOf('.');
            if (dot !== -1) {
                let int = v.slice(0, dot);
                let dec = v.slice(dot + 1).replace(/\./g, '');
                if (dec.length > 2) dec = dec.slice(0, 2);
                v = int + '.' + dec;
            }
            if (el.value !== v) el.value = v;
        }
        function showToast(msg, type) {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.className = 'toast show' + (type ? ' ' + type : '');
            clearTimeout(t._timer);
            t._timer = setTimeout(() => { t.className = 'toast'; }, 2500);
        }

        // ================= Editable Title =================
        function applyTitle() {
            const el = document.getElementById('titleText');
            if (el && state.title) el.textContent = state.title;
            document.title = (state.title || '资金渠道追踪') + ' · 资金追踪';
        }
        function startEditTitle() {
            const el = document.getElementById('titleText');
            el.contentEditable = 'true';
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        function finishEditTitle() {
            const el = document.getElementById('titleText');
            el.contentEditable = 'false';
            let t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!t) t = '资金渠道追踪';
            el.textContent = t;
            state.title = t;
            save();
            applyTitle();
            showToast('标题已更新：' + t, 'success');
        }
        function bindTitleEvents() {
            const el = document.getElementById('titleText');
            el.addEventListener('blur', finishEditTitle);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                if (e.key === 'Escape') { el.textContent = state.title; el.blur(); }
            });
        }

        // ================= Editable Section Titles（区块标题可改名） =================
        const SECTION_FALLBACKS = { channels: '资金渠道', debts: '欠款管理' };
        function startEditSection(id) {
            const el = document.getElementById(id);
            el.contentEditable = 'true';
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        function finishEditSection(id, key) {
            const el = document.getElementById(id);
            el.contentEditable = 'false';
            let t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!t) t = SECTION_FALLBACKS[key];
            el.textContent = t;
            state.sectionTitles = state.sectionTitles || {};
            state.sectionTitles[key] = t;
            save();
            showToast(`已更新：${t}`, 'success');
        }
        function applySectionTitles() {
            const st = state.sectionTitles || {};
            Object.keys(SECTION_FALLBACKS).forEach(key => {
                const el = document.getElementById('secTitle' + (key === 'channels' ? 'Channels' : 'Debts'));
                if (el && st[key]) el.textContent = st[key];
            });
        }
        function bindSectionTitles() {
            Object.keys(SECTION_FALLBACKS).forEach(key => {
                const el = document.getElementById('secTitle' + (key === 'channels' ? 'Channels' : 'Debts'));
                if (!el) return;
                el.addEventListener('blur', () => finishEditSection(el.id, key));
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                    if (e.key === 'Escape') {
                        el.textContent = (state.sectionTitles && state.sectionTitles[key]) || SECTION_FALLBACKS[key];
                        el.blur();
                    }
                });
            });
        }

        // ================= Privacy Mode（小眼睛隐藏金额） =================
        function togglePrivMode() {
            privMode = !privMode;
            document.body.classList.toggle('priv', privMode);
            document.getElementById('privBtn').textContent = privMode ? '🙈 显示' : '👁 隐藏';
            renderCurve();          // 图表刻度与提示也进入隐私模式
            renderCurrentView();    // 历史图表同步
        }

        // ================= Theme (黑白模式切换) =================
        function currentTheme() {
            return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        }
        function applyTheme(theme) {
            if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
            else document.documentElement.removeAttribute('data-theme');
            const btn = document.getElementById('themeBtn');
            if (btn) btn.textContent = theme === 'dark' ? '☀️ 浅色' : '🌙 深色';
            try { localStorage.setItem('fund_tracker_theme', theme); } catch (_) {}
        }
        function toggleTheme() {
            applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
            renderCurve();          // 顶部图表颜色随主题重绘
            renderCurrentView();    // 历史（月度/年度）图表同步重绘
        }
        function isDarkChart() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

        // ================= Persistence =================
        function save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                title: state.title,
                channels: state.channels,
                debts: state.debts,
                snapshots: state.snapshots,
                sectionTitles: state.sectionTitles || {}
            }));
        }
        function load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    state.title = data.title || '资金渠道追踪';
                    state.channels = data.channels || [];
                    state.debts = data.debts || [];
                    state.snapshots = data.snapshots || [];
                    state.sectionTitles = data.sectionTitles || {};
                }
            } catch(e) { console.error('加载失败', e); }
        }

        // ================= Export / Import =================
        function exportBackup() {
            if (state.channels.length === 0 && state.debts.length === 0 && state.snapshots.length === 0) {
                showToast('暂无数据可导出', 'error');
                return;
            }
            const payload = {
                app: 'fund-channel-tracker',
                version: 1,
                exportedAt: new Date().toISOString(),
                title: state.title,
                channels: state.channels,
                debts: state.debts,
                snapshots: state.snapshots,
                sectionTitles: state.sectionTitles || {}
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `资金数据备份_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('备份已导出，请妥善保存该文件', 'success');
        }

        function exportCSV() {
            if (state.channels.length === 0 && state.debts.length === 0 && state.snapshots.length === 0) {
                showToast('暂无数据可导出', 'error');
                return;
            }
            let csv = '\uFEFF资金渠道追踪数据报表\n';
            csv += `导出时间,${new Date().toLocaleString('zh-CN')}\n\n`;

            // Channels
            csv += '【资金渠道】\n';
            csv += '渠道名称,类型,投入成本,渠道颜色\n';
            state.channels.forEach(c => {
                csv += `${c.name},${TYPE_LABELS[c.type] || c.type},${Number(c.cost) || 0},${c.color}\n`;
            });

            // Invest summary
            const { inv, total: invTotalV, cost: invCostV, profit: invProfitV, rate: invRateV } = investStats();
            if (inv.length > 0) {
                csv += '\n【投资收益汇总】\n';
                csv += '投资总值,投入成本,累计收益,收益率\n';
                csv += `${Number(invTotalV)},${Number(invCostV)},${Number(invProfitV)},${invRateV !== null ? invRateV.toFixed(2) + '%' : ''}\n`;
            }

            // Debts
            csv += '\n【欠款记录】\n';
            csv += '名称,类型,金额,关联渠道,备注\n';
            state.debts.forEach(d => {
                const ch = state.channels.find(c => c.id === d.channelId);
                csv += `${d.name},${d.type},${Number(d.amount) || 0},${ch ? ch.name : ''},${d.note || ''}\n`;
            });

            // Snapshot matrix
            csv += '\n【资金快照记录】\n';
            const headers = ['日期'];
            state.channels.forEach(c => headers.push(c.name));
            headers.push('欠款合计', '净资产');
            csv += headers.join(',') + '\n';

            const keys = getMonthKeys();
            keys.forEach(k => {
                const snap = snapshotOf(k);
                const row = [k];
                state.channels.forEach(c => {
                    const v = snap.balances[c.id];
                    row.push(v != null ? Number(v) : '');
                });
                const debt = debtOf(snap);
                const net = netOf(snap);
                row.push(debt != null ? Number(debt) : '');
                row.push(net != null ? Number(net) : '');
                csv += row.join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `资金数据报表_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('报表已导出，可用 Excel 打开', 'success');
        }

        function handleImport(e) {
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                let data;
                try {
                    data = JSON.parse(ev.target.result);
                } catch (err) {
                    showToast('文件解析失败：不是有效的备份 JSON 文件', 'error');
                    return;
                }
                if (!data || !Array.isArray(data.channels) || !Array.isArray(data.snapshots)) {
                    showToast('文件格式不正确，请选择本工具导出的备份文件', 'error');
                    return;
                }
                const chCount = data.channels.length;
                const debtCount = (data.debts || []).length;
                const snapCount = data.snapshots.length;
                const hasCurrent = state.channels.length > 0 || state.debts.length > 0 || state.snapshots.length > 0;

                // 弹出「覆盖 / 合并」选择框
                document.getElementById('confirmTitle').textContent = '导入数据';
                document.getElementById('confirmMessage').innerHTML =
                    `将导入 ${chCount} 个渠道、${debtCount} 条欠款、${snapCount} 条快照记录。<br>` +
                    `请选择导入方式：` +
                    `<ul style="text-align:left; margin:8px 0 0; padding-left:18px; font-size:13px; color:var(--text-secondary); line-height:1.9;">` +
                    `<li><b>覆盖导入</b>：用文件完全替换当前页面数据${hasCurrent ? '（当前数据将丢失！）' : ''}</li>` +
                    `<li><b>合并导入</b>：按渠道名称与记录日期合并，两边数据都不丢失，适合多设备汇总</li>` +
                    `</ul>`;
                confirmCallback = () => replaceImport(data);
                const mergeBtn = document.getElementById('confirmBtnMerge');
                mergeBtn.style.display = '';
                mergeBtn.onclick = () => { mergeImport(data); closeConfirmModal(); };
                document.getElementById('confirmBtn').textContent = '覆盖导入';
                document.getElementById('confirmModal').classList.add('active');
            };
            reader.readAsText(file);
        }

        // 覆盖导入：用文件完全替换当前数据（保留标题）
        function replaceImport(data) {
            state.title = data.title || state.title;
            state.channels = data.channels;
            state.debts = data.debts || [];
            state.snapshots = data.snapshots;
            state.sectionTitles = Object.assign({}, state.sectionTitles || {}, data.sectionTitles || {});
            state.hiddenChannels = new Set();
            state.chFilter = 'all';
            applyTitle();
            applySectionTitles();
            save(); renderAll();
            showToast('数据已覆盖导入', 'success');
        }

        // 合并导入：渠道按名称匹配、快照按日期合并，两边数据都不丢
        function mergeImport(data) {
            if ((data.channels || []).length === 0 && (data.debts || []).length === 0 && (data.snapshots || []).length === 0) {
                showToast('文件中没有可合并的数据', 'error');
                return;
            }
            const idMap = {};          // 导入渠道 id -> 本地 id（或新生成 id）
            let newChCount = 0, sameChCount = 0;
            (data.channels || []).forEach(ic => {
                const local = state.channels.find(c => c.name === ic.name);
                if (local) {
                    idMap[ic.id] = local.id;
                    sameChCount++;
                } else {
                    const nid = 'ch_' + Date.now() + '_' + (newChCount++);
                    state.channels.push({
                        id: nid, name: ic.name, type: ic.type,
                        cost: Number(ic.cost) || 0,
                        color: CHANNEL_COLORS[state.channels.length % CHANNEL_COLORS.length]
                    });
                    idMap[ic.id] = nid;
                }
            });

            let newDebtCount = 0;
            (data.debts || []).forEach(idb => {
                // 同名且同类型视为同一笔欠款，保留本地；否则新增
                const local = state.debts.find(d => d.name === idb.name && d.type === idb.type);
                if (!local) {
                    state.debts.push({
                        id: 'd_' + Date.now() + '_' + (newDebtCount++),
                        name: idb.name, type: idb.type,
                        amount: Number(idb.amount) || 0,
                        channelId: idb.channelId ? (idMap[idb.channelId] || null) : null,
                        note: idb.note || ''
                    });
                }
            });

            let newSnapCount = 0, mergeSnapCount = 0;
            (data.snapshots || []).forEach(is => {
                const newBal = {};
                Object.entries(is.balances || {}).forEach(([k, v]) => {
                    const nk = idMap[k];
                    if (nk) newBal[nk] = v;   // 只保留能对上渠道的余额
                });
                const localSnap = snapshotOf(is.key);
                if (localSnap) {
                    // 同一天：导入的渠道余额覆盖，本地其他渠道保留
                    Object.assign(localSnap.balances, newBal);
                    if (is.debts != null) localSnap.debts = is.debts;
                    if (is.updatedAt) localSnap.updatedAt = is.updatedAt;
                    mergeSnapCount++;
                } else {
                    state.snapshots.push({ key: is.key, balances: newBal, debts: is.debts, updatedAt: is.updatedAt || new Date().toISOString() });
                    newSnapCount++;
                }
                // 被覆盖余额的渠道，更新时间取该快照的导入时间
                const chTime = is.updatedAt || new Date().toISOString();
                Object.keys(newBal).forEach(nk => {
                    const lc = state.channels.find(c => c.id === nk);
                    if (lc) lc.updatedAt = chTime;
                });
            });
            state.snapshots.sort((a, b) => a.key < b.key ? -1 : 1);

            save(); renderAll();
            showToast(`合并完成：渠道同名合并 ${sameChCount}、新增 ${newChCount}；快照合并 ${mergeSnapCount} 天、新增 ${newSnapCount} 天`, 'success');
        }

        // ================= Snapshot helpers =================
        function snapshotOf(key) { return state.snapshots.find(s => s.key === key); }

        // ================= Invest =================
        function isInvest(ch) { return isInvestType(ch.type); }
        function investChannels() { return state.channels.filter(isInvest); }
        function investStats() {
            const inv = investChannels();
            const keys = getMonthKeys();
            const lastSnap = keys.length ? snapshotOf(keys[keys.length-1]) : null;
            const total = inv.reduce((s,c) => s + (lastSnap && lastSnap.balances[c.id] != null ? Number(lastSnap.balances[c.id]) : 0), 0);
            const cost = inv.reduce((s,c) => s + (Number(c.cost)||0), 0);
            const profit = total - cost;
            const rate = cost > 0 ? profit / cost * 100 : null;
            return { inv, lastSnap, total, cost, profit, rate };
        }
        function renderInvest() {
            const sec = document.getElementById('investSection');
            const { inv, lastSnap, total, cost, profit, rate } = investStats();
            if (inv.length === 0) { sec.style.display = 'none'; return; }
            sec.style.display = 'block';
            document.getElementById('invTotal').textContent = fmtMoney(total);
            document.getElementById('invCostSub').textContent = `${inv.length} 个投资渠道 · 成本 ${fmtMoney(cost)}`;
            const pEl = document.getElementById('invProfit');
            pEl.textContent = profit >= 0 ? '+' + fmtMoney(profit) : '-' + fmtMoney(Math.abs(profit));
            pEl.className = 'amount ' + (profit >= 0 ? 'up' : 'down');
            const rEl = document.getElementById('invRate');
            rEl.textContent = rate !== null ? (rate >= 0 ? '+' : '') + rate.toFixed(2) + '%' : '—';
            rEl.className = 'amount ' + (rate !== null ? (rate >= 0 ? 'up' : 'down') : '');

            // 按投资类型分组汇总（如：多个积存金账户合并统计）
            document.getElementById('investGroups').innerHTML = INVEST_GROUPS.map(g => {
                const chs = inv.filter(c => c.type === g.type);
                if (chs.length === 0) return '';
                const gTotal = chs.reduce((s,c) => s + (lastSnap && lastSnap.balances[c.id] != null ? Number(lastSnap.balances[c.id]) : 0), 0);
                const gCost = chs.reduce((s,c) => s + (Number(c.cost)||0), 0);
                const gProfit = gTotal - gCost;
                const gRate = gCost > 0 ? gProfit / gCost * 100 : null;
                const cls = gProfit >= 0 ? 'up' : 'down';
                const sub = gRate !== null
                    ? `<span class="ig-sub ${cls}">${gProfit >= 0 ? '📈' : '📉'} ${gProfit >= 0 ? '+' : '-'}${fmtMoney(Math.abs(gProfit))}（${gRate >= 0 ? '+' : ''}${gRate.toFixed(1)}%）</span>`
                    : `<span class="ig-sub" style="color:#9ca3af;">成本 ${fmtMoney(gCost)}</span>`;
                return `
                    <div class="invest-group" onclick="setInvestFilter('${g.type}')" title="点击筛选渠道">
                        <span class="ig-icon">${g.icon}</span>
                        <div class="ig-info">
                            <div class="ig-name">${g.label}<span class="ig-count">×${chs.length}</span></div>
                            <div class="ig-val">${fmtMoney(gTotal)}</div>
                            ${sub}
                        </div>
                    </div>`;
            }).join('');
        }
        function setInvestFilter(f) {
            state.chFilter = f;
            document.querySelectorAll('#channelFilterChips .legend-chip').forEach(el => {
                el.classList.toggle('active', el.dataset.f === f);
            });
            renderChannels();
        }
        function toggleCostField() {
            const type = normalizeType(document.getElementById('chType').value);
            // 投资类型显示成本输入框（输入文字时实时判断）
            document.getElementById('chCostGroup').style.display = isInvestType(type) ? '' : 'none';
        }
        function onTypeInput() { toggleCostField(); syncTypeChips(); }
        function pickType(t) {
            document.getElementById('chType').value = TYPE_LABELS[t] || t;
            toggleCostField(); syncTypeChips();
        }
        // 高亮与当前输入匹配的快捷标签
        function syncTypeChips() {
            const v = normalizeType(document.getElementById('chType').value);
            document.querySelectorAll('#chTypeChips .type-chip').forEach(btn => {
                btn.classList.toggle('active', v === normalizeType(btn.dataset.t));
            });
        }
        function totalOf(snap) {
            if (!snap) return null;
            return Object.values(snap.balances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        }
        function debtOf(snap) {
            if (!snap) return null;
            return snap.debts != null ? Number(snap.debts) : null;
        }
        function netOf(snap) {
            const t = totalOf(snap);
            const d = debtOf(snap);
            if (t === null) return null;
            return t - (d || 0);
        }
        function currentDebtsTotal() {
            return state.debts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
        }
        function getMonthKeys() { return state.snapshots.map(s => s.key).sort(); }
        // 某月最后一条快照（兼容旧 'YYYY-MM' key 数据）
        function monthSnapOf(ym) {
            let best = null;
            state.snapshots.forEach(s => {
                if (monthOf(s.key) === ym) {
                    if (!best || s.key > best.key) best = s;
                }
            });
            return best;
        }
        // 最新一条快照（按 key 排序）
        function lastSnap() {
            let best = null;
            state.snapshots.forEach(s => { if (!best || s.key > best.key) best = s; });
            return best;
        }
        function getYearKeys() {
            const set = new Set();
            state.snapshots.forEach(s => set.add(s.key.slice(0,4)));
            return [...set].sort();
        }

        // ================= Summary =================
        function renderSummary() {
            const keys = getMonthKeys();
            const latest = lastSnap();
            const lastKey = latest ? latest.key : null;
            const asset = latest ? totalOf(latest) : 0;
            const debt = latest ? (debtOf(latest) ?? currentDebtsTotal()) : currentDebtsTotal();
            const net = asset - debt;
            const timeStr = lastKey ? (latest && latest.updatedAt ? (fmtUpdateTime(latest.updatedAt) || fmtSnapKey(lastKey)) : fmtSnapKey(lastKey)) : null;

            document.getElementById('hChannels').textContent = state.channels.length;
            document.getElementById('hMonths').textContent = keys.length;
            document.getElementById('hNet').textContent = fmtShort(net);
            document.getElementById('sAsset').textContent = fmtMoney(asset);
            document.getElementById('sAssetDate').textContent = timeStr ? `更新于 ${timeStr}` : '暂无数据';
            document.getElementById('sDebt').textContent = fmtMoney(debt);
            document.getElementById('sDebtDate').textContent = timeStr ? `更新于 ${timeStr}` : '暂无数据';
            document.getElementById('sNet').textContent = fmtMoney(net);
            document.getElementById('sNetSub').textContent = `资产 − 欠款${net < 0 ? ' ⚠️ 资不抵债' : ''}${timeStr ? ` · 更新于 ${timeStr}` : ''}`;
            if (net < 0) document.getElementById('sNet').style.color = 'var(--danger)';
            else document.getElementById('sNet').style.color = '';

            // Month change (based on net worth)
            const prevKey = keys[keys.length - 2];
            const prevSnap = snapshotOf(prevKey);
            const changeEl = document.getElementById('sMonthChange');
            const changeSub = document.getElementById('sMonthChangeSub');
            if (latest && prevSnap) {
                const prevNet = netOf(prevSnap);
                const diff = net - prevNet;
                changeEl.textContent = fmtMoney(diff, true);
                changeEl.className = 'amount ' + (diff >= 0 ? 'up' : 'down');
                changeSub.textContent = `较 ${fmtSnapKey(prevKey)} · 更新于 ${timeStr}`;
            } else {
                changeEl.textContent = '—';
                changeEl.className = 'amount';
                changeSub.textContent = '暂无对比';
            }

            const rateEl = document.getElementById('sMonthRate');
            const rateSub = document.getElementById('sMonthRateSub');
            if (latest && prevSnap) {
                const prevNet = netOf(prevSnap);
                if (prevNet > 0) {
                    const rate = ((net - prevNet) / prevNet) * 100;
                    rateEl.textContent = (rate >= 0 ? '+' : '') + rate.toFixed(2) + '%';
                    rateEl.className = 'amount ' + (rate >= 0 ? 'up' : 'down');
                    rateSub.textContent = `较 ${fmtSnapKey(prevKey)} · 更新于 ${timeStr}`;
                } else {
                    rateEl.textContent = '—';
                    rateEl.className = 'amount';
                    rateSub.textContent = '暂无数据';
                }
            } else {
                rateEl.textContent = '—';
                rateEl.className = 'amount';
                rateSub.textContent = '暂无数据';
            }

            const activeCount = latest ? Object.keys(latest.balances || {}).length : 0;
            document.getElementById('sChannels').textContent = state.channels.length;
            document.getElementById('sChannelsActive').textContent = `${activeCount} 个渠道有数据${timeStr ? ` · 更新于 ${timeStr}` : ''}`;
        }

        // ================= Channels =================
        function openChannelModal(id) {
            editingChannelId = id || null;
            document.getElementById('channelModalTitle').textContent = id ? '编辑渠道' : '新增渠道';
            if (id) {
                const ch = state.channels.find(c => c.id === id);
                document.getElementById('chName').value = ch.name;
                document.getElementById('chType').value = TYPE_LABELS[ch.type] || ch.type;
                const snap = lastSnap();
                document.getElementById('chBalance').value = snap && snap.balances[id] != null ? snap.balances[id] : 0;
                document.getElementById('chCost').value = ch.cost || 0;
                document.querySelector('#channelModal .modal-note').textContent = '💡 修改余额会更新最近一次快照记录';
            } else {
                document.getElementById('chName').value = '';
                document.getElementById('chType').value = '';
                document.getElementById('chBalance').value = '0';
                document.getElementById('chCost').value = '0';
                document.querySelector('#channelModal .modal-note').textContent = '💡 当前余额将作为今天的快照记录保存';
            }
            toggleCostField();
            syncTypeChips();
            document.getElementById('channelModal').classList.add('active');
            setTimeout(() => document.getElementById('chName').focus(), 100);
        }
        function closeChannelModal() {
            document.getElementById('channelModal').classList.remove('active');
            editingChannelId = null;
        }
        function saveChannel() {
            const name = document.getElementById('chName').value.trim();
            const type = normalizeType(document.getElementById('chType').value);
            if (!type) { showToast('请输入类型，如：支付宝、积存金', 'error'); return; }
            if (type.length > 12) { showToast('类型名称最多 12 个字', 'error'); return; }
            const balance = parseFloat(document.getElementById('chBalance').value) || 0;
            const cost = parseFloat(document.getElementById('chCost').value) || 0;
            if (!name) { showToast('请输入渠道名称', 'error'); return; }

            if (editingChannelId) {
                const ch = state.channels.find(c => c.id === editingChannelId);
                ch.name = name;
                ch.type = type;
                ch.cost = cost;
                ch.updatedAt = new Date().toISOString();
                const snap = lastSnap();
                if (snap) {
                    snap.balances[ch.id] = balance;
                    snap.updatedAt = new Date().toISOString();
                }
                showToast('渠道已更新', 'success');
            } else {
                const id = 'ch_' + Date.now();
                state.channels.push({
                    id, name, type, cost,
                    color: CHANNEL_COLORS[state.channels.length % CHANNEL_COLORS.length],
                    updatedAt: new Date().toISOString()
                });
                const key = todayYMD();
                let snap = snapshotOf(key);
                if (!snap) {
                    snap = { key, balances: {}, debts: currentDebtsTotal(), updatedAt: new Date().toISOString() };
                    state.snapshots.push(snap);
                }
                snap.balances[id] = balance;
                snap.updatedAt = new Date().toISOString();
                showToast('渠道已添加', 'success');
            }
            // 新增/编辑后，把快照日期切到今天，确保左侧快照表单同步显示最新数据
            const snapDateEl = document.getElementById('snapDate');
            if (snapDateEl) snapDateEl.value = todayYMD();
            save(); renderAll(); closeChannelModal();
        }
        function deleteChannel(id) {
            const ch = state.channels.find(c => c.id === id);
            if (!ch) return;
            showConfirm('删除渠道', `确定删除渠道"${ch.name}"吗？其所有历史快照余额将被清除。`, () => {
                state.channels = state.channels.filter(c => c.id !== id);
                state.snapshots.forEach(s => { delete s.balances[id]; });
                state.debts.forEach(d => { if (d.channelId === id) d.channelId = null; });
                state.hiddenChannels.delete(id);
                save(); renderAll();
                showToast('渠道已删除', 'success');
            });
        }

        // 渠道更新时间：优先渠道自身 updatedAt；旧数据回退到最近含该渠道余额的快照
        function channelUpdatedLabel(ch) {
            if (ch && ch.updatedAt) {
                const t = fmtUpdateTime(ch.updatedAt);
                if (t) return t;
            }
            for (let i = state.snapshots.length - 1; i >= 0; i--) {
                const s = state.snapshots[i];
                if (s.balances && s.balances[ch.id] != null) {
                    if (s.updatedAt) {
                        const t = fmtUpdateTime(s.updatedAt);
                        if (t) return t;
                    }
                    return fmtSnapKey(s.key);
                }
            }
            return null;
        }

        function renderChannels() {
            // 动态生成类型筛选 chips（只显示已存在的类型，含自定义类型）
            const activeTypes = [...new Set(state.channels.map(c => c.type))];
            document.getElementById('investTypeChips').innerHTML = activeTypes.map(t => {
                const g = INVEST_GROUPS.find(x => x.type === t);
                const icon = g ? g.icon : typeIconOf(t);
                const label = g ? g.label : (TYPE_LABELS[t] || t);
                return `<span class="legend-chip" data-f="${esc(t)}" onclick="setInvestFilter(this.dataset.f)">${icon} ${esc(label)}</span>`;
            }).join('');

            // 高亮当前筛选
            document.querySelectorAll('#channelFilterChips .legend-chip').forEach(el => {
                el.classList.toggle('active', el.dataset.f === (state.chFilter || 'all'));
            });

            const filtered = state.channels.filter(ch => {
                if (state.chFilter === 'invest') return isInvest(ch);
                if (state.chFilter === 'cash') return !isInvest(ch);
                if (state.chFilter && state.chFilter !== 'all') return ch.type === state.chFilter;
                return true;
            });

            const grid = document.getElementById('channelGrid');
            if (filtered.length === 0) {
                const hint = state.channels.length === 0
                    ? '还没有资金渠道，点击"新增渠道"添加<br>如：银行卡、支付宝、微信、基金、股票、电子卡等'
                    : (state.chFilter === 'invest' ? '还没有投资类渠道（积存金/纳指/基金/股票）'
                        : (state.chFilter && state.chFilter !== 'all' && state.chFilter !== 'cash' ? '该类型下暂无渠道' : '还没有资金类渠道'));
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1;">
                        <div class="emoji">${state.chFilter === 'invest' ? '📈' : '🏦'}</div>
                        <p>${hint}</p>
                    </div>`;
                return;
            }

            const keys = getMonthKeys();
            const lastKey = keys[keys.length-1];
            const lastSnap = snapshotOf(lastKey);
            const prevKey = keys[keys.length-2];
            const prevSnap = snapshotOf(prevKey);

            grid.innerHTML = filtered.map(ch => {
                const bal = lastSnap && lastSnap.balances[ch.id] != null ? Number(lastSnap.balances[ch.id]) : null;
                const prevBal = prevSnap && prevSnap.balances[ch.id] != null ? Number(prevSnap.balances[ch.id]) : null;
                const diff = (bal !== null && prevBal !== null) ? bal - prevBal : null;
                const trendHtml = diff !== null
                    ? `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${fmtShort(Math.abs(diff))}</span> 较上次记录`
                    : '<span style="color:#9ca3af;">暂无对比</span>';

                // 投资收益（投资类渠道，已填成本且有最新净值时显示）
                let profitHtml = '';
                if (isInvest(ch) && bal !== null) {
                    const cost = Number(ch.cost) || 0;
                    if (cost > 0) {
                        const p = bal - cost;
                        const rate = p / cost * 100;
                        const cls = p >= 0 ? 'up' : 'down';
                        profitHtml = `<div class="ch-profit ${cls}">📈 ${p >= 0 ? '+' : '-'}${fmtMoney(Math.abs(p))}（${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%）</div>`;
                    }
                }

                // linked debts for this channel
                const linkedDebts = state.debts.filter(d => d.channelId === ch.id);
                const linkedTotal = linkedDebts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
                const debtHtml = linkedTotal > 0
                    ? `<div class="ch-debt">📉 欠款 ${fmtMoney(linkedTotal)}（${linkedDebts.length} 项）</div>`
                    : '';

                // 更新时间
                const updLabel = channelUpdatedLabel(ch);
                const updHtml = updLabel ? `<div class="ch-updated">🕒 更新于 ${updLabel}</div>` : '';

                return `
                    <div class="channel-card" data-id="${ch.id}" draggable="true" onclick="openChannelModal('${ch.id}')" title="点击编辑，按住拖动排序">
                        <div class="ch-actions" onclick="event.stopPropagation()">
                            <span class="drag-handle" title="拖动排序">⠿</span>
                            <button class="icon-btn" draggable="false" onclick="deleteChannel('${ch.id}')" title="删除">🗑️</button>
                        </div>
                        <div class="ch-top">
                            <span class="ch-icon" style="background:${ch.color}1a;">${typeIconOf(ch.type)}</span>
                            <span class="ch-name">${ch.name}</span>
                        </div>
                        <div class="ch-balance" style="color:${bal !== null && bal < 0 ? 'var(--danger)' : 'var(--text)'}">
                            ${bal !== null ? fmtMoney(bal) : '—'}
                        </div>
                        <div class="ch-trend">${trendHtml}</div>
                        ${profitHtml}
                        ${debtHtml}
                        ${updHtml}
                    </div>`;
            }).join('');

            initChannelDrag();
        }

        // 渠道拖拽排序（拖动卡片调整显示顺序，保存到 channels 数组）
        function initChannelDrag() {
            document.querySelectorAll('.channel-card[draggable="true"]').forEach(card => {
                card.addEventListener('dragstart', e => {
                    card.classList.add('dragging');
                    try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (_) {}
                    e.dataTransfer.effectAllowed = 'move';
                });
                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    document.querySelectorAll('.channel-card.drop-target').forEach(c => c.classList.remove('drop-target'));
                });
                card.addEventListener('dragover', e => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    document.querySelectorAll('.channel-card.drop-target').forEach(c => c.classList.remove('drop-target'));
                    card.classList.add('drop-target');
                });
                card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
                card.addEventListener('drop', e => {
                    e.preventDefault();
                    card.classList.remove('drop-target');
                    const fromId = e.dataTransfer.getData('text/plain') || card.dataset.id;
                    const toId = card.dataset.id;
                    if (!fromId || fromId === toId) return;
                    const fromIdx = state.channels.findIndex(c => c.id === fromId);
                    const toIdx = state.channels.findIndex(c => c.id === toId);
                    if (fromIdx < 0 || toIdx < 0) return;
                    const [moved] = state.channels.splice(fromIdx, 1);
                    const insertAt = state.channels.findIndex(c => c.id === toId);
                    state.channels.splice(insertAt, 0, moved);
                    save(); renderAll();
                    showToast('渠道顺序已更新', 'success');
                });
            });
        }

        // ================= Debts =================
        function renderDebtChannelOptions() {
            const select = document.getElementById('debtChannel');
            select.innerHTML = '<option value="">不关联</option>' +
                state.channels.map(c => `<option value="${c.id}">${typeIconOf(c.type)} ${c.name}</option>`).join('');
        }

        function openDebtModal(id) {
            editingDebtId = id || null;
            renderDebtChannelOptions();
            document.getElementById('debtModalTitle').textContent = id ? '编辑欠款' : '新增欠款';
            if (id) {
                const d = state.debts.find(x => x.id === id);
                document.getElementById('debtName').value = d.name;
                document.getElementById('debtType').value = d.type;
                document.getElementById('debtAmount').value = d.amount;
                document.getElementById('debtChannel').value = d.channelId || '';
                document.getElementById('debtNote').value = d.note || '';
            } else {
                document.getElementById('debtName').value = '';
                document.getElementById('debtType').value = '货款';
                document.getElementById('debtAmount').value = '0';
                document.getElementById('debtChannel').value = '';
                document.getElementById('debtNote').value = '';
            }
            document.getElementById('debtModal').classList.add('active');
            setTimeout(() => document.getElementById('debtName').focus(), 100);
        }
        function closeDebtModal() {
            document.getElementById('debtModal').classList.remove('active');
            editingDebtId = null;
        }
        function saveDebt() {
            const name = document.getElementById('debtName').value.trim();
            const type = document.getElementById('debtType').value;
            const amount = parseFloat(document.getElementById('debtAmount').value) || 0;
            const channelId = document.getElementById('debtChannel').value || null;
            const note = document.getElementById('debtNote').value.trim();

            if (!name) { showToast('请输入欠款名称', 'error'); return; }
            if (amount < 0) { showToast('金额不能为负', 'error'); return; }

            if (editingDebtId) {
                const d = state.debts.find(x => x.id === editingDebtId);
                d.name = name; d.type = type; d.amount = amount;
                d.channelId = channelId; d.note = note;
                showToast('欠款已更新', 'success');
            } else {
                state.debts.push({ id: 'debt_' + Date.now(), name, type, amount, channelId, note });
                showToast('欠款已添加', 'success');
            }

            // Sync latest snapshot debt total with current debt sum
            const keys = getMonthKeys();
            if (keys.length > 0) {
                const lastKey = keys[keys.length-1];
                const snap = snapshotOf(lastKey);
                if (snap) snap.debts = currentDebtsTotal();
            }

            save(); renderAll(); closeDebtModal();
        }
        function deleteDebt(id) {
            const d = state.debts.find(x => x.id === id);
            if (!d) return;
            showConfirm('删除欠款', `确定删除欠款"${d.name}"（¥${(Number(d.amount)||0).toFixed(2)}）吗？`, () => {
                state.debts = state.debts.filter(x => x.id !== id);
                const keys = getMonthKeys();
                if (keys.length > 0) {
                    const snap = snapshotOf(keys[keys.length-1]);
                    if (snap) snap.debts = currentDebtsTotal();
                }
                save(); renderAll();
                showToast('欠款已删除', 'success');
            });
        }

        function renderDebts() {
            const list = document.getElementById('debtList');
            const box = document.getElementById('debtTotalBox');
            const total = currentDebtsTotal();

            if (state.debts.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="emoji">📉</div>
                        <p>还没有欠款记录<br>如：应付货款、供应商借款、花呗、信用卡等</p>
                    </div>`;
                box.style.display = 'none';
                return;
            }

            box.style.display = 'flex';
            document.getElementById('debtTotalVal').textContent = fmtMoney(total);

            list.innerHTML = state.debts.map(d => {
                const ch = state.channels.find(c => c.id === d.channelId);
                return `
                    <div class="debt-item">
                        <div class="debt-icon">${DEBT_ICONS[d.type] || '📦'}</div>
                        <div class="debt-info">
                            <div class="name">${d.name} <span class="tag">${d.type}</span></div>
                            <div class="meta">${ch ? typeIconOf(ch.type) + ' ' + ch.name : '未关联渠道'}${d.note ? ' · ' + d.note : ''}</div>
                        </div>
                        <div class="debt-amount">${fmtMoney(d.amount)}</div>
                        <button class="icon-btn" onclick="openDebtModal('${d.id}')" title="编辑">✏️</button>
                        <button class="icon-btn" onclick="deleteDebt('${d.id}')" title="删除">🗑️</button>
                    </div>`;
            }).join('');
        }

        // ================= Snapshot Form =================
        function renderSnapshotForm() {
            const list = document.getElementById('snapshotList');
            if (state.channels.length === 0) {
                list.innerHTML = `<div class="empty-state"><div class="emoji">📸</div><p>添加渠道后，这里会出现余额填写框</p></div>`;
                return;
            }
            if (!document.getElementById('snapDate').value) {
                document.getElementById('snapDate').value = todayYMD();
            }
            const key = document.getElementById('snapDate').value;
            const snap = snapshotOf(key);
            const sameMonth = state.snapshots.filter(s => monthOf(s.key) === monthOf(key));
            const monthLast = sameMonth.length ? [...sameMonth].sort((a,b) => a.key < b.key ? -1 : 1).pop() : null;

            let html = '';
            if (snap) {
                html += `<div class="modal-note" style="color:var(--primary);">📌 该日期已有快照，保存将${document.getElementById('snapMode').value === 'replace' ? '整日覆盖' : '只填空白'}</div>`;
            } else if (monthLast && monthLast.key !== key) {
                html += `<div class="modal-note" style="color:var(--text-secondary);">该月已有 ${sameMonth.length} 条记录（最近 ${fmtSnapKey(monthLast.key)}），保存后新增一条</div>`;
            }
            const recent = lastSnap();
            if (!snap && recent && Object.keys(recent.balances || {}).length > 0) {
                html += `<div class="modal-note" style="color:var(--text-secondary);">✨ 已自动预填上次记录（${fmtSnapKey(recent.key)}）的余额，可直接修改</div>`;
            }

            html += state.channels.map(ch => {
                let val = snap && snap.balances[ch.id] != null ? snap.balances[ch.id] : '';
                if (val === '' && recent && recent.balances[ch.id] != null) val = recent.balances[ch.id];
                return `
                    <div class="snapshot-row">
                        <span class="ch-label" style="color:${ch.color};">
                            <span>${typeIconOf(ch.type)}</span> ${ch.name}
                        </span>
                        <input type="text" class="snap-input" data-id="${ch.id}" placeholder="0.00" inputmode="decimal" value="${val}" oninput="filterMoney(this)">
                    </div>`;
            }).join('');

            // debt input
            const debtVal = snap && snap.debts != null ? snap.debts : currentDebtsTotal();
            html += `
                <div class="snapshot-debt-box">
                    <div class="snapshot-row">
                        <span class="ch-label" style="color:var(--danger);">
                            <span>📉</span> 欠款合计
                        </span>
                        <input type="text" id="snapDebt" placeholder="0.00" inputmode="decimal" value="${debtVal}" oninput="filterMoney(this)">
                    </div>
                    <div class="modal-note">默认取欠款管理中的合计，可手动调整当月实际欠款</div>
                </div>`;

            list.innerHTML = html;
        }

        function saveSnapshot() {
            if (state.channels.length === 0) { showToast('请先添加渠道', 'error'); return; }
            const key = document.getElementById('snapDate').value;
            if (!key) { showToast('请选择日期', 'error'); return; }
            const mode = document.getElementById('snapMode').value;

            let snap = snapshotOf(key);
            if (!snap) {
                snap = { key, balances: {} };
                state.snapshots.push(snap);
            }

            document.querySelectorAll('.snap-input').forEach(input => {
                const id = input.dataset.id;
                const val = input.value;
                const touched = mode === 'replace' || (snap.balances[id] == null && val !== '');
                if (mode === 'replace') {
                    snap.balances[id] = val === '' ? 0 : parseFloat(val);
                } else {
                    if (snap.balances[id] == null && val !== '') {
                        snap.balances[id] = parseFloat(val);
                    }
                }
                // 该渠道余额被本次保存覆盖/填入了，刷新它的更新时间
                if (touched) {
                    const ch = state.channels.find(c => c.id === id);
                    if (ch) ch.updatedAt = new Date().toISOString();
                }
            });

            const debtInput = document.getElementById('snapDebt');
            if (debtInput) {
                snap.debts = debtInput.value === '' ? currentDebtsTotal() : parseFloat(debtInput.value);
            }

            snap.updatedAt = new Date().toISOString();
            save(); renderAll();
            showToast(`已保存 ${key} 快照`, 'success');
        }

        // ================= Data Tables =================
        function switchView(view) {
            state.view = view;
            document.getElementById('tabMonth').classList.toggle('active', view === 'month');
            document.getElementById('tabYear').classList.toggle('active', view === 'year');
            document.getElementById('tabTrend').classList.toggle('active', view === 'trend');
            document.getElementById('viewMonth').style.display = view === 'month' ? '' : 'none';
            document.getElementById('viewYear').style.display = view === 'year' ? '' : 'none';
            document.getElementById('viewTrend').style.display = view === 'trend' ? '' : 'none';
            renderCurrentView();
        }

        function shiftMonth(delta) {
            const d = new Date(state.currentMonth + '-01');
            d.setMonth(d.getMonth() + delta);
            state.currentMonth = getYM(d);
            renderMonthTable();
        }
        function shiftYear(delta) { state.currentYear += delta; renderYearTable(); }
        function shiftTrendYear(delta) { state.trendYear += delta; renderTrendTable(); }
        function renderCurrentView() {
            if (state.view === 'month') renderMonthTable();
            else if (state.view === 'year') renderYearTable();
            else renderTrendTable();
        }

        function renderMonthTable() {
            document.getElementById('monthTitle').textContent = state.currentMonth;
            const table = document.getElementById('monthTable');
            const snap = monthSnapOf(state.currentMonth);

            if (!snap || Object.keys(snap.balances || {}).length === 0) {
                table.innerHTML = `<tr><td style="text-align:center; padding:30px; color:var(--text-secondary);">该月暂无快照数据<br><small>在左侧"资金快照"中选择 ${state.currentMonth} 的日期记录</small></td></tr>`;
                renderMonthChart();
                return;
            }

            const dateLine = `<div class="modal-note" style="margin-bottom:10px;">📅 本月最后记录：<b>${fmtSnapKey(snap.key)}</b>${snap.key.length >= 10 ? `（${snap.key}）` : ''}</div>`;

            const [y, m] = state.currentMonth.split('-').map(Number);
            const prevDate = new Date(y, m - 2, 1);
            const prevKey = getYM(prevDate);
            const prevSnap = monthSnapOf(prevKey);

            let rows = state.channels.map(ch => {
                const bal = snap.balances[ch.id];
                if (bal == null) return '';
                const prevBal = prevSnap && prevSnap.balances[ch.id] != null ? Number(prevSnap.balances[ch.id]) : null;
                const diff = prevBal !== null ? Number(bal) - prevBal : null;
                return `
                    <tr>
                        <td><span style="margin-right:6px;">${typeIconOf(ch.type)}</span>${ch.name}</td>
                        <td class="num cell-amount">${fmtMoney(bal)}</td>
                        <td class="num ${diff !== null && diff >= 0 ? 'cell-amount pos' : (diff !== null && diff < 0 ? 'cell-amount neg' : '')}">
                            ${diff !== null ? fmtMoney(diff, true) : '—'}
                        </td>
                        <td class="num">${prevBal !== null ? fmtMoney(prevBal) : '—'}</td>
                    </tr>`;
            }).join('');

            const total = totalOf(snap);
            const debt = debtOf(snap);
            const net = total - (debt || 0);
            const prevTotal = prevSnap ? totalOf(prevSnap) : null;
            const prevDebt = prevSnap ? debtOf(prevSnap) : null;
            const prevNet = (prevTotal !== null && prevDebt !== null) ? prevTotal - prevDebt : null;
            const diffNet = prevNet !== null ? net - prevNet : null;
            const diffDebt = prevDebt !== null && debt !== null ? debt - prevDebt : null;

            table.innerHTML = `
                ${dateLine}
                <thead>
                    <tr>
                        <th>项目</th>
                        <th class="num">本月</th>
                        <th class="num">较上月</th>
                        <th class="num">上月</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr class="row-total">
                        <td>总资产</td>
                        <td class="num">${fmtMoney(total)}</td>
                        <td class="num ${prevTotal !== null && total - prevTotal >= 0 ? 'pos' : (prevTotal !== null && total - prevTotal < 0 ? 'neg' : '')}">
                            ${prevTotal !== null ? fmtMoney(total - prevTotal, true) : '—'}
                        </td>
                        <td class="num">${prevTotal !== null ? fmtMoney(prevTotal) : '—'}</td>
                    </tr>
                    <tr class="row-debt">
                        <td>总欠款</td>
                        <td class="num">${debt !== null ? fmtMoney(debt) : '—'}</td>
                        <td class="num">${diffDebt !== null ? fmtMoney(diffDebt, true) : '—'}</td>
                        <td class="num">${prevDebt !== null ? fmtMoney(prevDebt) : '—'}</td>
                    </tr>
                    <tr class="row-net">
                        <td>净资产</td>
                        <td class="num">${fmtMoney(net)}</td>
                        <td class="num ${diffNet !== null && diffNet >= 0 ? 'pos' : (diffNet !== null && diffNet < 0 ? 'neg' : '')}">
                            ${diffNet !== null ? fmtMoney(diffNet, true) : '—'}
                        </td>
                        <td class="num">${prevNet !== null ? fmtMoney(prevNet) : '—'}</td>
                    </tr>
                </tbody>`;
            renderMonthChart();
        }

        function renderYearTable() {
            const year = state.currentYear;
            document.getElementById('yearTitle').textContent = year + ' 年';
            const table = document.getElementById('yearTable');

            const months = [];
            for (let m = 1; m <= 12; m++) {
                const key = ymd(year, m);
                const snap = monthSnapOf(key);
                months.push({ key, snap, total: totalOf(snap), debt: debtOf(snap), net: netOf(snap) });
            }
            const hasData = months.some(x => x.net !== null);
            if (!hasData) {
                table.innerHTML = `<tr><td style="text-align:center; padding:30px; color:var(--text-secondary);">${year} 年暂无数据</td></tr>`;
                renderYearChart();
                return;
            }

            const firstIdx = months.findIndex(x => x.net !== null);
            const lastIdx = months.length - 1 - [...months].reverse().findIndex(x => x.net !== null);
            const startNet = months[firstIdx].net;
            const endNet = months[lastIdx].net;
            const change = endNet - startNet;
            const rate = startNet > 0 ? (change / startNet) * 100 : null;

            let rows = '';
            let prevNet = null;
            months.forEach(({ key, snap, total, debt, net }) => {
                if (net === null) return;
                const diff = prevNet !== null ? net - prevNet : null;
                rows += `
                    <tr>
                        <td>${key}${snap && snap.key.length >= 10 ? `<span style="color:var(--text-secondary);font-size:11px;"> (${fmtSnapKey(snap.key)})</span>` : ''}</td>
                        <td class="num cell-amount">${fmtMoney(net)}</td>
                        <td class="num">${debt !== null ? fmtMoney(debt) : '—'}</td>
                        <td class="num">${fmtMoney(total)}</td>
                        <td class="num ${diff !== null && diff >= 0 ? 'pos' : (diff !== null && diff < 0 ? 'neg' : '')}">
                            ${diff !== null ? fmtMoney(diff, true) : '—'}
                        </td>
                    </tr>`;
                prevNet = net;
            });

            table.innerHTML = `
                <div style="background:#f8fafc; border:1.5px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:14px; font-size:13px;">
                    <span style="font-weight:600;">年初净资产（${months[firstIdx].key}）→ 年末净资产（${months[lastIdx].key}）：</span>
                    <span class="${change >= 0 ? 'up' : 'down'}" style="font-weight:700; font-size:15px;">${fmtMoney(change, true)}</span>
                    ${rate !== null ? `<span class="${rate >= 0 ? 'up' : 'down'}">（${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%）</span>` : ''}
                </div>
                <thead>
                    <tr>
                        <th>月份</th>
                        <th class="num">净资产</th>
                        <th class="num">欠款</th>
                        <th class="num">总资产</th>
                        <th class="num">环比变动</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>`;
            renderYearChart();
        }

        function renderTrendTable() {
            const year = state.trendYear;
            document.getElementById('trendYearTitle').textContent = year + ' 年';
            const table = document.getElementById('trendTable');

            const months = [];
            for (let m = 1; m <= 12; m++) {
                const key = ymd(year, m);
                const snap = monthSnapOf(key);
                months.push({ key, snap, net: netOf(snap) });
            }
            const hasData = months.some(x => x.net !== null);
            if (!hasData) {
                table.innerHTML = `<tr><td style="text-align:center; padding:30px; color:var(--text-secondary);">${year} 年暂无数据</td></tr>`;
                return;
            }

            const firstIdx = months.findIndex(x => x.net !== null);
            const base = months[firstIdx].net;
            let rows = '';
            let prevNet = null;
            months.forEach(({ key, snap, net }) => {
                if (net === null) return;
                const diff = prevNet !== null ? net - prevNet : null;
                const cum = net - base;
                const cumRate = base > 0 ? (cum / base) * 100 : null;
                rows += `
                    <tr>
                        <td>${key}${snap && snap.key.length >= 10 ? `<span style="color:var(--text-secondary);font-size:11px;"> (${fmtSnapKey(snap.key)})</span>` : ''}</td>
                        <td class="num cell-amount">${fmtMoney(net)}</td>
                        <td class="num ${diff !== null && diff >= 0 ? 'pos' : (diff !== null && diff < 0 ? 'neg' : '')}">
                            ${diff !== null ? fmtMoney(diff, true) : '—'}
                        </td>
                        <td class="num ${cum >= 0 ? 'pos' : 'neg'}">${fmtMoney(cum, true)}</td>
                        <td class="num ${cumRate !== null && cumRate >= 0 ? 'pos' : (cumRate !== null && cumRate < 0 ? 'neg' : '')}">
                            ${cumRate !== null ? (cumRate >= 0 ? '+' : '') + cumRate.toFixed(2) + '%' : '—'}
                        </td>
                    </tr>`;
                prevNet = net;
            });

            table.innerHTML = `
                <div style="background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:10px; padding:12px 16px; margin-bottom:14px; font-size:13px;">
                    <span style="font-weight:600;">以净资产为准</span>
                    <span style="color:var(--text-secondary); margin-left:8px;">首个记录月（${months[firstIdx].key}）为基准，看后续每月累计增长</span>
                </div>
                <thead>
                    <tr>
                        <th>月份</th>
                        <th class="num">净资产</th>
                        <th class="num">环比变动</th>
                        <th class="num">累计增长</th>
                        <th class="num">累计增幅</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>`;
        }

        // ================= Growth Curve =================
        function renderCurve() {
            const keys = getMonthKeys();
            if (keys.length === 0) {
                renderLegend();
                renderChart(keys);
                return;
            }
            renderLegend();
            renderChart(keys);
        }

        function renderLegend() {
            const box = document.getElementById('curveLegend');
            box.innerHTML = `
                <div class="legend-chip ${state.hiddenChannels.has('__net__') ? 'off' : ''}" onclick="toggleSeries('__net__')">
                    <span class="dot" style="background:#059669;"></span> 净资产
                </div>
                <div class="legend-chip ${state.hiddenChannels.has('__total__') ? 'off' : ''}" onclick="toggleSeries('__total__')">
                    <span class="dot" style="background:${isDarkChart() ? '#f9fafb' : '#111827'};"></span> 总资产
                </div>
                <div class="legend-chip ${state.hiddenChannels.has('__debt__') ? 'off' : ''}" onclick="toggleSeries('__debt__')">
                    <span class="dot" style="background:#ef4444;"></span> 欠款
                </div>`;
        }

        function toggleSeries(id) {
            if (state.hiddenChannels.has(id)) state.hiddenChannels.delete(id);
            else state.hiddenChannels.add(id);
            renderCurve();
        }

        // 通用折线图数据集（接收 snap 对象数组，元素可为 null/undefined）
        function buildLineDatasets(snaps) {
            const datasets = [];
            const totalColor = isDarkChart() ? '#f9fafb' : '#111827';
            if (!state.hiddenChannels.has('__net__')) {
                datasets.push({
                    label: '净资产', data: snaps.map(s => netOf(s)),
                    borderColor: '#059669', backgroundColor: '#059669',
                    borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#059669', tension: 0.35, spanGaps: true
                });
            }
            if (!state.hiddenChannels.has('__total__')) {
                datasets.push({
                    label: '总资产', data: snaps.map(s => totalOf(s)),
                    borderColor: totalColor, backgroundColor: totalColor,
                    borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: totalColor, tension: 0.35, spanGaps: true
                });
            }
            if (!state.hiddenChannels.has('__debt__')) {
                datasets.push({
                    label: '欠款', data: snaps.map(s => debtOf(s)),
                    borderColor: '#ef4444', backgroundColor: '#ef4444',
                    borderWidth: 2, borderDash: [6, 4], pointRadius: 3, pointBackgroundColor: '#ef4444', tension: 0.35, spanGaps: true
                });
            }
            return datasets;
        }

        function renderChart(keys) {
            const ctx = document.getElementById('curveChart');
            if (curveChart) curveChart.destroy();
            const snaps = keys.map(k => snapshotOf(k));
            const datasets = buildLineDatasets(snaps);
            curveChart = new Chart(ctx, {
                type: 'line',
                data: { labels: keys, datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (item) => privMode ? `${item.dataset.label}: ••••` : `${item.dataset.label}: ${fmtMoney(item.parsed.y)}` } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => keys[v] ? fmtSnapKey(keys[v]) : '' } },
                        y: { grid: { color: isDarkChart() ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => privMode ? '••••' : fmtShort(v) } }
                    }
                }
            });
        }

        // ================= History Charts (Month / Year) =================
        function renderMonthChart() {
            const ym = state.currentMonth;
            const ctx = document.getElementById('monthChart');
            if (!ctx) return;
            if (monthChart) { monthChart.destroy(); monthChart = null; }
            const snaps = state.snapshots.filter(s => monthOf(s.key) === ym).sort((a, b) => a.key < b.key ? -1 : 1);
            if (snaps.length === 0) return;
            const labels = snaps.map(s => fmtSnapKey(s.key));
            const datasets = buildLineDatasets(snaps);
            monthChart = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => privMode ? `${item.dataset.label}: ••••` : `${item.dataset.label}: ${fmtMoney(item.parsed.y)}` } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                        y: { grid: { color: isDarkChart() ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => privMode ? '••••' : fmtShort(v) } }
                    }
                }
            });
        }

        function renderYearChart() {
            const year = state.currentYear;
            const ctx = document.getElementById('yearChart');
            if (!ctx) return;
            if (yearChart) { yearChart.destroy(); yearChart = null; }
            const snaps = [];
            const labels = [];
            for (let m = 1; m <= 12; m++) {
                labels.push(m + '月');
                snaps.push(monthSnapOf(ymd(year, m)));
            }
            const datasets = buildLineDatasets(snaps);
            yearChart = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => privMode ? `${item.dataset.label}: ••••` : `${item.dataset.label}: ${fmtMoney(item.parsed.y)}` } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                        y: { grid: { color: isDarkChart() ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => privMode ? '••••' : fmtShort(v) } }
                    }
                }
            });
        }

        // ================= Render All =================
        function renderAll() {
            renderSummary();
            renderInvest();
            renderChannels();
            renderDebts();
            renderSnapshotForm();
            renderCurrentView();
            renderCurve();
        }

        // ================= Confirm Modal =================
        function showConfirm(title, message, callback) {
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            confirmCallback = callback;
            document.getElementById('confirmModal').classList.add('active');
        }
        function closeConfirmModal() {
            document.getElementById('confirmModal').classList.remove('active');
            document.getElementById('confirmBtnMerge').style.display = 'none';
            document.getElementById('confirmBtn').textContent = '确认';
            confirmCallback = null;
        }
        document.getElementById('confirmBtn').addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            closeConfirmModal();
        });

        // ================= Events =================
        document.getElementById('snapDate').addEventListener('change', renderSnapshotForm);
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { closeChannelModal(); closeDebtModal(); closeConfirmModal(); }
        });

        // ================= Lock Screen =================
        const PIN_KEY = 'fund_tracker_pin';
        const PIN_SALT = 'fund-tracker::pin::v1';
        let lockState = 'unlock';   // setup | unlock | change-old | change-new

        async function hashPin(pin) {
            const str = PIN_SALT + ':' + pin;
            if (window.crypto && crypto.subtle && crypto.subtle.digest) {
                try {
                    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
                    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
                } catch (e) { /* 降级到下方算法 */ }
            }
            // cyrb53 双轮哈希（兼容 file:// 等非安全上下文）
            let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0xdeadbeef, h4 = 0x41c6ce57;
            for (let i = 0; i < str.length; i++) {
                const ch = str.charCodeAt(i);
                h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
                h3 = Math.imul(h3 ^ ch, 2246822519); h4 = Math.imul(h4 ^ ch, 3266489917);
            }
            h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
            h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
            h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
            return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0].map(n => n.toString(16).padStart(8, '0')).join('');
        }

        function renderLock() {
            const title = document.getElementById('lockTitle');
            const sub = document.getElementById('lockSub');
            const second = document.getElementById('lockSecondField');
            const btn = document.getElementById('lockBtn');
            const links = document.getElementById('lockLinks');
            const pin1 = document.getElementById('lockPin');
            const pin2 = document.getElementById('lockPin2');
            setLockErr('');
            pin1.value = ''; pin2.value = '';
            switch (lockState) {
                case 'setup':
                    title.textContent = '设置密码';
                    sub.textContent = '首次使用，请设置一个进入锁屏的密码';
                    second.style.display = 'block';
                    btn.textContent = '🔒 设置并进入';
                    pin1.placeholder = '设置密码（至少 4 位）';
                    links.style.display = 'none';
                    break;
                case 'change-old':
                    title.textContent = '修改密码';
                    sub.textContent = '请先输入当前密码验证身份';
                    second.style.display = 'none';
                    btn.textContent = '下一步';
                    pin1.placeholder = '当前密码';
                    links.style.display = 'none';
                    break;
                case 'change-new':
                    title.textContent = '设置新密码';
                    sub.textContent = '请输入新密码（至少 4 位）';
                    second.style.display = 'block';
                    btn.textContent = '✅ 保存新密码';
                    pin1.placeholder = '新密码（至少 4 位）';
                    links.style.display = 'none';
                    break;
                default:
                    title.textContent = '输入密码';
                    sub.textContent = '请输入锁屏密码以进入';
                    second.style.display = 'none';
                    btn.textContent = '🔓 进入';
                    pin1.placeholder = '密码';
                    links.style.display = 'flex';
            }
            setTimeout(() => { try { pin1.focus(); } catch (e) {} }, 80);
        }

        function setLockErr(msg, type) {
            const el = document.getElementById('lockErr');
            el.textContent = msg;
            el.classList.toggle('ok', type === 'ok');
            if (msg && type !== 'ok') {
                const card = document.getElementById('lockCard');
                card.classList.remove('lock-shake');
                void card.offsetWidth;
                card.classList.add('lock-shake');
            }
        }

        function toggleLockEye() {
            const inp = document.getElementById('lockPin');
            inp.type = inp.type === 'password' ? 'text' : 'password';
            document.getElementById('lockEye').textContent = inp.type === 'password' ? '👁' : '🙈';
        }

        function unlockApp() {
            document.getElementById('lockScreen').style.display = 'none';
            document.body.style.overflow = '';
            try { document.getElementById('lockPin').blur(); } catch (e) {}
        }

        function lockNow() {
            lockState = 'unlock';
            renderLock();
            document.getElementById('lockScreen').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function startChangeLock() {
            if (!localStorage.getItem(PIN_KEY) || lockState !== 'unlock') return;
            lockState = 'change-old';
            renderLock();
        }

        async function submitLock() {
            const btn = document.getElementById('lockBtn');
            if (btn.dataset.busy) return;
            const pin = document.getElementById('lockPin').value;
            const stored = localStorage.getItem(PIN_KEY);

            if (lockState === 'setup' || lockState === 'change-new') {
                if (pin.length < 4) return setLockErr('密码至少 4 位');
                if (pin !== document.getElementById('lockPin2').value) return setLockErr('两次输入的密码不一致');
                btn.dataset.busy = '1'; btn.textContent = '⏳ 保存中…';
                try {
                    localStorage.setItem(PIN_KEY, await hashPin(pin));
                    setLockErr('✅ 密码已保存', 'ok');
                    setTimeout(unlockApp, 350);
                } finally { btn.dataset.busy = ''; }
                return;
            }

            if (lockState === 'change-old') {
                btn.dataset.busy = '1'; btn.textContent = '⏳ 验证中…';
                try {
                    const h = await hashPin(pin);
                    if (h === stored) {
                        lockState = 'change-new';
                        renderLock();
                    } else {
                        document.getElementById('lockPin').value = '';
                        setLockErr('当前密码不正确，请重试');
                    }
                } finally { btn.dataset.busy = ''; }
                return;
            }

            // unlock
            btn.dataset.busy = '1'; btn.textContent = '⏳ 验证中…';
            try {
                const h = await hashPin(pin);
                if (h === stored) {
                    setLockErr('');
                    unlockApp();
                } else {
                    document.getElementById('lockPin').value = '';
                    setLockErr('密码错误，请重试');
                }
            } finally { btn.dataset.busy = ''; btn.textContent = '🔓 进入'; }
        }

        function forgotLock() {
            if (!confirm('忘记密码将清除本机保存的全部数据（渠道、欠款、快照、报表），并重新设置密码，且无法恢复。\n\n确定继续吗？')) return;
            if (!confirm('再次确认：此操作不可恢复！确定要清空全部数据？')) return;
            localStorage.removeItem(PIN_KEY);
            localStorage.removeItem('fund_tracker_data');
            location.reload();
        }

        function lockInit() {
            const hasPin = !!localStorage.getItem(PIN_KEY);
            lockState = hasPin ? 'unlock' : 'setup';
            renderLock();
            document.body.style.overflow = 'hidden';
            document.getElementById('lockPin').addEventListener('keydown', e => { if (e.key === 'Enter') submitLock(); });
            document.getElementById('lockPin2').addEventListener('keydown', e => { if (e.key === 'Enter') submitLock(); });
        }

        // ================= Init =================
        applyTheme(localStorage.getItem('fund_tracker_theme') || 'light');
        load();
        applyTitle();
        bindTitleEvents();
        applySectionTitles();
        bindSectionTitles();
        renderAll();
        lockInit();
