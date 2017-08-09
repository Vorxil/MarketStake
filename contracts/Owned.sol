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

contract Allowable is Owned {

	struct OneIndexedBool {bool value; uint index;}
	mapping(address => OneIndexedBool) public allowed;
	address[] public index;
	
	modifier onlyAllowed() {
		require(allowed[msg.sender].value);
		_;
	}
	
	event LogAllowed(address account);
	event LogDisallowed(address account);
	
	function allow(address account) external onlyOwner {
		require(account != address(0));
		require(!allowed[account].value);
		index.push(account);
		allowed[account] = OneIndexedBool(true, index.length);
		LogAllowed(account);
	}
	
	function disallow(address account) external onlyOwner {
		require(account != address(0));
		require(allowed[account].value);
		uint id = allowed[account].index;
		index[id-1] = index[index.length-1];
		allowed[index[id-1]].index = id;
		delete allowed[account];
		index.length--;
		LogDisallowed(account);
	}
}

/*contract Upgradeable is Owned {
    
    address upgradeTo = address(0);
    uint upgradeTimeBlocks = 0;
    bool scheduled = false;
    
    event LogUpgradeScheduled(
        address _upgradeTo,
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
        upgradeTimeBlocks = block.number + (daysAhead * (1 days))/(5 seconds);
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
}*/