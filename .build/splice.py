import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
SECTION = os.path.join(ROOT, '.build', 'testnet_section.html')
MODULE = os.path.join(ROOT, '.build', 'testnet_module.js')

with io.open(INDEX, 'r', encoding='utf-8', newline='') as f:
    original = f.read()
lines = original.split('\n')
print('index.html lines:', len(lines))

section = io.open(SECTION, encoding='utf-8').read().rstrip('\n')
module = io.open(MODULE, encoding='utf-8').read().rstrip('\n')

# Sanity-check the anchors before touching anything.
assert lines[82].strip() == '<section class="view" id="testnet">', lines[82][:60]
assert lines[91].strip() == '</section>', lines[91][:60]
assert lines[145].strip() == '</script><script type="module">', lines[145][:60]
assert lines[186].strip() == '</script></body></html>', lines[186][:60]

# Replace the later range first so earlier line numbers remain valid.
lines[145:187] = module.split('\n')
lines[82:92] = section.split('\n')
text = '\n'.join(lines)

# 1. Nav entry for the on-chain audit view.
text, n = re.subn(r'(<button data-view="testnet">.*?</button>)',
                  r'\1<button data-view="audit">⬢   On-chain Audit</button>',
                  text, count=1)
assert n == 1, 'nav insert'

# 2. Persistent mode chip in the top bar, next to the demo role selector.
text, n = re.subn(r'(<div class="row">)(<label class="small" for="role">Demo role</label>)',
                  r'\1<span class="tag amber" id="modeChip">● Demo mode · offline simulation</span>\2',
                  text, count=1)
assert n == 1, 'mode chip'

# 3. Sidebar footer becomes mode-aware instead of permanently claiming "no real blockchain connection".
text, n = re.subn(r'<div class="sidefooter">.*?</div>',
                  '<div class="sidefooter"><b id="modeFoot">● DEMO MODE</b><br/><span id="modeFootSub">Simulated USDC, transactions, and approval roles. No real blockchain connection or payments.</span></div>',
                  text, count=1, flags=re.S)
assert n == 1, 'sidefooter'

# 4. Title map needs the new view or go() would throw on it.
text, n = re.subn(r"(testnet:\['Sepolia testnet lab','Optional wallet-connected contract demonstration'\],)",
                  r"\1audit:['On-chain audit ledger','Contract events read straight from Ethereum Sepolia'],",
                  text, count=1)
assert n == 1, 'titles map'

for probe in ['id="modeChip"', 'id="auditRows"', 'data-view="audit"', 'id="chainReject"',
              'id="chainRefund"', 'id="chainReceiptModal"', 'rejectMilestone(uint256',
              'refund(uint256 id,uint256 amount)', 'deployments/sepolia.config.js']:
    assert probe in text, 'missing probe: ' + probe

assert text.count('function refunded(uint256 id,address donor)') == 1
with io.open(INDEX, 'w', encoding='utf-8', newline='') as f:
    f.write(text)
print('written. new line count:', len(text.split('\n')), 'bytes:', len(text.encode('utf-8')))
