// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IDAOSpaceFactory {
    function isMember(uint256 _spaceId, address _userAddress) external view returns (bool);
}

interface IDAOProposals {
    function getProposalCore(uint256 _proposalId) external view returns (
        uint256 spaceId,
        string memory question,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        bool expired,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalVotingPowerAtSnapshot,
        address creator
    );
}

contract ProposalDiscussionStorage is Initializable {
    struct Comment {
        uint256 proposalId;
        uint256 parentId;      // 0 for top-level comments, otherwise refers to parent comment ID
        address author;
        string content;
        uint256 timestamp;
        bool isDeleted;
        uint256 likes;
        uint256[] replies;     // Array of reply comment IDs
        uint256 replyCount;    // Total number of direct replies
        uint256 depth;         // Depth in the comment tree (0 for top-level)
    }

    struct Discussion {
        uint256 proposalId;
        uint256 spaceId;
        uint256 startTime;
        uint256 commentCount;
        bool isActive;
        uint256[] topLevelComments; // Array of top-level comment IDs
    }

    // State variables
    IDAOSpaceFactory public spaceFactory;
    IDAOProposals public proposalsContract;
    
    mapping(uint256 => Discussion) public discussions; // proposalId => Discussion
    mapping(uint256 => mapping(uint256 => Comment)) public comments; // proposalId => commentId => Comment
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public userLikes; // proposalId => commentId => user => hasLiked

}