pragma solidity ^0.4.11;

import "./Owned.sol";

contract UUID is Owned {
    
    mapping(bytes32 => bool) public exists;
    uint public nonce = 0;
    
    modifier mustExist(bytes32 id) {
        require(exists[id]);
        _;
    }
    
    modifier validAccount(address account) {
        require(account != address(0));
        _;
    }
    
    function setExists(bytes32 id, bool value) external onlyOwner {
        exists[id] = value;
    }
    
    function new_id(address account) 
    external
    onlyOwner
    validAccount(account)
    returns(bytes32)
    {
        return sha3(this, account, block.number, nonce++);
    }
    
    function() { revert(); }
}