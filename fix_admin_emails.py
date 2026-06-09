"""
Replace all duplicated ADMIN_EMAILS declarations with import from @/lib/constants.
Handles both API routes (.ts) and portal pages (.tsx).
"""
import os, re

BASE = r"C:/Users/Carlos/Desktop/CODE & OZ/yourgift-os/apps/web/src"
DIRS = [
    os.path.join(BASE, "app", "(portal)"),
    os.path.join(BASE, "app", "api"),
    os.path.join(BASE, "middleware.ts"),  # may also have it
]

OLD_DECL = r"const ADMIN_EMAILS = \['geral@yourgift\.pt',\s*'geral@agencygroup\.pt'\];"

NEW_IMPORT_TS  = "import { isAdminEmail } from '@/lib/constants';"
NEW_IMPORT_TSX = "import { isAdminEmail } from '@/lib/constants';"

files_changed = 0

def process_file(path: str):
    global files_changed
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if "ADMIN_EMAILS = [" not in content:
        return

    # Remove the local declaration
    new_content = re.sub(OLD_DECL + r"\n?", "", content)

    # Replace usages:  ADMIN_EMAILS.includes(...)  →  isAdminEmail(...)
    # Pattern: ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())
    # → isAdminEmail(user.email)
    new_content = re.sub(
        r"ADMIN_EMAILS\.includes\(\(([^)]+?)\s*\?\?\s*''\)\.toLowerCase\(\)\)",
        r"isAdminEmail(\1)",
        new_content,
    )
    # Fallback: any remaining ADMIN_EMAILS.includes(x) → isAdminEmail(x)
    new_content = re.sub(
        r"ADMIN_EMAILS\.includes\(([^)]+)\)",
        r"isAdminEmail(\1)",
        new_content,
    )

    # Add import if not already there
    if "isAdminEmail" in new_content and NEW_IMPORT_TS not in new_content:
        # Insert after first 'use client' or after first import line
        if "'use client'" in new_content or '"use client"' in new_content:
            new_content = re.sub(
                r"('use client'|\"use client\")(\n)",
                r"\1\2" + NEW_IMPORT_TSX + "\n",
                new_content, count=1
            )
        else:
            # Add at top
            new_content = NEW_IMPORT_TS + "\n" + new_content

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        files_changed += 1
        print(f"  OK {os.path.relpath(path, BASE)}")

for d in DIRS:
    if os.path.isfile(d):
        process_file(d)
    elif os.path.isdir(d):
        for root, _, files in os.walk(d):
            for fn in files:
                if fn.endswith(('.ts', '.tsx')):
                    process_file(os.path.join(root, fn))

print(f"\nTotal files changed: {files_changed}")
