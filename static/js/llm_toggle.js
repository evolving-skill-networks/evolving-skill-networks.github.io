// LLM toggle — switches between gpt-5-mini / Qwen3-Coder-Next variants.
// Each toggle group has:
//   .llm-toggle[data-toggle-group="X"]      with buttons[data-target="g"|"q"]
//   .llm-variants[data-variants="X"]         containing .llm-variant[data-variant="g"|"q"]
// Sync all groups so picking one LLM globally updates the page.

(function () {
  function setVariant(target) {
    document.querySelectorAll(".llm-toggle").forEach(group => {
      group.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("is-active", btn.getAttribute("data-target") === target);
      });
    });
    document.querySelectorAll(".llm-variants").forEach(group => {
      group.querySelectorAll(".llm-variant").forEach(v => {
        v.classList.toggle("is-active", v.getAttribute("data-variant") === target);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".llm-toggle").forEach(group => {
      group.addEventListener("click", evt => {
        const btn = evt.target.closest("button");
        if (!btn) return;
        const target = btn.getAttribute("data-target");
        if (target) setVariant(target);
      });
    });
  });
})();
