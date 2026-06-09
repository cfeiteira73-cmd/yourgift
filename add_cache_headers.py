"""
Add 'export const dynamic = "force-dynamic";' to all API routes that:
1. Use Supabase auth (createServerClient / createClient from supabase/server)
2. Don't already have a cache directive
3. Are not webhook routes

This prevents Next.js from accidentally caching authenticated responses.
"""
import os, re

API_DIR = r"C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web/src/app/api"

ALREADY_HAS = re.compile(r"export const (dynamic|revalidate)\s*=")
HAS_AUTH    = re.compile(r"createServerClient|createClient.*supabase/server|supabase/server")
SKIP_NAMES  = {"webhooks"}  # don't modify webhook routes

DIRECTIVE = "export const dynamic = 'force-dynamic';\n"

files_changed = 0

for root, dirs, files in os.walk(API_DIR):
    # Skip webhook directories
    if any(skip in root for skip in SKIP_NAMES):
        continue
    for fn in files:
        if fn != 'route.ts':
            continue
        path = os.path.join(root, fn)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        if ALREADY_HAS.search(content):
            continue  # already has directive

        if not HAS_AUTH.search(content):
            continue  # no auth, likely safe to skip

        # Add after first import block
        # Find the last import line
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith("import{") or line.startswith("import type"):
                last_import_idx = i

        lines.insert(last_import_idx + 1, '')
        lines.insert(last_import_idx + 2, "export const dynamic = 'force-dynamic';")

        new_content = '\n'.join(lines)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        files_changed += 1
        print(f"  OK {os.path.relpath(path, API_DIR)}")

print(f"\nTotal: {files_changed} files updated")
