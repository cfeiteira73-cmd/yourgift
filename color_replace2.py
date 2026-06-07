import os

root = 'C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web'
target_dirs = [
    os.path.join(root, 'src/app/(portal)'),
    os.path.join(root, 'src/components/portal'),
]

# Second pass — catch all remaining patterns missed in pass 1
REPLACEMENTS = [
    # ── Cyan hex variants ────────────────────────────────────────────────────
    ("#4da3ff",   "#d4b47a"),
    ("#4DA3ff",   "#d4b47a"),
    ("#74e7ff",   "#b8975e"),
    ("#74E7FF",   "#b8975e"),
    ("#00bfff",   "#b8975e"),

    # ── rgba(116,231,255,...) — ALL opacities ────────────────────────────────
    ("rgba(116,231,255,0.03)", "rgba(154,124,74,0.04)"),
    ("rgba(116,231,255,0.04)", "rgba(154,124,74,0.04)"),
    ("rgba(116,231,255,0.05)", "rgba(154,124,74,0.06)"),
    ("rgba(116,231,255,0.06)", "rgba(154,124,74,0.08)"),
    ("rgba(116,231,255,0.07)", "rgba(154,124,74,0.08)"),
    ("rgba(116,231,255,0.08)", "rgba(154,124,74,0.08)"),
    ("rgba(116,231,255,0.10)", "rgba(154,124,74,0.10)"),
    ("rgba(116,231,255,0.12)", "rgba(154,124,74,0.12)"),
    ("rgba(116,231,255,0.14)", "rgba(154,124,74,0.12)"),
    ("rgba(116,231,255,0.15)", "rgba(154,124,74,0.14)"),
    ("rgba(116,231,255,0.18)", "rgba(154,124,74,0.16)"),
    ("rgba(116,231,255,0.2)",  "rgba(154,124,74,0.18)"),
    ("rgba(116,231,255,0.25)", "rgba(154,124,74,0.22)"),
    ("rgba(116,231,255,0.3)",  "rgba(154,124,74,0.28)"),
    ("rgba(116,231,255,0.4)",  "rgba(154,124,74,0.35)"),
    ("rgba(116,231,255,0.5)",  "rgba(154,124,74,0.45)"),
    ("rgba(116,231,255,0.6)",  "rgba(154,124,74,0.5)"),
    ("rgba(116,231,255,0.7)",  "rgba(184,151,94,0.55)"),
    ("rgba(116,231,255,0.8)",  "rgba(184,151,94,0.65)"),

    # ── rgba(77,163,255,...) — very low opacities missed ─────────────────────
    ("rgba(77,163,255,0.03)",  "rgba(154,124,74,0.04)"),
    ("rgba(77,163,255,0.04)",  "rgba(154,124,74,0.04)"),
    ("rgba(77,163,255,0.05)",  "rgba(154,124,74,0.06)"),
    ("rgba(77,163,255,0.06)",  "rgba(154,124,74,0.08)"),
    ("rgba(77,163,255,0.07)",  "rgba(154,124,74,0.08)"),
    ("rgba(77,163,255,0.08)",  "rgba(154,124,74,0.08)"),
    ("rgba(77,163,255,0.16)",  "rgba(154,124,74,0.14)"),
    ("rgba(77,163,255,0.18)",  "rgba(154,124,74,0.16)"),
    ("rgba(77,163,255,0.35)",  "rgba(154,124,74,0.35)"),
    ("rgba(77,163,255,0.45)",  "rgba(154,124,74,0.42)"),
    ("rgba(77,163,255,0.8)",   "rgba(184,151,94,0.65)"),

    # ── rgba(99,230,190,...) — low and high opacities missed ─────────────────
    ("rgba(99,230,190,0.03)",  "rgba(184,151,94,0.04)"),
    ("rgba(99,230,190,0.04)",  "rgba(184,151,94,0.04)"),
    ("rgba(99,230,190,0.05)",  "rgba(184,151,94,0.06)"),
    ("rgba(99,230,190,0.06)",  "rgba(184,151,94,0.08)"),
    ("rgba(99,230,190,0.07)",  "rgba(184,151,94,0.08)"),
    ("rgba(99,230,190,0.08)",  "rgba(184,151,94,0.08)"),
    ("rgba(99,230,190,0.25)",  "rgba(184,151,94,0.22)"),
    ("rgba(99,230,190,0.3)",   "rgba(184,151,94,0.28)"),
    ("rgba(99,230,190,0.35)",  "rgba(184,151,94,0.32)"),
    ("rgba(99,230,190,0.4)",   "rgba(184,151,94,0.35)"),
    ("rgba(99,230,190,0.5)",   "rgba(184,151,94,0.45)"),
    ("rgba(99,230,190,0.6)",   "rgba(184,151,94,0.5)"),
    ("rgba(99,230,190,0.7)",   "rgba(184,151,94,0.55)"),
    ("rgba(99,230,190,0.8)",   "rgba(184,151,94,0.65)"),

    # ── Mixed gradients with remaining cyan ──────────────────────────────────
    ("rgba(99,230,190,0.3))",  "rgba(184,151,94,0.28))"),
    ("rgba(99,230,190,0.3)'",  "rgba(184,151,94,0.28)'"),

    # ── Dark cool grays → warm grays ─────────────────────────────────────────
    ("rgb(50,62,80)",    "rgba(240,236,228,0.18)"),
    ("rgb(40,52,70)",    "rgba(240,236,228,0.14)"),
    ("rgb(30,42,60)",    "rgba(240,236,228,0.10)"),
    ("rgb(20,30,48)",    "rgba(240,236,228,0.08)"),
    ("rgb(15,24,40)",    "#141411"),
    ("rgb(12,20,36)",    "#0f0f0c"),

    # ── Dynamic template literals: ${...? blue : ...} ────────────────────────
    # These are harder to catch — specific patterns in cockpit etc
    ("rgba(77,163,255,0.16)",  "rgba(154,124,74,0.14)"),

    # ── dot colors in status badges ──────────────────────────────────────────
    ("dot: '#4da3ff'",  "dot: '#d4b47a'"),
    ("dot: '#4DA3FF'",  "dot: '#d4b47a'"),
    ("dot: '#74e7ff'",  "dot: '#b8975e'"),
    ("dot: '#74E7FF'",  "dot: '#b8975e'"),

    # ── Border colors with hex blue ──────────────────────────────────────────
    ("border: 'rgba(77,163,255,0.22)'",  "border: 'rgba(154,124,74,0.22)'"),
    ("border: 'rgba(77,163,255,0.35)'",  "border: 'rgba(154,124,74,0.35)'"),
    ("border: 'rgba(116,231,255,0.25)'", "border: 'rgba(154,124,74,0.22)'"),
    ("border: 'rgba(99,230,190,0.25)'",  "border: 'rgba(184,151,94,0.22)'"),
    ("border: 'rgba(99,230,190,0.35)'",  "border: 'rgba(184,151,94,0.32)'"),

    # ── box shadows with old cyan ─────────────────────────────────────────────
    ("rgba(99,230,190,0.5)",   "rgba(184,151,94,0.45)"),
    ("rgba(99,230,190,0.7)",   "rgba(184,151,94,0.55)"),
    ("rgba(116,231,255,0.5)",  "rgba(154,124,74,0.45)"),
    ("rgba(116,231,255,0.7)",  "rgba(154,124,74,0.55)"),

    # ── Gradient with cyan remainder ─────────────────────────────────────────
    ("rgba(116,231,255,0.06) 100%)", "rgba(154,124,74,0.06) 100%)"),
    ("rgba(116,231,255,0.04) 100%)", "rgba(154,124,74,0.04) 100%)"),
]

files_changed = 0
replacements_made = 0
for target_dir in target_dirs:
    for dirpath, dirnames, filenames in os.walk(target_dir):
        dirnames[:] = [d for d in dirnames if d not in ['node_modules', '.next']]
        for fname in filenames:
            if not fname.endswith(('.tsx', '.ts', '.css')):
                continue
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                original = content
                n = 0
                for old, new in REPLACEMENTS:
                    count = content.count(old)
                    if count > 0:
                        content = content.replace(old, new)
                        n += count
                if content != original:
                    with open(fpath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    files_changed += 1
                    replacements_made += n
                    rel = fpath.replace(root + '/', '').replace('\\', '/')
                    print(f"  OK ({n}) {rel}")
            except Exception as e:
                print(f"  ERR {fpath}: {e}")

print(f"\nTotal: {files_changed} files, {replacements_made} replacements")
