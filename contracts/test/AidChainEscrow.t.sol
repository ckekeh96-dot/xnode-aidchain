// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AidChainEscrow.sol";
import "../src/MockUSDC.sol";

interface Vm { function prank(address) external; function expectRevert() external; }
contract AidChainEscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockUSDC token;
    AidChainEscrow escrow;
    address constant NGO = address(0x1001);
    address constant REVIEWER = address(0x1002);
    address constant DONOR = address(0x1003);
    address constant DONOR2 = address(0x1004);
    uint256 constant FULL = 1_000_000_000;   // 1000.0 dUSDC project target
    uint256 constant M0 = 400_000_000;       // 400.0 first milestone
    uint256 constant M1 = 600_000_000;       // 600.0 second milestone

    function setUp() public {
        token = new MockUSDC(); escrow = new AidChainEscrow(address(token));
        token.mint(DONOR, FULL); token.mint(DONOR2, FULL);
        vm.prank(DONOR); token.approve(address(escrow), type(uint256).max);
        vm.prank(DONOR2); token.approve(address(escrow), type(uint256).max);
    }
    function create() internal returns (uint256 id) {
        uint256[] memory a = new uint256[](2); a[0] = M0; a[1] = M1;
        vm.prank(NGO); id = escrow.createProject(REVIEWER, FULL, a);
    }
    function fund() internal returns (uint256 id) { id = create(); vm.prank(DONOR); escrow.donate(id, FULL); }
    function approveFirst(uint256 id) internal {
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("evidence"));
        vm.prank(REVIEWER); escrow.approveMilestone(id, 0);
    }
    function accounting(uint256 id) internal view returns (uint256 raised, uint256 released, uint256 refunded) {
        (, , , raised, released, refunded, , ) = escrow.projects(id);
    }

    function testDonationApprovalRelease() public {
        uint256 id = fund();
        approveFirst(id);
        vm.prank(NGO); escrow.releaseFunds(id, 0);
        require(token.balanceOf(NGO) == M0, "NGO not paid");
        (uint256 raised, uint256 released, uint256 refd) = accounting(id);
        require(raised == FULL && released == M0 && refd == 0, "Accounting error");
    }
    function testOnlyReviewerCanApprove() public {
        uint256 id = fund();
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("evidence"));
        vm.expectRevert(); vm.prank(DONOR); escrow.approveMilestone(id, 0);
    }
    function testCannotReleaseTwice() public {
        uint256 id = fund(); approveFirst(id);
        vm.prank(NGO); escrow.releaseFunds(id, 0);
        vm.expectRevert(); vm.prank(NGO); escrow.releaseFunds(id, 0);
    }
    function testCannotApproveWithoutEvidence() public {
        uint256 id = fund();
        vm.expectRevert(); vm.prank(REVIEWER); escrow.approveMilestone(id, 0);
    }

    // ---- reviewer reject ----
    function testRejectReturnsMilestoneToNGO() public {
        uint256 id = fund();
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("weak"));
        vm.prank(REVIEWER); escrow.rejectMilestone(id, 0);
        (, , bool submitted, bool rejected, bool approved, bool paid) = escrow.milestones(id, 0);
        require(!submitted && rejected && !approved && !paid, "state not rejected");
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("better"));
        vm.prank(REVIEWER); escrow.approveMilestone(id, 0);
        vm.prank(NGO); escrow.releaseFunds(id, 0);
        require(token.balanceOf(NGO) == M0, "reject blocked later release");
    }
    function testOnlyReviewerCanReject() public {
        uint256 id = fund();
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("evidence"));
        vm.expectRevert(); vm.prank(NGO); escrow.rejectMilestone(id, 0);
        vm.expectRevert(); vm.prank(DONOR); escrow.rejectMilestone(id, 0);
    }
    function testCannotRejectWithoutSubmission() public {
        uint256 id = fund();
        vm.expectRevert(); vm.prank(REVIEWER); escrow.rejectMilestone(id, 0);
    }
    function testCannotRejectOrApproveAfterApproval() public {
        uint256 id = fund(); approveFirst(id);
        vm.expectRevert(); vm.prank(REVIEWER); escrow.rejectMilestone(id, 0);
    }
    function testCannotApproveAfterReject() public {
        uint256 id = fund();
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("evidence"));
        vm.prank(REVIEWER); escrow.rejectMilestone(id, 0);
        vm.expectRevert(); vm.prank(REVIEWER); escrow.approveMilestone(id, 0);
    }
    function testEvidenceCannotChangeWhileUnderReview() public {
        uint256 id = fund();
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("first"));
        vm.expectRevert(); vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("swapped"));
    }
    function _state(uint256 id, uint256 m) internal view returns (bytes32) {
        string memory s; (, , s) = escrow.milestoneStatus(id, m);
        return keccak256(bytes(s));
    }
    function testMilestoneStatusStrings() public {
        uint256 id = fund();
        require(_state(id, 0) == keccak256("pending"), "should be pending");
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("evidence"));
        require(_state(id, 0) == keccak256("under_review"), "should be under_review");
        vm.prank(REVIEWER); escrow.rejectMilestone(id, 0);
        require(_state(id, 0) == keccak256("rejected"), "reject not visible to donors");
        vm.prank(NGO); escrow.submitEvidence(id, 0, keccak256("better"));
        require(_state(id, 0) == keccak256("under_review"), "resubmit not visible");
        vm.prank(REVIEWER); escrow.approveMilestone(id, 0);
        require(_state(id, 0) == keccak256("approved"), "should be approved");
        vm.prank(NGO); escrow.releaseFunds(id, 0);
        require(_state(id, 0) == keccak256("released"), "should be released");
    }

    // ---- donor refund ----
    function testRefundReturnsTokens() public {
        uint256 id = fund();
        vm.prank(DONOR); escrow.refund(id, 300_000_000);
        require(token.balanceOf(DONOR) == 300_000_000, "donor not repaid");
        (, , uint256 refd) = accounting(id);
        require(refd == 300_000_000, "refund not recorded");
        require(escrow.available(id) == 700_000_000, "available wrong");
    }
    function testCannotRefundMoreThanContributed() public {
        uint256 id = create();
        vm.prank(DONOR); escrow.donate(id, 400_000_000);
        vm.expectRevert(); vm.prank(DONOR); escrow.refund(id, 400_000_001);
        vm.prank(DONOR); escrow.refund(id, 400_000_000);
        vm.expectRevert(); vm.prank(DONOR); escrow.refund(id, 1);
    }
    function testRefundCannotExceedProjectHoldings() public {
        uint256 id = create();
        vm.prank(DONOR); escrow.donate(id, 600_000_000);
        vm.prank(DONOR2); escrow.donate(id, 400_000_000);
        approveFirst(id);                                   // milestone 0 (400m) approved, not released
        vm.prank(DONOR2); escrow.refund(id, 400_000_000);   // leaves 600m held for 600m of claims
        vm.expectRevert(); vm.prank(DONOR); escrow.refund(id, 600_000_001);
        vm.prank(DONOR); escrow.refund(id, 600_000_000);
        require(escrow.available(id) == 0, "escrow not emptied");
        vm.expectRevert(); vm.prank(NGO); escrow.releaseFunds(id, 0); // approved payout cannot overdraw
    }
    function testApprovedReleaseSurvivesPartialRefund() public {
        uint256 id = fund(); approveFirst(id);
        vm.prank(DONOR); escrow.refund(id, 200_000_000);
        vm.prank(NGO); escrow.releaseFunds(id, 0);
        require(token.balanceOf(NGO) == M0, "NGO underpaid");
        (uint256 raised, uint256 released, uint256 refd) = accounting(id);
        require(raised == FULL && released == M0 && refd == 200_000_000, "accounting drift");
        require(escrow.available(id) == 400_000_000, "available drift");
    }
    function testEscrowTokenBalanceMatchesAccounting() public {
        uint256 id = fund(); approveFirst(id);
        vm.prank(NGO); escrow.releaseFunds(id, 0);
        vm.prank(DONOR); escrow.refund(id, 250_000_000);
        (uint256 raised, uint256 released, uint256 refd) = accounting(id);
        require(token.balanceOf(address(escrow)) == raised - released - refd, "balance/accounting mismatch");
        require(token.balanceOf(address(escrow)) == escrow.available(id), "view mismatch");
    }
    function testCannotRefundUnknownProject() public {
        vm.expectRevert(); vm.prank(DONOR); escrow.refund(99, 1);
    }
    function testZeroAmountGuard() public {
        uint256 id = fund();
        vm.expectRevert(); vm.prank(DONOR); escrow.refund(id, 0);
        vm.expectRevert(); vm.prank(DONOR); escrow.donate(id, 0);
    }
    function testCannotDonateBeyondTarget() public {
        uint256 id = fund();
        vm.expectRevert(); vm.prank(DONOR2); escrow.donate(id, 1);
    }
    function testNonNGOCannotRelease() public {
        uint256 id = fund(); approveFirst(id);
        vm.expectRevert(); vm.prank(DONOR); escrow.releaseFunds(id, 0);
    }
}
