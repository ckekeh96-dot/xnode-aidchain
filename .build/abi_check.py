import io, os, re, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

def contract_sig(path):
    abi = json.load(io.open(path, encoding='utf-8'))['abi']
    out = {}
    for e in abi:
        if e.get('type') in ('function', 'event'):
            out[e['name']] = (e['type'], len(e.get('inputs') or []), len(e.get('outputs') or []))
    return out

def ui_sig(block):
    out = {}
    for m in re.finditer(r"'(function|event)\s+(\w+)\(([^)]*)\)([^']*)'", block):
        kind, name, ins, tail = m.groups()
        n_in = len([p for p in ins.split(',') if p.strip()]) if ins.strip() else 0
        ret = re.search(r'returns\s*\((.*)\)', tail)
        n_out = len([p for p in ret.group(1).split(',') if p.strip()]) if ret else 0
        out[name] = ('function' if kind == 'function' else 'event', n_in, n_out)
    return out

pairs = [
    ('AidChainEscrow', contract_sig(os.path.join(ROOT, 'contracts', 'out', 'AidChainEscrow.sol', 'AidChainEscrow.json')),
     ui_sig(re.search(r'const escrowABI=\[(.*?)\];', html, flags=re.S).group(1))),
    ('MockUSDC', contract_sig(os.path.join(ROOT, 'contracts', 'out', 'MockUSDC.sol', 'MockUSDC.json')),
     ui_sig(re.search(r"const tokenABI=\[(.*?)\];", html, flags=re.S).group(1))),
]

bad = 0
for cname, real, ui in pairs:
    print('== %s: compiled contract declares %d, UI declares %d ==' % (cname, len(real), len(ui)))
    for name, sig in sorted(ui.items()):
        if name not in real:
            print('  MISSING  %s() is used by the UI but is not in the compiled contract' % name); bad += 1
        elif real[name] != sig:
            print('  MISMATCH %s compiled=%s ui=%s' % (name, real[name], sig)); bad += 1
    for name in sorted(set(real) - set(ui)):
        print('  (on chain, unused by UI: %s [%s])' % (name, real[name][0]))

print('ABI cross-check: %s' % ('OK - every UI signature matches the compiled contract' if bad == 0 else '%d PROBLEM(S)' % bad))
raise SystemExit(1 if bad else 0)
