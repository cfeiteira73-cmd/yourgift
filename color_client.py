import os
root = 'C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web'
target_dirs = [
    os.path.join(root, 'src/app/client-portal'),
    os.path.join(root, 'src/components/client-portal'),
]
REPLACEMENTS = [
    ('rgb(7,17,31)', '#090907'), ('rgb(8,15,28)', '#0f0f0c'),
    ('rgb(77,163,255)', '#d4b47a'), ('rgb(99,230,190)', '#b8975e'), ('rgb(116,231,255)', '#b8975e'),
    ('rgba(77,163,255,0.04)', 'rgba(154,124,74,0.04)'), ('rgba(77,163,255,0.06)', 'rgba(154,124,74,0.08)'),
    ('rgba(77,163,255,0.08)', 'rgba(154,124,74,0.08)'), ('rgba(77,163,255,0.1)', 'rgba(154,124,74,0.10)'),
    ('rgba(77,163,255,0.12)', 'rgba(154,124,74,0.12)'), ('rgba(77,163,255,0.15)', 'rgba(154,124,74,0.14)'),
    ('rgba(77,163,255,0.2)', 'rgba(154,124,74,0.18)'), ('rgba(77,163,255,0.3)', 'rgba(154,124,74,0.28)'),
    ('rgba(77,163,255,0.35)', 'rgba(154,124,74,0.32)'), ('rgba(77,163,255,0.5)', 'rgba(154,124,74,0.45)'),
    ('rgba(99,230,190,0.06)', 'rgba(184,151,94,0.08)'), ('rgba(99,230,190,0.1)', 'rgba(184,151,94,0.10)'),
    ('rgba(99,230,190,0.12)', 'rgba(184,151,94,0.12)'), ('rgba(99,230,190,0.2)', 'rgba(184,151,94,0.18)'),
    ('rgba(116,231,255,0.12)', 'rgba(154,124,74,0.12)'), ('rgba(116,231,255,0.15)', 'rgba(154,124,74,0.14)'),
    ('rgba(255,255,255,0.03)', 'rgba(240,236,228,0.04)'), ('rgba(255,255,255,0.04)', 'rgba(240,236,228,0.04)'),
    ('rgba(255,255,255,0.05)', 'rgba(240,236,228,0.06)'), ('rgba(255,255,255,0.06)', 'rgba(240,236,228,0.06)'),
    ('rgba(255,255,255,0.07)', 'rgba(240,236,228,0.06)'), ('rgba(255,255,255,0.08)', 'rgba(240,236,228,0.06)'),
    ('rgba(255,255,255,0.1)', 'rgba(240,236,228,0.10)'), ('rgba(255,255,255,0.12)', 'rgba(240,236,228,0.12)'),
    ('rgba(255,255,255,0.15)', 'rgba(240,236,228,0.14)'), ('rgba(255,255,255,0.2)', 'rgba(240,236,228,0.18)'),
    ('rgba(255,255,255,0.25)', 'rgba(240,236,228,0.22)'), ('rgba(255,255,255,0.3)', 'rgba(240,236,228,0.28)'),
    ('rgb(60,72,90)', 'rgba(240,236,228,0.24)'), ('rgb(70,82,100)', 'rgba(240,236,228,0.24)'),
    ('rgb(80,92,110)', 'rgba(240,236,228,0.28)'), ('rgb(100,112,130)', 'rgba(240,236,228,0.42)'),
    ('rgb(120,130,150)', 'rgba(240,236,228,0.42)'), ('rgb(140,155,175)', 'rgba(240,236,228,0.45)'),
    ('rgb(160,170,190)', 'rgba(240,236,228,0.58)'), ('rgb(180,195,215)', 'rgba(240,236,228,0.65)'),
    ('rgb(200,210,225)', 'rgba(240,236,228,0.72)'), ('rgb(210,220,235)', 'rgba(240,236,228,0.72)'),
    ('rgb(220,230,245)', 'rgba(240,236,228,0.75)'), ('rgb(245,247,251)', '#f0ece4'),
    ('linear-gradient(135deg, rgb(77,163,255) 0%, rgb(99,230,190) 100%)', '#9a7c4a'),
    ('linear-gradient(90deg, rgb(77,163,255), rgb(99,230,190))', 'linear-gradient(90deg, #9a7c4a, #b8975e)'),
    ('linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))', 'linear-gradient(135deg, #9a7c4a, #b8975e)'),
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
