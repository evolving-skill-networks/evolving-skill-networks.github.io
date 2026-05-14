// Chart toggle — per-group, NOT global-sync (unlike llm_toggle.js which syncs
// all groups so picking GPT-5-mini propagates everywhere on the page).
//
// Each toggle group has:
//   .chart-toggle[data-toggle-group="X"]       buttons[data-target="<value>"]
//   .chart-variants[data-variants="X"]          .chart-variant[data-variant="<value>"]
//
// Clicking a button only updates ITS group's variants. Multiple chart toggles
// on the same page can hold independent state.

(function () {
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".chart-toggle").forEach(group => {
      const groupId = group.getAttribute("data-toggle-group");
      const variants = document.querySelector(
        `.chart-variants[data-variants="${groupId}"]`
      );
      group.addEventListener("click", evt => {
        const btn = evt.target.closest("button");
        if (!btn || !group.contains(btn)) return;
        const target = btn.getAttribute("data-target");
        if (!target) return;
        group.querySelectorAll("button").forEach(b => {
          b.classList.toggle("is-active", b === btn);
        });
        if (variants) {
          variants.querySelectorAll(".chart-variant").forEach(v => {
            v.classList.toggle(
              "is-active", v.getAttribute("data-variant") === target
            );
          });
        }
      });
    });
  });
})();
