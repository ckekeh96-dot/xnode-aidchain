"""Re-apply the staged Testnet Lab section + chain module into index.html.

index.html is a single 1.2 MB file; this keeps the readable staged sources in .build/
as the source of truth and pushes them in wholesale, verifying the result before writing.
Anchor-based (not line-number based) so it can run repeatedly.
"""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')
SECTION = os.path.join(ROOT, '.build', 'testnet_section.html')
MODULE = os.path.join(ROOT, '.build', 'testnet_module.js')

text = io.open(INDEX, encoding='utf-8', newline='').read()
section = io.open(SECTION, encoding='utf-8', newline='').read().rstrip('\n')
module = io.open(MODULE, encoding='utf-8', newline='').read().rstrip('\n')
before = len(text)

# ---- section region: the testnet <section>, the audit <section>, up to the next view ----
start = text.index('<section class="view" id="testnet">')
audit = text.index('<section class="view" id="audit">', start + 10)
nxt = text.index('<section class="view" id="', audit + 10)
old_section = text[start:nxt]
assert old_section.count('<section') == 2, 'expected testnet+audit sections, got %d' % old_section.count('<section')
assert 'id="auditRows"' in old_section and 'id="connectWallet"' in old_section
text = text[:start] + section + '\n' + text[nxt:]

# ---- module region: the on-chain receipt modal through end of document ----
# Anchor on the receipt modal specifically: an earlier `</script><div class="modal-backdrop"`
# belongs to the offline demo's donation modal, and matching that would delete the demo modals
# and the second classic script.
RECEIPT_ANCHOR = '</script><div class="modal-backdrop" hidden="" id="chainReceiptModal">'
mstart = text.index(RECEIPT_ANCHOR)
mend = text.index('</script></body></html>') + len('</script></body></html>')
old_module = text[mstart:mend]
assert 'type="module"' in old_module and 'xnode_aidchain_chain_v1' in old_module
assert 'donationModal' not in old_module and 'ledgerCheck' not in old_module, 'module anchor overshot into the offline demo'
text = text[:mstart] + module + '\n' + text[mend:]

# ---- every probe must exist exactly once ----
for probe in ['id="modeChip"', 'id="modeFoot"', 'id="modeFootSub"', 'id="auditRows"', 'data-view="audit"',
              'id="chainReject"', 'id="chainRefund"', 'id="chainReceiptModal"', 'id="chainReceiptKicker"',
              'rejectMilestone(uint256', 'refund(uint256 id,uint256 amount)', 'deployments/sepolia.config.js',
              "NETWORKS={", "'0x7a69'", 'Local chain 31337', 'applyDeploymentForCurrentChain',
              'refused so a valueless demo token can never touch real funds']:
    assert text.count(probe) >= 1, 'missing probe: ' + probe

# ---- the duplicate-panel bug that a bad splice would reintroduce ----
for unique in ['id="escrowAddress"', 'id="connectWallet"', 'id="auditSync"', 'id="chainCreate"']:
    assert text.count(unique) == 1, 'duplicate element %s appears %d times' % (unique, text.count(unique))
assert text.count('class="view" id="testnet"') == 1
assert text.count('class="view" id="audit"') == 1

io.open(INDEX, 'w', encoding='utf-8', newline='').write(text)
print('index.html refreshed: %d -> %d bytes' % (before, len(text.encode('utf-8'))))
print('section staged=%d bytes, module staged=%d bytes' % (len(section.encode('utf-8')), len(module.encode('utf-8'))))
