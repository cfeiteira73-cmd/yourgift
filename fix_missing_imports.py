"""
Fix files that use isAdminEmail but don't have the import,
and fix files that still reference ADMIN_EMAILS as a const.
"""
import os, re

BASE = r"C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web/src"
IMPORT = "import { isAdminEmail } from '@/lib/constants';\n"

files_changed = 0

def fix_file(path):
    global files_changed
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # Fix remaining ADMIN_EMAILS[0] → BRAND.email usage
    if 'ADMIN_EMAILS[0]' in content:
        content = content.replace("ADMIN_EMAILS[0]", "'geral@yourgift.pt'")
        changed = True

    # Fix ADMIN_EMAILS.length etc
    if 'ADMIN_EMAILS.' in content and "isAdminEmail" not in content:
        # try to replace with isAdminEmail usage
        pass

    # Add import if isAdminEmail used but not imported
    if 'isAdminEmail' in content and "import { isAdminEmail" not in content:
        # Find insertion point: after 'use client' or after first import
        if "'use client'" in content or '"use client"' in content:
            content = re.sub(
                r"('use client'|\"use client\")\n",
                lambda m: m.group(0) + IMPORT,
                content, count=1
            )
        else:
            content = IMPORT + content
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        files_changed += 1
        print(f"  OK {os.path.relpath(path, BASE)}")

for root, dirs, files in os.walk(BASE):
    for fn in files:
        if fn.endswith(('.ts', '.tsx')):
            fix_file(os.path.join(root, fn))

print(f"\nTotal: {files_changed}")
