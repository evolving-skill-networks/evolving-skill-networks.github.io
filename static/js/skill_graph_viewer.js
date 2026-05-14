// PSN Interactive Skill Graph Viewer
// Loads docs/website/data/skill_graph_v13.json, renders with Cytoscape,
// and shows a side-panel with code + norm V + metadata when a node is clicked.

(function () {
  const DATA_URL = "data/skill_graph_v13.json";

  // Per-graph min-max normalisation: raw V ∈ [V_min, V_max] of this snapshot
  // → t ∈ [0, 1]. Computed once after data load, see normalizeAll() below.
  let V_MIN = -0.5, V_MAX = 0.5;
  function normV(v) {
    if (v == null || Number.isNaN(v)) return 0.0;
    if (V_MAX === V_MIN) return 0.5;
    return Math.max(0, Math.min(1, (v - V_MIN) / (V_MAX - V_MIN)));
  }

  // norm V ∈ [0, 1] → CSS color (cool→hot).
  function vColor(t) {
    const u = Math.max(0, Math.min(1, t));
    const r = Math.round(126 + (214 - 126) * u);
    const g = Math.round(168 + (39 - 168) * u);
    const b = Math.round(214 + (40 - 214) * u);
    return `rgb(${r},${g},${b})`;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtNum(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return Number(n).toFixed(3);
  }

  function renderNodePanel(panelEl, node) {
    const code = node.code || "";
    const t = normV(node.v_s);
    const vsBadge = `<span class="vs-badge" style="background:${vColor(t)}">norm V = ${fmtNum(t)}</span>`;

    const preconditionsHtml =
      (node.preconditions || []).length === 0
        ? "<em style=\"color:var(--psn-faint)\">none recorded</em>"
        : `<ul>${(node.preconditions || []).map(p =>
            `<li>${escapeHtml(p.description || "(no description)")}${
              p.code ? `<br/><code>${escapeHtml(p.code)}</code>` : ""
            }</li>`
          ).join("")}</ul>`;

    const effectsHtml =
      (node.effects || []).length === 0
        ? "<em style=\"color:var(--psn-faint)\">none recorded</em>"
        : `<ul>${(node.effects || []).map(e =>
            `<li>${escapeHtml(e.description || "(no description)")}${
              e.code ? `<br/><code>${escapeHtml(e.code)}</code>` : ""
            }</li>`
          ).join("")}</ul>`;

    // Filter version history: drop entries with no informative content
    const versions = (node.versions || []).filter(v =>
      (v.change_log && v.change_log.trim()) ||
      v.value_function != null ||
      (v.update_source && v.update_source !== "unknown")
    );
    const versionsHtml = versions.length === 0
      ? "<em style=\"color:var(--psn-faint)\">single version, no edits</em>"
      : `<div class="versions-list">${versions.map(v => {
          const sourcePart = (v.update_source && v.update_source !== "unknown")
            ? ` <span class="version-vs">${escapeHtml(v.update_source)}</span>` : "";
          const vsPart = v.value_function != null
            ? ` <span class="version-vs">V=${fmtNum(v.value_function)}</span>` : "";
          return `<div class="version-row">
            <span class="version-id">v${escapeHtml(v.version)}</span>${sourcePart}${vsPart}
            ${v.change_log ? `<div class="version-log">${escapeHtml(v.change_log)}</div>` : ""}
          </div>`;
        }).join("")}</div>`;

    panelEl.innerHTML = `
      <div class="skill-panel-header">
        <h3>${escapeHtml(node.id)}</h3>
        <div class="skill-meta">
          ${vsBadge}
          <span class="stat-pill">n = ${node.n_total} (${node.n_succ}✓ / ${node.n_fail}✗)</span>
          ${node.is_task_specific ? '<span class="stat-pill" style="background:#fff4e5;color:#b06000;border-color:#ffd699">task-specific</span>' : ""}
        </div>
        ${node.description ? `<p class="skill-desc">${escapeHtml(node.description)}</p>` : ""}
      </div>

      <div class="skill-panel-section">
        <h4>Preconditions</h4>
        ${preconditionsHtml}
      </div>

      <div class="skill-panel-section">
        <h4>Effects</h4>
        ${effectsHtml}
      </div>

      <div class="skill-panel-section">
        <h4>Code (v${escapeHtml(node.current_version || "?")})</h4>
        <pre><code class="language-javascript">${escapeHtml(code)}</code></pre>
      </div>

      <div class="skill-panel-section">
        <h4>Optimization history</h4>
        ${versionsHtml}
      </div>
    `;

    if (window.hljs) {
      panelEl.querySelectorAll("pre code").forEach(el => {
        window.hljs.highlightElement(el);
      });
    }
  }

  function showWelcome(panelEl, summary) {
    panelEl.innerHTML = `
      <div class="skill-panel-welcome">
        <h3>Skill graph snapshot</h3>
        <p>
          Click any node to see its current code, norm V, preconditions, effects, and optimization history. The buttons above the graph jump to representative nodes.
        </p>
        <p style="font-size:0.84rem;color:var(--psn-faint);margin-top:1rem;">
          Solid borders mark reusable graph nodes; dashed borders mark task-specific wrappers (executed once for a single task, never refactored into a shared parent).
        </p>
      </div>
    `;
  }

  function init(container, panelEl, statusEl, controlsEl) {
    fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error(`fetch ${DATA_URL} → ${r.status}`);
        return r.json();
      })
      .then(data => {
        statusEl.textContent = `${data.n_nodes} skills · ${data.n_edges} reuse edges`;

        // Per-graph V min/max for the normalisation used by colors + badge.
        const vsAll = data.nodes.map(n => n.v_s).filter(v => v != null && !Number.isNaN(v));
        if (vsAll.length) {
          V_MIN = Math.min(...vsAll);
          V_MAX = Math.max(...vsAll);
        }

        const elements = [];
        const nodeIndex = {};
        for (const n of data.nodes) {
          nodeIndex[n.id] = n;
          elements.push({
            data: {
              id: n.id,
              label: n.id,
              v_s: n.v_s,
              n_total: n.n_total,
              color: vColor(normV(n.v_s)),
              taskSpecific: n.is_task_specific,
            }
          });
        }
        for (const e of data.edges) {
          elements.push({
            data: { id: `${e.source}->${e.target}`, source: e.source, target: e.target }
          });
        }

        const cy = cytoscape({
          container,
          elements,
          style: [
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                "border-color": "#1d2329",
                "border-width": 1.2,
                "border-opacity": 0.7,
                "label": "data(label)",
                "font-size": "10.5px",
                "font-family": "Inter, sans-serif",
                "color": "#1d2329",
                "text-valign": "bottom",
                "text-halign": "center",
                "text-margin-y": 5,
                "width": 36,
                "height": 36,
                "text-background-color": "#fff",
                "text-background-opacity": 0.9,
                "text-background-padding": 2,
              }
            },
            {
              selector: "node[?taskSpecific]",
              style: { "border-style": "dashed" }
            },
            {
              selector: "edge",
              style: {
                "width": 1.4,
                "line-color": "#9aa0a6",
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "target-arrow-color": "#9aa0a6",
                "arrow-scale": 0.85,
                "opacity": 0.65,
              }
            },
            {
              selector: "node:selected",
              style: { "border-color": "#c63a3a", "border-width": 2.5, "border-opacity": 1 }
            },
          ],
          layout: {
            name: "cose",
            idealEdgeLength: 110,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 60,
            randomize: false,
            componentSpacing: 80,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
            nestingFactor: 5,
            gravity: 80,
            numIter: 1000,
          },
          minZoom: 0.4,
          maxZoom: 3,
        });

        showWelcome(panelEl, data);

        cy.on("tap", "node", evt => {
          const node = nodeIndex[evt.target.id()];
          if (node) renderNodePanel(panelEl, node);
        });

        cy.on("tap", evt => {
          if (evt.target === cy) {
            showWelcome(panelEl, data);
            cy.elements().unselect();
          }
        });

        // Wire control buttons (above the canvas)
        if (controlsEl) {
          controlsEl.addEventListener("click", evt => {
            const btn = evt.target.closest("button");
            if (!btn) return;

            if (btn.id === "sg-reset") {
              cy.elements().unselect();
              cy.fit(undefined, 60);
              showWelcome(panelEl, data);
              return;
            }

            const skillName = btn.getAttribute("data-skill");
            if (!skillName) return;
            const node = cy.getElementById(skillName);
            if (node && node.length) {
              cy.elements().unselect();
              node.select();
              cy.animate({ center: { eles: node }, zoom: 1.5 }, { duration: 600 });
              const data_n = nodeIndex[skillName];
              if (data_n) renderNodePanel(panelEl, data_n);
            }
          });
        }
      })
      .catch(err => {
        console.error("Skill graph viewer error:", err);
        statusEl.textContent = `Error loading skill graph: ${err.message}`;
        panelEl.innerHTML = `<div class="skill-panel-welcome"><h3>Failed to load</h3><p>${escapeHtml(err.message)}</p></div>`;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  function boot() {
    const container = document.getElementById("skill-graph-container");
    const panel = document.getElementById("skill-graph-panel");
    const status = document.getElementById("skill-graph-status");
    const controls = document.querySelector(".skill-graph-controls");
    if (container && panel && status) {
      init(container, panel, status, controls);
    }
  }
})();
