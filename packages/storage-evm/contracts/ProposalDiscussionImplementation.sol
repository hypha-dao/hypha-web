// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/ProposalDiscussionStorage.sol";
import "./interfaces/IProposalDiscussion.sol";

contract ProposalDiscussionImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ProposalDiscussionStorage,
    IProposalDiscussion 
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function setContracts(address _spaceFactory, address _proposalsContract) external onlyOwner {
        require(_spaceFactory != address(0), "Invalid space factory address");
        require(_proposalsContract != address(0), "Invalid proposals contract address");
        
        spaceFactory = IDAOSpaceFactory(_spaceFactory);
        proposalsContract = IDAOProposals(_proposalsContract);
        
        emit ContractsUpdated(_spaceFactory, _proposalsContract);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier onlySpaceMember(uint256 _proposalId) {
        require(address(spaceFactory) != address(0), "Space factory not set");
        require(address(proposalsContract) != address(0), "Proposals contract not set");
        (uint256 spaceId,,,,,,,,,,) = proposalsContract.getProposalCore(_proposalId);
        require(spaceFactory.isMember(spaceId, msg.sender), "Not a space member");
        _;
    }

    modifier discussionExists(uint256 _proposalId) {
        require(discussions[_proposalId].isActive, "Discussion does not exist");
        _;
    }

    modifier proposalActive(uint256 _proposalId) {
        require(address(proposalsContract) != address(0), "Proposals contract not set");
        (,,,, uint256 endTime, bool executed, bool expired,,,,) = proposalsContract.getProposalCore(_proposalId);
        require(block.timestamp <= endTime, "Proposal has ended");
        require(!executed && !expired, "Proposal is no longer active");
        _;
    }

    modifier commentExists(uint256 _proposalId, uint256 _commentId) {
        require(_commentId > 0 && _commentId <= discussions[_proposalId].commentCount, "Comment does not exist");
        _;
    }

    function startDiscussion(uint256 _proposalId) 
        external 
        onlySpaceMember(_proposalId) 
    {
        require(!discussions[_proposalId].isActive, "Discussion already exists");
        require(address(proposalsContract) != address(0), "Proposals contract not set");
        
        (uint256 spaceId,,, uint256 startTime, uint256 endTime, bool executed, bool expired,,,,) = 
            proposalsContract.getProposalCore(_proposalId);
        
        require(block.timestamp >= startTime, "Proposal has not started");
        require(block.timestamp <= endTime, "Proposal has ended");
        require(!executed && !expired, "Proposal is no longer active");

        discussions[_proposalId] = Discussion({
            proposalId: _proposalId,
            spaceId: spaceId,
            startTime: block.timestamp,
            commentCount: 0,
            isActive: true,
            topLevelComments: new uint256[](0)
        });

        emit DiscussionStarted(_proposalId, spaceId, block.timestamp);
    }

    function createComment(
        uint256 _proposalId,
        uint256 _parentId,
        string calldata _content
    ) 
        external 
        onlySpaceMember(_proposalId)
        discussionExists(_proposalId)
        proposalActive(_proposalId)
    {
        require(bytes(_content).length > 0, "Comment cannot be empty");
        require(bytes(_content).length <= 1000, "Comment too long");

        uint256 commentId = discussions[_proposalId].commentCount + 1;
        
        if (_parentId > 0) {
            _handleReplyComment(_proposalId, _parentId, commentId);
        } else {
            _handleTopLevelComment(_proposalId, commentId);
        }

        _createCommentStorage(_proposalId, commentId, _parentId, _content);
    }

    function _handleReplyComment(
        uint256 _proposalId,
        uint256 _parentId,
        uint256 _commentId
    ) internal {
        require(_parentId <= discussions[_proposalId].commentCount, "Parent comment does not exist");
        Comment storage parentComment = comments[_proposalId][_parentId];
        require(!parentComment.isDeleted, "Cannot reply to deleted comment");
        
        parentComment.replies.push(_commentId);
        parentComment.replyCount++;
    }

    function _handleTopLevelComment(
        uint256 _proposalId,
        uint256 _commentId
    ) internal {
        discussions[_proposalId].topLevelComments.push(_commentId);
    }

    function _createCommentStorage(
        uint256 _proposalId,
        uint256 _commentId,
        uint256 _parentId,
        string calldata _content
    ) internal {
        uint256 depth = _parentId > 0 ? comments[_proposalId][_parentId].depth + 1 : 0;

        comments[_proposalId][_commentId] = Comment({
            proposalId: _proposalId,
            parentId: _parentId,
            author: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            isDeleted: false,
            likes: 0,
            replies: new uint256[](0),
            replyCount: 0,
            depth: depth
        });

        discussions[_proposalId].commentCount = _commentId;

        emit CommentCreated(_proposalId, _commentId, _parentId, msg.sender, _content, depth);
    }

    function editComment(uint256 _proposalId, uint256 _commentId, string calldata _newContent) 
        external 
        onlySpaceMember(_proposalId)
        discussionExists(_proposalId)
        proposalActive(_proposalId)
        commentExists(_proposalId, _commentId)
    {
        require(bytes(_newContent).length > 0, "Comment cannot be empty");
        require(bytes(_newContent).length <= 1000, "Comment too long");
        
        Comment storage comment = comments[_proposalId][_commentId];
        require(comment.author == msg.sender, "Not comment author");
        require(!comment.isDeleted, "Comment is deleted");

        comment.content = _newContent;
        comment.timestamp = block.timestamp;

        emit CommentEdited(_proposalId, _commentId, _newContent);
    }

    function deleteComment(uint256 _proposalId, uint256 _commentId) 
        external 
        onlySpaceMember(_proposalId)
        discussionExists(_proposalId)
        commentExists(_proposalId, _commentId)
    {
        Comment storage comment = comments[_proposalId][_commentId];
        require(comment.author == msg.sender, "Not comment author");
        require(!comment.isDeleted, "Comment already deleted");

        comment.isDeleted = true;
        comment.content = "";

        emit CommentDeleted(_proposalId, _commentId);
    }

    function likeComment(uint256 _proposalId, uint256 _commentId) 
        external 
        onlySpaceMember(_proposalId)
        discussionExists(_proposalId)
        commentExists(_proposalId, _commentId)
    {
        require(!comments[_proposalId][_commentId].isDeleted, "Comment is deleted");
        require(!userLikes[_proposalId][_commentId][msg.sender], "Already liked");

        comments[_proposalId][_commentId].likes++;
        userLikes[_proposalId][_commentId][msg.sender] = true;

        emit CommentLiked(_proposalId, _commentId, msg.sender);
    }

    function unlikeComment(uint256 _proposalId, uint256 _commentId) 
        external 
        onlySpaceMember(_proposalId)
        discussionExists(_proposalId)
        commentExists(_proposalId, _commentId)
    {
        require(!comments[_proposalId][_commentId].isDeleted, "Comment is deleted");
        require(userLikes[_proposalId][_commentId][msg.sender], "Haven't liked");

        comments[_proposalId][_commentId].likes--;
        userLikes[_proposalId][_commentId][msg.sender] = false;

        emit CommentUnliked(_proposalId, _commentId, msg.sender);
    }

    function getComment(uint256 _proposalId, uint256 _commentId) 
        external 
        view 
        returns (
            address author,
            uint256 parentId,
            string memory content,
            uint256 timestamp,
            bool isDeleted,
            uint256 likes,
            uint256[] memory replies,
            uint256 replyCount,
            uint256 depth
        ) 
    {
        Comment storage comment = comments[_proposalId][_commentId];
        return (
            comment.author,
            comment.parentId,
            comment.content,
            comment.timestamp,
            comment.isDeleted,
            comment.likes,
            comment.replies,
            comment.replyCount,
            comment.depth
        );
    }

    function getDiscussionDetails(uint256 _proposalId)
        external
        view
        returns (
            uint256 spaceId,
            uint256 startTime,
            uint256 commentCount,
            bool isActive,
            uint256[] memory topLevelComments
        )
    {
        Discussion storage discussion = discussions[_proposalId];
        return (
            discussion.spaceId,
            discussion.startTime,
            discussion.commentCount,
            discussion.isActive,
            discussion.topLevelComments
        );
    }

    function hasLiked(uint256 _proposalId, uint256 _commentId, address _user) 
        external 
        view 
        returns (bool) 
    {
        return userLikes[_proposalId][_commentId][_user];
    }

    function getCommentReplies(uint256 _proposalId, uint256 _commentId)
        external
        view
        returns (uint256[] memory)
    {
        return comments[_proposalId][_commentId].replies;
    }
}