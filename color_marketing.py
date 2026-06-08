import os, re

root = 'C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web'
target_dirs = [
    os.path.join(root, 'src/app/(marketing)'),
    os.path.join(root, 'src/components/marketing'),
]

# Same replacements as dashboard — blue/cyan → bronze/warm
REPLACEMENTS = [
    # Backgrounds
    ("rgb(7,17,31)",        "#090907"),
    ("rgb(8,15,28)",        "#0f0f0c"),
    ("rgb(7, 17, 31)",      "#090907"),
    ("rgba(7,17,31,0.9)",   "rgba(9,9,7,0.9)"),
    ("rgba(7,17,31,0.95)",  "rgba(9,9,7,0.95)"),
    ("rgba(8,15,28,0.97)",  "rgba(15,15,12,0.97)"),
    ("#07111F",             "#090907"),
    ("#0B1526",             "#0f0f0c"),

    # Blue → Bronze-3
    ("rgb(77,163,255)",     "#d4b47a"),
    ("rgb(77, 163, 255)",   "#d4b47a"),
    ("#4DA3FF",             "#d4b47a"),
    ("#4da3ff",             "#d4b47a"),
    ("rgba(77,163,255,0.04)",  "rgba(154,124,74,0.04)"),
    ("rgba(77,163,255,0.05)",  "rgba(154,124,74,0.06)"),
    ("rgba(77,163,255,0.06)",  "rgba(154,124,74,0.08)"),
    ("rgba(77,163,255,0.08)",  "rgba(154,124,74,0.08)"),
    ("rgba(77,163,255,0.1)",   "rgba(154,124,74,0.10)"),
    ("rgba(77,163,255,0.10)",  "rgba(154,124,74,0.10)"),
    ("rgba(77,163,255,0.12)",  "rgba(154,124,74,0.12)"),
    ("rgba(77,163,255,0.14)",  "rgba(154,124,74,0.12)"),
    ("rgba(77,163,255,0.15)",  "rgba(154,124,74,0.14)"),
    ("rgba(77,163,255,0.16)",  "rgba(154,124,74,0.14)"),
    ("rgba(77,163,255,0.18)",  "rgba(154,124,74,0.16)"),
    ("rgba(77,163,255,0.2)",   "rgba(154,124,74,0.18)"),
    ("rgba(77,163,255,0.25)",  "rgba(154,124,74,0.22)"),
    ("rgba(77,163,255,0.3)",   "rgba(154,124,74,0.28)"),
    ("rgba(77,163,255,0.35)",  "rgba(154,124,74,0.32)"),
    ("rgba(77,163,255,0.4)",   "rgba(154,124,74,0.35)"),
    ("rgba(77,163,255,0.5)",   "rgba(154,124,74,0.45)"),
    ("rgba(77,163,255,0.6)",   "rgba(154,124,74,0.5)"),
    ("rgba(77,163,255,0.7)",   "rgba(184,151,94,0.55)"),

    # Cyan/Emerald → Bronze-2
    ("rgb(99,230,190)",     "#b8975e"),
    ("rgb(116,231,255)",    "#b8975e"),
    ("rgb(99, 230, 190)",   "#b8975e"),
    ("#63E6BE",             "#b8975e"),
    ("#63e6be",             "#b8975e"),
    ("#74e7ff",             "#b8975e"),
    ("#74E7FF",             "#b8975e"),
    ("rgba(99,230,190,0.04)",  "rgba(184,151,94,0.04)"),
    ("rgba(99,230,190,0.05)",  "rgba(184,151,94,0.06)"),
    ("rgba(99,230,190,0.06)",  "rgba(184,151,94,0.08)"),
    ("rgba(99,230,190,0.08)",  "rgba(184,151,94,0.08)"),
    ("rgba(99,230,190,0.1)",   "rgba(184,151,94,0.10)"),
    ("rgba(99,230,190,0.10)",  "rgba(184,151,94,0.10)"),
    ("rgba(99,230,190,0.12)",  "rgba(184,151,94,0.12)"),
    ("rgba(99,230,190,0.15)",  "rgba(184,151,94,0.14)"),
    ("rgba(99,230,190,0.2)",   "rgba(184,151,94,0.18)"),
    ("rgba(99,230,190,0.25)",  "rgba(184,151,94,0.22)"),
    ("rgba(99,230,190,0.3)",   "rgba(184,151,94,0.28)"),
    ("rgba(99,230,190,0.35)",  "rgba(184,151,94,0.32)"),
    ("rgba(99,230,190,0.4)",   "rgba(184,151,94,0.35)"),
    ("rgba(99,230,190,0.5)",   "rgba(184,151,94,0.45)"),
    ("rgba(116,231,255,0.06)", "rgba(154,124,74,0.08)"),
    ("rgba(116,231,255,0.08)", "rgba(154,124,74,0.08)"),
    ("rgba(116,231,255,0.1)",  "rgba(154,124,74,0.10)"),
    ("rgba(116,231,255,0.12)", "rgba(154,124,74,0.12)"),
    ("rgba(116,231,255,0.15)", "rgba(154,124,74,0.14)"),
    ("rgba(116,231,255,0.2)",  "rgba(154,124,74,0.18)"),
    ("rgba(116,231,255,0.3)",  "rgba(154,124,74,0.28)"),

    # Gradients → bronze
    ("linear-gradient(135deg, rgb(77,163,255) 0%, rgb(99,230,190) 100%)", "#9a7c4a"),
    ("linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))",        "linear-gradient(135deg, #9a7c4a, #b8975e)"),
    ("linear-gradient(90deg, rgb(77,163,255), rgb(99,230,190))",          "linear-gradient(90deg, #9a7c4a, #b8975e)"),

    # White borders → warm
    ("rgba(255,255,255,0.03)", "rgba(240,236,228,0.04)"),
    ("rgba(255,255,255,0.04)", "rgba(240,236,228,0.04)"),
    ("rgba(255,255,255,0.05)", "rgba(240,236,228,0.06)"),
    ("rgba(255,255,255,0.06)", "rgba(240,236,228,0.06)"),
    ("rgba(255,255,255,0.07)", "rgba(240,236,228,0.06)"),
    ("rgba(255,255,255,0.08)", "rgba(240,236,228,0.06)"),
    ("rgba(255,255,255,0.1)",  "rgba(240,236,228,0.10)"),
    ("rgba(255,255,255,0.12)", "rgba(240,236,228,0.12)"),
    ("rgba(255,255,255,0.15)", "rgba(240,236,228,0.14)"),
    ("rgba(255,255,255,0.2)",  "rgba(240,236,228,0.18)"),
    ("rgba(255,255,255,0.25)", "rgba(240,236,228,0.22)"),
    ("rgba(255,255,255,0.3)",  "rgba(240,236,228,0.28)"),

    # Gray text → warm equivalents
    ("rgb(60,72,90)",    "rgba(240,236,228,0.24)"),
    ("rgb(70,82,100)",   "rgba(240,236,228,0.24)"),
    ("rgb(80,92,110)",   "rgba(240,236,228,0.28)"),
    ("rgb(100,112,130)", "rgba(240,236,228,0.42)"),
    ("rgb(120,130,150)", "rgba(240,236,228,0.42)"),
    ("rgb(140,155,175)", "rgba(240,236,228,0.45)"),
    ("rgb(160,170,190)", "rgba(240,236,228,0.58)"),
    ("rgb(180,195,215)", "rgba(240,236,228,0.65)"),
    ("rgb(200,210,225)", "rgba(240,236,228,0.72)"),
    ("rgb(210,220,235)", "rgba(240,236,228,0.72)"),
    ("rgb(220,230,245)", "rgba(240,236,228,0.75)"),
    ("rgb(225,235,248)", "rgba(240,236,228,0.78)"),
    ("rgb(230,238,250)", "rgba(240,236,228,0.80)"),
    ("rgb(240,245,255)", "rgba(240,236,228,0.85)"),
    ("rgb(245,247,251)", "#f0ece4"),
    ("rgb(248,250,253)", "#f0ece4"),

    # Fonts: replace generic sans with premium system
    # (only where explicitly set in inline styles)
    ("fontFamily: 'system-ui, -apple-system, sans-serif'", "fontFamily: \"'Montserrat', sans-serif\""),
    ("font-family: system-ui", "font-family: 'Montserrat', sans-serif"),

    # fontWeight 900 → 700 (Libre Baskerville doesn't have 900)
    # (only for titles that switch to display font)
]

# Typography upgrades: headings → Libre Baskerville where they're h1/h2
# We'll inject via CSS, not inline to avoid breaking structure

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
