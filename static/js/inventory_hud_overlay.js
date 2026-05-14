/**
 * HeroVideoHudOverlay — render inventory (bottom-left) + chat (bottom-right)
 * over a hero <video>, mirroring the bot's recorded events.
 *
 * Style + DOM structure are lifted verbatim from hero_preview_v2.html's
 * `.mc-inventory` and `.mc-chat` panels so the standalone hero video
 * matches the existing synced-3-panel preview's register.
 *
 * Why a DOM overlay (not baked into the MP4):
 *   ReplayMod's VideoRenderer nulls every global MC reference inside its
 *   frame-capture pipeline — confirmed via diagnostic mixin. So
 *   InGameHud.render() returns immediately because mc.player == null. The
 *   only path to "video shows the bot's hotbar" is to overlay the HUD
 *   client-side from a per-frame event timeline.
 *
 * Data shape (one JSON file per video):
 *     {
 *       "total_duration_ms": 1462000,
 *       "events": [
 *         {"t_ms": 0,    "kind": "skillStart", "inventory": {}},
 *         {"t_ms": 1234, "kind": "onChat", "chat": "ensureLogs: target 4"},
 *         {"t_ms": 1500, "inventory": {"oak_log": 1}},
 *         ...
 *       ]
 *     }
 *   `inventory` snapshots and `onChat` lines may share or interleave time
 *   stamps. Inventory is always the FULL snapshot at that moment.
 *
 * Usage:
 *     new HeroVideoHudOverlay(document.querySelector('video.hero'), {
 *         dataUrl: 'static/data/hero_events_v5.json',
 *     });
 */

(function (global) {
    'use strict';

    /**
     * Hash an item name to a deterministic palette color (same algorithm
     * as hero_preview_v2.html#inventoryItemColor so the same item gets
     * the same chip color across both views).
     */
    function inventoryItemColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) {
            h = (h * 31 + name.charCodeAt(i)) >>> 0;
        }
        const palette = ["#7d4f4f", "#8a7d4f", "#5b8a4f", "#4f6e8a", "#6b5b8a",
                         "#a36b5b", "#8a7a4f", "#5b9b9b", "#a3886b"];
        return palette[h % palette.length];
    }

    /**
     * Classify a chat line into one of (success / fail / task / skill) so
     * the CSS can color it. Heuristics match the existing renderChatOverlay.
     */
    function classifyChat(line) {
        if (line.includes('Success')) return 'success';
        if (line.includes('fail') || line.startsWith('Error')) return 'fail';
        if (line.startsWith('Attempt') || line.includes('starting')) return 'task';
        return 'skill';
    }

    class HeroVideoHudOverlay {
        constructor(videoEl, opts) {
            opts = opts || {};
            this.video = videoEl;
            this.events = null;             // sorted by t_ms ascending
            this.lastIndex = -1;
            this.lastInvJson = '';
            this.lastChatLen = 0;
            this._rafId = null;
            this._buildDom();

            fetch(opts.dataUrl)
                .then(r => r.json())
                .then(data => {
                    this.events = data.events || [];
                    if (!this.events.length) {
                        console.warn('[psn-hud] event timeline is empty');
                        return;
                    }
                    this._tick();
                })
                .catch(err => console.error('[psn-hud] load failed:', err));

            this.video.addEventListener('timeupdate', () => this._tick());
            this.video.addEventListener('seeked',     () => this._resetAndTick());
            this.video.addEventListener('play',       () => this._startRaf());
            this.video.addEventListener('pause',      () => this._stopRaf());
            this.video.addEventListener('ended',      () => this._stopRaf());
        }

        _buildDom() {
            const parent = this.video.parentElement;
            parent.classList.add('psn-hud-host');
            this.invPanel = document.createElement('div');
            this.invPanel.className = 'mc-inventory';
            this.chatPanel = document.createElement('div');
            this.chatPanel.className = 'mc-chat';
            parent.appendChild(this.invPanel);
            parent.appendChild(this.chatPanel);
        }

        _startRaf() {
            if (this._rafId) return;
            const loop = () => {
                this._tick();
                this._rafId = requestAnimationFrame(loop);
            };
            this._rafId = requestAnimationFrame(loop);
        }

        _stopRaf() {
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
        }

        _resetAndTick() {
            this.lastIndex = -1;
            this.lastInvJson = '';
            this.lastChatLen = 0;
            this._tick();
        }

        _tick() {
            if (!this.events) return;
            const tMs = this.video.currentTime * 1000;

            // Walk events linearly from start (chat is cumulative; inventory
            // is the latest snapshot ≤ tMs). Cap at lastIndex+forward-only
            // step since we usually move monotonically — when we don't (a
            // seek), the 'seeked' handler already reset.
            let inv = null;
            const chats = [];
            for (let i = 0; i < this.events.length; i++) {
                const e = this.events[i];
                if (e.t_ms > tMs) break;
                if (e.inventory !== undefined) inv = e.inventory;
                if (e.kind === 'onChat' && e.chat) {
                    chats.push({ t: e.t_ms, chat: e.chat });
                }
            }

            this._renderInventory(inv);
            this._renderChat(chats);
        }

        _renderInventory(inv) {
            const json = JSON.stringify(inv || {});
            if (json === this.lastInvJson) return;
            this.lastInvJson = json;
            const items = Object.entries(inv || {}).filter(([_, n]) => n > 0);
            if (!items.length) {
                this.invPanel.innerHTML =
                    '<span class="mc-inv-empty">inventory empty</span>';
                return;
            }
            this.invPanel.innerHTML = items.map(([name, count]) => {
                const c = inventoryItemColor(name);
                return `<span class="mc-inv-row">
                    <span class="mc-inv-icon" style="background:${c}"></span>
                    <span class="mc-inv-name">${name}</span>
                    <span class="mc-inv-count">×${count}</span>
                </span>`;
            }).join('');
        }

        _renderChat(chats) {
            if (chats.length === this.lastChatLen) return;
            this.lastChatLen = chats.length;
            if (!chats.length) {
                this.chatPanel.innerHTML =
                    '<div class="mc-chat-line is-task" style="opacity:0.55">no chat events</div>';
                return;
            }
            const wasAtBottom =
                (this.chatPanel.scrollHeight - this.chatPanel.scrollTop
                 - this.chatPanel.clientHeight) < 4;
            this.chatPanel.innerHTML = chats.map(L => {
                const tag = classifyChat(L.chat);
                return `<div class="mc-chat-line is-${tag}">${L.chat}</div>`;
            }).join('');
            if (wasAtBottom) this.chatPanel.scrollTop = this.chatPanel.scrollHeight;
        }
    }

    global.HeroVideoHudOverlay = HeroVideoHudOverlay;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = HeroVideoHudOverlay;
    }
})(typeof window !== 'undefined' ? window : this);
