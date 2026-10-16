"""Immutable-aware deployment verification.

A contract with `address public immutable token` cannot be verified by comparing the raw
compiled deployedBytecode against the on-chain code: the artifact keeps a zero placeholder
where the constructor argument is written into the runtime code. This tool fills the
placeholder with the actual token address before comparing.

Two tiers, reported explicitly:
  MATCH (exact)     - byte-identical including the CBOR compiler-metadata trailer.
  MATCH (core code) - logic bytes identical; only the metadata trailer differs. The trailer
                      records the compiler fingerprint (source file paths, EVM version, ipfs
                      hash of build settings). A Remix compile with different paths/settings
                      lands here; a genuine code substitution still fails loudly with a diff.
  MISMATCH          - logic bytes differ; first differing nibbles are printed.

Usage: python .build/verify_code.py <escrow_address> <token_address> [rpc_url]
"""
import io, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('command failed: %s\n%s' % (cmd, (r.stderr or r.stdout)[:400]))
    return r.stdout.strip()

def artifact_runtime(name):
    path = os.path.join(ROOT, 'contracts', 'out', name + '.sol', name + '.json')
    return json.load(io.open(path, encoding='utf-8'))['deployedBytecode']['object'].lower().replace('0x', '')

def onchain_code(addr, rpc):
    return run('cast code --rpc-url %s %s' % (rpc, addr)).lower().replace('0x', '')

def split_trailer(code_hex):
    """Peel the CBOR compiler-metadata trailer (length suffix per the solc convention)."""
    try:
        n = int(code_hex[-4:], 16) + 2
        if 8 <= n <= 256:
            return code_hex[:-2 * n], code_hex[-2 * n:]
    except ValueError:
        pass
    return code_hex, ''

def solc_version(trailer):
    i = trailer.find('64736f6c6343')  # 'dsolc' + 0x43 length byte, then 3 version bytes
    if i >= 0 and len(trailer) >= i + 18:
        v = int(trailer[i + 12:i + 18], 16)
        return '%d.%d.%d' % (v >> 16, (v >> 8) & 0xff, v & 0xff)
    return '?'

def compare(artifact, live):
    if artifact == live:
        print('  MATCH (exact) - byte-identical to the compiled artifact, metadata included')
        return True
    a_core, a_tr = split_trailer(artifact)
    l_core, l_tr = split_trailer(live)
    if a_tr and l_tr and a_core == l_core:
        print('  MATCH (core code) - logic bytes identical; compiler metadata trailer differs')
        print('    solc version: artifact %s | on chain %s' % (solc_version(a_tr), solc_version(l_tr)))
        print('    expected cause: Remix source path / EVM version / optimizer-detail difference;')
        print('    recompile with DEPLOY_SEPOLIA.md Part 4 settings for an exact-byte match.')
        return True
    d = [i for i in range(min(len(artifact), len(live))) if artifact[i] != live[i]]
    print('  MISMATCH - %d differing nibbles, first at %d' % (len(d), d[0] if d else -1))
    if d:
        print('    expected %s' % artifact[max(0, d[0] - 16):d[0] + 32])
        print('    on chain %s' % live[max(0, d[0] - 16):d[0] + 32])
    return False

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    escrow, tokaddr = sys.argv[1], sys.argv[2]
    rpc = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_RPC
    forge = os.path.expanduser('~/.foundry/bin')
    os.environ['PATH'] = forge + os.pathsep + os.environ.get('PATH', '')

    token_runtime = artifact_runtime('MockUSDC')
    live_token = onchain_code(tokaddr, rpc)
    print('MockUSDC       artifact=%d live=%d bytes' % (len(token_runtime) // 2, len(live_token) // 2))
    token_ok = compare(token_runtime, live_token)

    esc_art = artifact_runtime('AidChainEscrow')
    esc_live = onchain_code(escrow, rpc)
    pad = '0' * 24 + tokaddr.lower().replace('0x', '')
    filled = esc_art.replace('7f' + '0' * 64, '7f' + pad)
    print('AidChainEscrow artifact=%d live=%d bytes; immutable token slots filled=%d' % (
        len(esc_art) // 2, len(esc_live) // 2, esc_art.count('7f' + '0' * 64)))
    esc_ok = compare(filled, esc_live)
    if esc_ok and filled != esc_live:
        print('    note: escrow compared with the immutable token address (%s) written into its placeholder slots' % tokaddr)
    return 0 if (token_ok and esc_ok) else 1

rc = main()
print('\nverdict: %s' % ('all deployed code matches the compiled, tested artifacts' if rc == 0 else 'DEPLOYED CODE DOES NOT MATCH'))
sys.exit(rc)
