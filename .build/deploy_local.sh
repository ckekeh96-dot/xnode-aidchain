#!/usr/bin/env bash
# Deploys AidChainEscrow + MockUSDC to a LOCAL anvil test chain and walks the
# full milestone lifecycle. Local anvil dev keys only -- never a real wallet.
#
# Usage:  bash .build/deploy_local.sh          (expects anvil on 127.0.0.1:8546)
set -uo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts"
RPC="${RPC:-http://127.0.0.1:8546}"

# anvil default accounts 0-3 (public, test-only, worth nothing)
K0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
K1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
K2=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
K3=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
A0=$(cast wallet address --private-key "$K0")   # deployer
A1=$(cast wallet address --private-key "$K1")   # NGO
A2=$(cast wallet address --private-key "$K2")   # independent reviewer
A3=$(cast wallet address --private-key "$K3")   # donor

FAIL=0
say()  { printf '\n== %s\n' "$1"; }
ok()   { printf '   ok   %s\n' "$1"; }
bad()  { printf '   FAIL %s\n' "$1"; FAIL=1; }
check(){ [ "$2" = "$3" ] && ok "$1: $2" || bad "$1: got $2, expected $3"; }

tx() { # tx <label> <private-key> <contract> <sig> <args...>
  local label="$1" key="$2"; shift 2
  local out; out=$(cast send "$@" --private-key "$key" --rpc-url "$RPC" --json 2>&1) \
    || { bad "$label (send failed: $out)"; return 1; }
  local h; h=$(printf '%s' "$out" | python -c "import json,sys;d=json.load(sys.stdin);print(d.get('transactionHash'),d.get('status'))")
  case "$h" in 0x*' 0x1') ok "$label  ${h% *}" ;; *) bad "$label status=$h" ;; esac
}
expect_revert() { # expect_revert <label> <contract> <sig> <args...>
  local label="$1"; shift
  local out; if out=$(cast call "$@" --rpc-url "$RPC" 2>&1); then
    bad "$label -- UNEXPECTED SUCCESS, guard missing"
  else
    ok "$label -- reverted: $(printf '%s' "$out" | sed -n 's/.*reverted: \([^,]*\).*/\1/p' | head -1)"
  fi
}
readv() { # readv <contract> <call-sig> <out-types> <index> <args...>
  local c="$1" sig="$2" outs="$3" idx="$4"; shift 4
  local data; data=$(cast call "$c" "$sig" "$@" --rpc-url "$RPC") || { printf 'READ-FAILED'; return 1; }
  cast abi-decode --json "$sig($outs)" "$data" | python -c "import json,sys;print(json.load(sys.stdin)['data'][$idx])"
}
read1() { local c="$1" sig="$2" outs="$3"; shift 3; readv "$c" "$sig" "$outs" 0 "$@"; }
PROJ_OUT="address,address,uint256,uint256,uint256,uint256,uint256,bool"

say "chain check"
NODE_ACCOUNTS=$(cast rpc eth_accounts --rpc-url "$RPC" 2>/dev/null)
for pair in "A0:$A0" "A1:$A1" "A2:$A2" "A3:$A3"; do
  name=${pair%%:*}; addr=${pair#*:}; lower=$(printf '%s' "$addr" | tr 'A-Z' 'a-z')
  printf '%s' "$NODE_ACCOUNTS" | tr 'A-Z' 'a-z' | grep -q "$lower" || bad "$name $addr is not a node account"
done
ok "node up, $(cast block-number --rpc-url "$RPC") blocks mined"
ok "deployer $A0  NGO $A1  reviewer $A2  donor $A3"

say "deploy"
TOKEN=$(forge create src/MockUSDC.sol:MockUSDC --rpc-url "$RPC" --private-key "$K0" --broadcast --json \
        | python -c "import json,sys;print(json.load(sys.stdin)['deployedTo'])") || bad "MockUSDC deploy"
ESCROW=$(forge create src/AidChainEscrow.sol:AidChainEscrow --rpc-url "$RPC" --private-key "$K0" --broadcast --json \
        --constructor-args "$TOKEN" | python -c "import json,sys;print(json.load(sys.stdin)['deployedTo'])") || bad "escrow deploy"
ok "MockUSDC       $TOKEN"
ok "AidChainEscrow $ESCROW"

say "input guards"
expect_revert "creator cannot name themselves reviewer" \
  "$ESCROW" "createProject(address,uint256,uint256[])" "$A1" "$A1" "[1000000000]" --from "$A1"
expect_revert "milestone allocations must sum to target" \
  "$ESCROW" "createProject(address,uint256,uint256[])" "$A2" "$A1" "[999]" --from "$A1"

say "NGO creates project 1: target 1000 dUSDC, milestones 400 / 600"
tx "createProject" "$K1" "$ESCROW" "createProject(address,uint256,uint256[])" "$A2" 1000000000 "[400000000,600000000]"
check "nextProjectId" "$(read1 "$ESCROW" "nextProjectId()" "uint256")" "2"

say "donor funds the escrow"
tx "mint 1000 dUSDC to donor" "$K0" "$TOKEN" "mint(address,uint256)" "$A3" 1000000000
tx "donor approve escrow" "$K3" "$TOKEN" "approve(address,uint256)" "$ESCROW" 1000000000
tx "donate 1000 dUSDC" "$K3" "$ESCROW" "donate(uint256,uint256)" 1 1000000000
check "escrow holds"   "$(read1 "$TOKEN" "balanceOf(address)" "uint256" "$ESCROW")" "1000000000"
check "available(1)"   "$(read1 "$ESCROW" "available(uint256)" "uint256" 1)" "1000000000"
expect_revert "donation above remaining target" "$ESCROW" "donate(uint256,uint256)" 1 1 --from "$A3"

say "milestone 0: submit -> REJECT -> resubmit -> approve -> release"
tx "submit evidence (weak)" "$K1" "$ESCROW" "submitEvidence(uint256,uint256,bytes32)" 1 0 "$(cast keccak "ipfs://demo/evidence-a")"
STATE=$(readv "$ESCROW" "milestoneStatus(uint256,uint256)" "uint256,bytes32,string" 2 1 0)
check "state after submit" "$STATE" "under_review"
tx "reviewer rejects" "$K2" "$ESCROW" "rejectMilestone(uint256,uint256)" 1 0
STATE=$(readv "$ESCROW" "milestoneStatus(uint256,uint256)" "uint256,bytes32,string" 2 1 0)
check "state after reject" "$STATE" "rejected"
expect_revert "approve a rejected milestone without new evidence" "$ESCROW" "approveMilestone(uint256,uint256)" 1 0 --from "$A2"
tx "NGO resubmits stronger evidence" "$K1" "$ESCROW" "submitEvidence(uint256,uint256,bytes32)" 1 0 "$(cast keccak "ipfs://demo/evidence-b")"
tx "reviewer approves" "$K2" "$ESCROW" "approveMilestone(uint256,uint256)" 1 0
expect_revert "donor cannot release funds" "$ESCROW" "releaseFunds(uint256,uint256)" 1 0 --from "$A3"
tx "NGO releases milestone 0" "$K1" "$ESCROW" "releaseFunds(uint256,uint256)" 1 0
check "NGO paid 400"        "$(read1 "$TOKEN" "balanceOf(address)" "uint256" "$A1")" "400000000"
check "available(1)"        "$(read1 "$ESCROW" "available(uint256)" "uint256" 1)" "600000000"
check "state after release" "$(readv "$ESCROW" "milestoneStatus(uint256,uint256)" "uint256,bytes32,string" 2 1 0)" "released"
expect_revert "double release of milestone 0" "$ESCROW" "releaseFunds(uint256,uint256)" 1 0 --from "$A1"

say "donor exit: partial refund, then the milestone-1 guard"
tx "donor refunds 200 dUSDC" "$K3" "$ESCROW" "refund(uint256,uint256)" 1 200000000
check "available(1)"            "$(read1 "$ESCROW" "available(uint256)" "uint256" 1)" "400000000"
check "refundable(1, donor)"    "$(read1 "$ESCROW" "refundable(uint256,address)" "uint256" 1 "$A3")" "400000000"
expect_revert "refund beyond own remaining contribution" "$ESCROW" "refund(uint256,uint256)" 1 900000000 --from "$A3"
tx "submit evidence milestone 1" "$K1" "$ESCROW" "submitEvidence(uint256,uint256,bytes32)" 1 1 "$(cast keccak "ipfs://demo/evidence-c")"
tx "reviewer approves milestone 1" "$K2" "$ESCROW" "approveMilestone(uint256,uint256)" 1 1
expect_revert "release milestone 1 (600) with only 400 in escrow" "$ESCROW" "releaseFunds(uint256,uint256)" 1 1 --from "$A1"
tx "donor refunds the last 400 dUSDC" "$K3" "$ESCROW" "refund(uint256,uint256)" 1 400000000

say "final accounting: released + refunded == raised, escrow empty"
RAISED=$(readv   "$ESCROW" "projects(uint256)" "$PROJ_OUT" 3 1)
RELEASED=$(readv "$ESCROW" "projects(uint256)" "$PROJ_OUT" 4 1)
REFUNDED=$(readv "$ESCROW" "projects(uint256)" "$PROJ_OUT" 5 1)
check "raised"   "$RAISED" "1000000000"
check "released" "$RELEASED" "400000000"
check "refunded" "$REFUNDED" "600000000"
check "released + refunded == raised" "$((RELEASED + REFUNDED))" "$RAISED"
check "escrow token balance" "$(read1 "$TOKEN" "balanceOf(address)" "uint256" "$ESCROW")" "0"
check "NGO wallet"   "$(read1 "$TOKEN" "balanceOf(address)" "uint256" "$A1")" "400000000"
check "donor wallet" "$(read1 "$TOKEN" "balanceOf(address)" "uint256" "$A3")" "600000000"

say "on-chain event log (what the dashboard audit reads)"
count_logs(){ cast logs --from-block 0 --to-block latest --address "$ESCROW" "$1" --rpc-url "$RPC" 2>/dev/null | grep -c 'blockHash'; }
check "ProjectCreated events"    "$(count_logs 'ProjectCreated(uint256,address,address,uint256)')" "1"
check "Donated events"           "$(count_logs 'Donated(uint256,address,uint256)')" "1"
check "EvidenceSubmitted events" "$(count_logs 'EvidenceSubmitted(uint256,uint256,bytes32)')" "3"
check "MilestoneRejected events" "$(count_logs 'MilestoneRejected(uint256,uint256,address)')" "1"
check "MilestoneApproved events" "$(count_logs 'MilestoneApproved(uint256,uint256,address)')" "2"
check "FundsReleased events"     "$(count_logs 'FundsReleased(uint256,uint256,address,uint256)')" "1"
check "Refunded events"          "$(count_logs 'Refunded(uint256,address,uint256)')" "2"

printf '\n== %s\n' "$([ "$FAIL" = 0 ] && echo 'ALL CHECKS PASSED' || echo 'SOME CHECKS FAILED')"
printf '{"network":"anvil-local","chainId":%s,"token":"%s","escrow":"%s","deployer":"%s"}\n' \
  "$(cast chain-id --rpc-url "$RPC")" "$TOKEN" "$ESCROW" "$A0"
exit "$FAIL"
