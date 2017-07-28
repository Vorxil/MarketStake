pragma solidity ^0.4.11;

contract Owned {
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }
    
    event LogTransferedOwnership(address from, address to);
    
    function Owned() {
        owner = msg.sender;
    }
    
    function transferOwnership(address new_owner) external onlyOwner {
        require(owner != new_owner);
        require(new_owner != address(0));
        
        owner = new_owner;
        LogTransferedOwnership(msg.sender, new_owner);
    }
}

contract Upgradeable is Owned {
    
    address upgradeTo = address(0);
    uint upgradeTimeBlocks = 0;
    bool scheduled = false;
    
    event LogUpgradeScheduled(
        address upgradeTo,
        string sourceCodeAt,
        string compileOpts,
        bytes32 sha3Hash,
        uint scheduledBlock
    );
    event LogUpgraded(address to, uint time);
    
    function scheduleUpgrade(
        address _upgradeTo,
        string sourceCodeAt,
        string compileOpts,
        bytes32 sha3Hash,
        uint daysAhead
    )
    external
    onlyOwner
    {
        require(!scheduled);
        require(_upgradeTo != address(0));
        require(daysAhead >= (2 weeks));
        
        upgradeTo = _upgradeTo;
        upgradeTimeBlocks = block.number + (daysAhead)/(5 seconds);
        scheduled = true;
        
        LogUpgradeScheduled(_upgradeTo, sourceCodeAt, compileOpts, sha3Hash, upgradeTimeBlocks);
    }
    
    function upgradeDuties() private;
    
    function upgrade() external onlyOwner {
        require(scheduled);
        require(block.number >= upgradeTimeBlocks);
        
        upgradeDuties();
        LogUpgraded(upgradeTo, block.number);
        selfdestruct(upgradeTo);
    }
}