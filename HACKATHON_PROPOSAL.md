# XNode AidChain
## Web3 for Social Good Hackathon 2026 — Tech Track Proposal

**Theme:** From Vision to Impact: Building Web3 for Social Good — Collaborate. Innovate. Build for Good.

**Project:** XNode AidChain — Transparent, Milestone-Based Community Funding

**Proposed applicant/team:** XNodes (Pty) Ltd / Charles Kennedy Ekeh (confirm official entrant and team eligibility with organizers)

## Executive summary

XNode AidChain is a transparent, milestone-based community funding platform designed to help NGOs, donors, and local communities follow a contribution from its initial pledge to a documented project milestone. Rather than relying only on retrospective financial reports, the proposed production system would use smart-contract escrow, independent milestone approvals, and public transaction receipts to provide verifiable fund movement while keeping personal beneficiary information private.

## Problem and beneficiaries

Small community initiatives often struggle to demonstrate how donor money was allocated, when activities were completed, and who approved the release of funds. Donors may lack a consistent, independently verifiable record, while responsible NGOs face a high administrative burden. Intended users include community organizations, funders, local reviewers, and public auditors, beginning with a small South African pilot.

## Solution and meaningful Web3 use

1. **Project registry:** verified organizations publish funding targets and measurable milestones.
2. **Escrow:** donations enter a project-specific smart-contract escrow (production design).
3. **Evidence:** project managers submit references and content hashes for milestone documentation; personal data remains off-chain.
4. **Independent review:** authorized community reviewers approve or reject submitted milestones.
5. **Controlled release:** approval triggers a contract-enforced release within budget and policy limits.
6. **Public accountability:** immutable transaction events can be independently checked without revealing sensitive beneficiary identities.

Web3 is used for independent verification of custody, approvals, and payments—not for storing personal information or treating every application function as an on-chain operation.

## Demonstration scope (implemented)

The included offline browser prototype demonstrates the complete product journey with fictional projects and simulated USDC: project browsing, demo donations, NGO evidence submissions, reviewer approvals/rejections, simulated escrow releases, an event audit ledger, ledger-integrity checks, and a social-impact dashboard. It includes a role switcher to make judging easier. **No live chain, wallet, smart contract, or actual fund transfer is included in this version.**

## Technical architecture (production proposal)

- **Frontend:** React + TypeScript, accessible responsive interface, wallet connection, multilingual-ready UI.
- **Backend/indexer:** Node.js or Python API for organization metadata, document access policies, analytics, and blockchain event indexing.
- **Contracts:** project registry, per-project USDC escrow, milestone approvals, capped payouts, pausing and recovery governance; audited Solidity on a suitable EVM chain.
- **Evidence:** content-addressed hashes on-chain; encrypted off-chain evidence with consent and access controls.
- **Identity/governance:** verified NGO registration, independent reviewers, multi-signature authorization, anti-collusion and dispute mechanisms.
- **Security:** reentrancy protection, explicit state transitions, role separation, tests and formalized invariants, independent audit before real funds.

### Example lifecycle

`Donor → Project escrow → Evidence submitted → Independent approval → Milestone payout → Public receipt`

## Social impact plan

**Pilot hypothesis:** Public, independently verifiable milestone records improve donor trust and reduce reconciliation effort for participating NGOs.

**Pilot design:** Recruit 2–3 community organizations and independent reviewers; conduct a 90-day non-custodial or testnet pilot; evaluate the workflow with donors and project beneficiaries.

**Measurement targets (proposed, not achieved):**
- 100% of simulated or testnet disbursements have a linked approval record.
- 100% of participating projects define measurable milestones before funding.
- Reduce median time required to assemble a project funding audit report versus a documented baseline.
- Track verified output indicators (e.g., water filters installed or learners served) with third-party confirmation and consent.
- Record reviewer disagreements, appeals, and incomplete projects, not only successful releases.

## Sustainability and inclusion

Potential sustainability combines NGO subscriptions for reporting tools, grant support for onboarding, and modest transparent processing fees for institutional partners, with fee waivers for small community groups. Any future business model must avoid diverting excessive funding from beneficiaries. Provide mobile-first access, low-bandwidth views, fiat on/off-ramp partnerships where lawful, and non-wallet interfaces for beneficiaries.

## Risks and safeguards

- **False evidence/collusion:** independent review, sample audits, appeals, and fraud reporting.
- **Privacy:** never publish beneficiary identities or sensitive documents on-chain.
- **Smart contract loss:** testnets first, audited contracts, payout limits, emergency pause and recovery policies.
- **Regulatory and operational:** review payment services, charity laws, tax, AML/KYC, and stablecoin requirements in target jurisdictions.
- **Access barriers:** support assisted onboarding, accessible design, and multilingual interfaces.
- **Governance capture:** separate project managers from approvers; document conflict-of-interest rules.

## Judging alignment

| Criterion | Weight | Submission evidence |
|---|---:|---|
| Social impact potential and relevance | 30% | Donor accountability problem, community pilot, measurable outputs |
| Solution quality | 25% | Working interactive demo, controlled milestone workflow, technical roadmap |
| Innovation / meaningful Web3 | 20% | Project escrow and independent verification design |
| Feasibility / sustainability | 15% | Staged rollout, governance, privacy, funding model |
| Presentation / demo | 10% | Three-minute scripted demo and clear user journey |

## Suggested 3-minute live pitch

**0:00–0:25 — Problem.** “Communities need support, and donors need to know how funds become real outcomes.”

**0:25–0:50 — Solution.** “AidChain links every contribution to project milestones, reviewer decisions, and visible release records.”

**0:50–1:40 — Live demo.** Make a simulated donation, then show the audit entry.

**1:40–2:25 — Accountability.** Submit evidence as an NGO, approve it as a reviewer, and show simulated release and updated totals.

**2:25–2:45 — Web3 architecture.** Explain that production smart contracts would enforce custody and payouts; encrypted evidence stays off-chain.

**2:45–3:00 — Ask.** Seek pilot NGOs, reviewers, technical mentorship, and partners for a testnet trial.

## Delivery plan

**Now:** working browser-based demo and proposal.

**Next 2 weeks:** formal requirements, UX feedback, threat model, Solidity escrow implementation, and automated contract tests.

**Next 4–6 weeks:** testnet deployment, wallet integration, signed reviewer approvals, event indexing, and secure evidence hashes.

**Following 8–12 weeks:** small NGO pilot, independent security review, accessibility and privacy testing, and impact evaluation.

## Important event details to verify

Based on the supplied hackathon brief: shortlisting **October 26, 2026**; final presentation **November 26, 2026**, at SMU, Singapore. Confirm application deadline, prize amounts, remote participation, team size, and travel requirements with organizers. The user-provided timeline includes an ambiguous “Sep – Oct 25” line; seek clarification rather than assuming the build period.
