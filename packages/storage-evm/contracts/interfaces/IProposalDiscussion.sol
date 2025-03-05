// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IProposalDiscussion {
    function startDiscussion(uint256 _proposalId) external;
    function createComment(uint256 _proposalId, uint256 _parentId, string calldata _content) external;
    function editComment(uint256 _proposalId, uint256 _commentId, string calldata _newContent) external;
    function deleteComment(uint256 _proposalId, uint256 _commentId) external;
    function likeComment(uint256 _proposalId, uint256 _commentId) external;
    function unlikeComment(uint256 _proposalId, uint256 _commentId) external;
    
    function getComment(uint256 _proposalId, uint256 _commentId) external view returns (
        address author,
        uint256 parentId,
        string memory content,
        uint256 timestamp,
        bool isDeleted,
        uint256 likes,
        uint256[] memory replies,
        uint256 replyCount,
        uint256 depth
    );
    
    function getDiscussionDetails(uint256 _proposalId) external view returns (
        uint256 spaceId,
        uint256 startTime,
        uint256 commentCount,
        bool isActive,
        uint256[] memory topLevelComments
    );
    
    function hasLiked(uint256 _proposalId, uint256 _commentId, address _user) external view returns (bool);
    function getCommentReplies(uint256 _proposalId, uint256 _commentId) external view returns (uint256[] memory);

        // Events
    event DiscussionStarted(uint256 indexed proposalId, uint256 indexed spaceId, uint256 startTime);
    event CommentCreated(
        uint256 indexed proposalId, 
        uint256 indexed commentId, 
        uint256 indexed parentId,
        address author, 
        string content,
        uint256 depth
    );
    event CommentEdited(uint256 indexed proposalId, uint256 indexed commentId, string newContent);
    event CommentDeleted(uint256 indexed proposalId, uint256 indexed commentId);
    event CommentLiked(uint256 indexed proposalId, uint256 indexed commentId, address indexed liker);
    event CommentUnliked(uint256 indexed proposalId, uint256 indexed commentId, address indexed unliker);
    event ContractsInitialized(address spaceFactory, address proposalsContract);
    event ContractsUpdated(address indexed newSpaceFactory, address indexed newProposalsContract);
}
