import os

root = 'C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web'
target_dirs = [
    os.path.join(root, 'src/app/client-portal'),
    os.path.join(root, 'src/components/client-portal'),
]

REPLACEMENTS = [
    # Purple gradient on buttons → pure bronze (CRITICAL)
    ("linear-gradient(135deg,#d4b47a,rgb(116,100,255))", "#b8975e"),
    ("linear-gradient(135deg, #d4b47a, rgb(116,100,255))", "#b8975e"),
    ("linear-gradient(135deg, rgb(167,139,250), #d4b47a)", "#b8975e"),
    ("linear-gradient(135deg,rgb(167,139,250),#d4b47a)", "#b8975e"),
    ("rgb(116,100,255)", "#9a7c4a"),
    ("rgb(167,139,250)", "#d4b47a"),
    # Blue onFocus → bronze
    ("rgba(77,163,255,0.4)", "rgba(154,124,74,0.45)"),
    ("rgba(77,163,255,0.3)", "rgba(154,124,74,0.35)"),
    ("rgba(77,163,255,0.35)", "rgba(154,124,74,0.35)"),
    # Remaining blue text colors
    ("rgb(225,235,250)", "#f0ece4"),
    ("rgb(200,215,235)", "rgba(240,236,228,0.72)"),
    ("rgb(175,190,215)", "rgba(240,236,228,0.58)"),
    ("rgb(150,168,200)", "rgba(240,236,228,0.45)"),
    # Card backgrounds → warm dark
    ("rgb(10,20,38)", "#0f0f0c"),
    ("rgb(12,24,44)", "#0f0f0c"),
    ("rgb(15,28,50)", "#141411"),
    # Old rounded borders → sharp premium
    ("borderRadius: '14px'", "borderRadius: '0px'"),
    ("borderRadius: '12px'", "borderRadius: '0px'"),
    ("borderRadius: '10px'", "borderRadius: '0px'"),
    ("borderRadius: '20px'", "borderRadius: '0px'"),
    ("borderRadius: '9px'", "borderRadius: '0px'"),
    ("borderRadius: '8px'", "borderRadius: '0px'"),
    # Keep 'borderRadius: 9999px' (pills) as-is
    # Input/textarea border focus → bronze
    ("'rgba(77,163,255,0.4)'", "'rgba(154,124,74,0.45)'"),
    # fontWeight 800 → 700 (display fonts don't have 800)
    ("fontWeight: 800", "fontWeight: 700"),
    ("fontWeight: '800'", "fontWeight: '700'"),
]

changed = 0
for target_dir in target_dirs:
    for dirpath, dirnames, filenames in os.walk(target_dir):
        dirnames[:] = [d for d in dirnames if d not in ['node_modules', '.next']]
        for fname in filenames:
            if not fname.endswith(('.tsx', '.ts', '.css')): continue
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
                original = content
                for old, new in REPLACEMENTS:
                    content = content.replace(old, new)
                if content != original:
                    with open(fpath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    changed += 1
                    rel = fpath.replace(root, '').replace(os.sep, '/')
                    print('  OK', rel)
            except Exception as e:
                print('  ERR', e)
print('Total:', changed, 'files')
