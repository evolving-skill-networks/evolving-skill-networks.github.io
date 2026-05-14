# Evolving Programmatic Skill Networks — Project Page

Static project website for *Evolving Programmatic Skill Networks* (PSN).
Pure HTML/CSS/JS, no build step.

Live: https://hcshi.com/evolving-skill-networks/

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000/
```

## Layout

```
.
├── index.html                # main one-page site
├── hero_preview_v2.html      # 3-panel synced hero, iframed from index.html
├── data/
│   ├── hero_evolution_gpt5mini_phase2c.json   # per-iter telemetry for the hero viz
│   └── skill_graph_v13.json                   # §10 interactive graph data
└── static/
    ├── css/, js/             # vendored libs + custom code
    ├── images/               # rendered figures and chart PNGs
    ├── pdfs/                 # paper PDF
    └── videos/v13/           # per-iter bot-pov mp4s for the hero viz
```

## Deploy

The repo is configured for GitHub Pages, `main` branch, `/` root. A `.nojekyll`
file is present so Pages serves underscore-prefixed paths verbatim.
