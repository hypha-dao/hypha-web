// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SpaceFactory {
    struct Space {
        string title;
        string description;
        string slug;
        address owner;
        uint256 createdAt;
    }

    mapping(string => Space) public spaces;
    string[] public slugs;

    event SpaceCreated(
        string slug,
        string title,
        address indexed owner,
        uint256 timestamp
    );

    function createSpace(
        string memory title,
        string memory description,
        string memory slug
    ) public returns (bool) {
        require(bytes(spaces[slug].slug).length == 0, "Slug already exists");

        spaces[slug] = Space({
            title: title,
            description: description,
            slug: slug,
            owner: msg.sender,
            createdAt: block.timestamp
        });

        slugs.push(slug);

        emit SpaceCreated(slug, title, msg.sender, block.timestamp);
        return true;
    }

    function getSpace(string memory slug) public view returns (Space memory) {
        require(bytes(spaces[slug].slug).length > 0, "Space not found");
        return spaces[slug];
    }

    function getAllSlugs() public view returns (string[] memory) {
        return slugs;
    }
}
