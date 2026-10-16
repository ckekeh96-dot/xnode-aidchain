// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Hackathon TESTNET prototype. Not audited. Do not use with real funds.
interface IERC20Demo {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AidChainEscrow {
    struct Project {
        address payable ngo;
        address reviewer;
        uint256 target;
        uint256 raised;
        uint256 released;
        uint256 refunded;
        uint256 milestoneCount;
        bool exists;
    }
    struct Milestone {
        uint256 amount;
        bytes32 evidenceHash;
        bool submitted;
        bool rejected;
        bool approved;
        bool paid;
    }
    IERC20Demo public immutable token;
    uint256 public nextProjectId = 1;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    /// @notice Gross tokens each donor ever contributed to each project, and what they already took back.
    mapping(uint256 => mapping(address => uint256)) public contributed;
    mapping(uint256 => mapping(address => uint256)) public refunded;
    bool private locked;

    event ProjectCreated(uint256 indexed projectId, address indexed ngo, address indexed reviewer, uint256 target);
    event Donated(uint256 indexed projectId, address indexed donor, uint256 amount);
    event EvidenceSubmitted(uint256 indexed projectId, uint256 indexed milestoneId, bytes32 evidenceHash);
    event MilestoneApproved(uint256 indexed projectId, uint256 indexed milestoneId, address indexed reviewer);
    event MilestoneRejected(uint256 indexed projectId, uint256 indexed milestoneId, address indexed reviewer);
    event FundsReleased(uint256 indexed projectId, uint256 indexed milestoneId, address indexed ngo, uint256 amount);
    event Refunded(uint256 indexed projectId, address indexed donor, uint256 amount);

    modifier nonReentrant() { require(!locked, "Reentrancy"); locked = true; _; locked = false; }
    modifier onlyNGO(uint256 id) { require(projects[id].exists && msg.sender == projects[id].ngo, "Not project NGO"); _; }
    modifier onlyReviewer(uint256 id) { require(projects[id].exists && msg.sender == projects[id].reviewer, "Not reviewer"); _; }

    constructor(address token_) { require(token_ != address(0) && token_.code.length > 0, "Invalid token"); token = IERC20Demo(token_); }

    function createProject(address reviewer, uint256 target, uint256[] calldata allocations) external returns (uint256 id) {
        require(reviewer != address(0) && reviewer != msg.sender, "Independent reviewer required");
        require(target > 0 && allocations.length > 0 && allocations.length <= 12, "Invalid project");
        uint256 sum = 0;
        for (uint256 i = 0; i < allocations.length; ++i) { require(allocations[i] > 0, "Zero milestone"); sum += allocations[i]; }
        require(sum == target, "Milestones must equal target");
        id = nextProjectId++;
        projects[id] = Project(payable(msg.sender), reviewer, target, 0, 0, 0, allocations.length, true);
        for (uint256 i = 0; i < allocations.length; ++i) milestones[id][i] = Milestone(allocations[i], bytes32(0), false, false, false, false);
        emit ProjectCreated(id, msg.sender, reviewer, target);
    }

    function donate(uint256 id, uint256 amount) external nonReentrant {
        Project storage p = projects[id];
        require(p.exists && amount > 0, "Invalid donation");
        require(p.raised + amount <= p.target, "Exceeds target");
        p.raised += amount;
        contributed[id][msg.sender] += amount;
        emit Donated(id, msg.sender, amount);
        _transferFrom(msg.sender, address(this), amount);
    }

    /// @dev A milestone under review cannot be silently re-submitted, so a reviewer can never
    ///      approve an evidence hash other than the one they were shown.
    function submitEvidence(uint256 id, uint256 milestoneId, bytes32 evidenceHash) external onlyNGO(id) {
        require(evidenceHash != bytes32(0), "Evidence hash required");
        require(milestoneId < projects[id].milestoneCount, "Invalid milestone");
        Milestone storage m = milestones[id][milestoneId];
        require(!m.approved && !m.paid, "Already approved");
        require(!m.submitted || m.rejected, "Already under review");
        m.evidenceHash = evidenceHash;
        m.submitted = true;
        m.rejected = false;
        emit EvidenceSubmitted(id, milestoneId, evidenceHash);
    }

    function approveMilestone(uint256 id, uint256 milestoneId) external onlyReviewer(id) {
        require(milestoneId < projects[id].milestoneCount, "Invalid milestone");
        Milestone storage m = milestones[id][milestoneId];
        require(m.submitted && !m.approved, "Not eligible");
        m.approved = true;
        emit MilestoneApproved(id, milestoneId, msg.sender);
    }

    /// @notice Send a milestone back to the NGO for new evidence. Cleared from review so the NGO may re-submit.
    function rejectMilestone(uint256 id, uint256 milestoneId) external onlyReviewer(id) {
        require(milestoneId < projects[id].milestoneCount, "Invalid milestone");
        Milestone storage m = milestones[id][milestoneId];
        require(m.submitted && !m.approved && !m.paid, "Nothing to reject");
        m.submitted = false;
        m.rejected = true;
        emit MilestoneRejected(id, milestoneId, msg.sender);
    }

    function releaseFunds(uint256 id, uint256 milestoneId) external nonReentrant onlyNGO(id) {
        require(milestoneId < projects[id].milestoneCount, "Invalid milestone");
        Project storage p = projects[id];
        Milestone storage m = milestones[id][milestoneId];
        require(m.approved && !m.paid, "Not approved or already paid");
        require(available(id) >= m.amount, "Insufficient escrow");
        m.paid = true;
        p.released += m.amount;
        emit FundsReleased(id, milestoneId, p.ngo, m.amount);
        _transfer(p.ngo, m.amount);
    }

    /// @notice Donors may exit a project that has not yet spent their contribution.
    function refund(uint256 id, uint256 amount) external nonReentrant {
        Project storage p = projects[id];
        require(p.exists && amount > 0, "Invalid refund");
        uint256 claim = refundable(id, msg.sender);
        require(amount <= claim, "Exceeds refundable");
        p.refunded += amount;
        refunded[id][msg.sender] += amount;
        emit Refunded(id, msg.sender, amount);
        _transfer(msg.sender, amount);
    }

    /// @dev Tokens still held for a project: released payouts and taken refunds are both spent.
    function available(uint256 id) public view returns (uint256) {
        Project storage p = projects[id];
        return p.raised - p.released - p.refunded;
    }

    /// @dev A donor may reclaim what they put in, never more than the project still holds.
    ///      When several donors refund the same project, earlier claims are honoured first.
    function refundable(uint256 id, address donor) public view returns (uint256) {
        uint256 undrawn = contributed[id][donor] - refunded[id][donor];
        uint256 held = available(id);
        return undrawn < held ? undrawn : held;
    }

    function milestoneStatus(uint256 id, uint256 milestoneId) external view returns (uint256 amount, bytes32 evidenceHash, string memory state) {
        Milestone storage m = milestones[id][milestoneId];
        amount = m.amount;
        evidenceHash = m.evidenceHash;
        if (m.paid) state = "released";
        else if (m.approved) state = "approved";
        else if (m.rejected) state = "rejected";
        else if (m.submitted) state = "under_review";
        else state = "pending";
    }

    function _transfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20Demo.transfer, (to, amount)));
        require(ok && (data.length == 0 || (data.length == 32 && abi.decode(data, (bool)))), "Token transfer failed");
    }
    function _transferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20Demo.transferFrom, (from, to, amount)));
        require(ok && (data.length == 0 || (data.length == 32 && abi.decode(data, (bool)))), "Token transferFrom failed");
    }
}
