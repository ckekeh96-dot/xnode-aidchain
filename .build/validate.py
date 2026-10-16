import io, os, re, subprocess, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
checkdir = os.path.join(ROOT, '.build', 'checks')
os.makedirs(checkdir, exist_ok=True)

blocks = re.findall(r'<script([^>]*)>(.*?)</script>', html, flags=re.S)
inline = [(a, b) for a, b in blocks if 'src=' not in a]
print('script blocks total=%d inline=%d external=%d' % (len(blocks), len(inline), len(blocks) - len(inline)))

failures = 0
for i, (attrs, body) in enumerate(inline):
    is_module = 'type="module"' in attrs
    name = 'script%d.%s' % (i, 'mjs' if is_module else 'js')
    path = os.path.join(checkdir, name)
    io.open(path, 'w', encoding='utf-8').write(body)
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    tag = 'MODULE' if is_module else 'CLASSIC'
    if r.returncode == 0:
        print('  OK   %-12s %s (%d chars)' % (name, tag, len(body)))
    else:
        failures += 1
        print('  FAIL %-12s %s' % (name, tag))
        print('       ' + (r.stderr or r.stdout).strip().replace('\n', '\n       ')[:1200])

# Every id the testnet module looks up must exist in the document.
module_body = max((b for a, b in inline if 'type="module"' in a), key=len)
used = set(re.findall(r"\$\w*\(\s*'([A-Za-z0-9_]+)'\s*\)", module_body)) | set(re.findall(r"getElementById\(\s*'([A-Za-z0-9_]+)'\s*\)", module_body))
defined = set(re.findall(r'id="([A-Za-z0-9_]+)"', html))
missing = sorted(used - defined)
dupes = [k for k, c in collections.Counter(re.findall(r'id="([A-Za-z0-9_]+)"', html)).items() if c > 1]
print('module id lookups=%d missing=%s duplicate_ids_in_page=%s' % (len(used), missing or 'none', dupes or 'none'))

# Nav buttons must have both a matching view section and a titles entry.
views_nav = set(re.findall(r'data-view="([a-z]+)"', html))
sections = set(re.findall(r'<section class="view[^"]*" id="([a-z]+)"', html))
title_keys = set(re.findall(r"([a-z]+):\['", html))
print('nav views=%s' % sorted(views_nav))
print('nav without section=%s' % (sorted(views_nav - sections) or 'none'))
print('nav without title entry=%s' % (sorted(views_nav - title_keys) or 'none'))
print('orphan sections=%s' % (sorted(sections - views_nav) or 'none'))

# Labels/for pairs keep the new form fields accessible.
fors = set(re.findall(r'for="([A-Za-z0-9_]+)"', html))
print('labels pointing at nothing=%s' % (sorted(fors - defined) or 'none'))

sys.exit(1 if (failures or missing or dupes or (views_nav - sections) or (views_nav - title_keys)) else 0)
