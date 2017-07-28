pragma solidity ^0.4.11;

import "./UUID.sol";

contract MarketRegister is UUID {
    mapping(bytes32 => address) public provider;
    mapping(bytes32 => bool) public active;
    mapping(bytes32 => uint) public price;
    mapping(bytes32 => uint) public minStake;
    mapping(bytes32 => uint) public stakeRate;
    
    function setProvider(bytes32 id, address value)
    external
    onlyOwner
    mustExist(id)
    validAccount(value)
    { 
        provider[id] = value;
    }
    
    function setActive(bytes32 id, bool value)
    external
    onlyOwner
    mustExist(id)
    { 
        active[id] = value;
    }
    
    function setPrice(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    { 
        price[id] = value;
    }
    
    function setMinStake(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    { 
        minStake[id] = value;
    }
    
    function setStakeRate(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    { 
        stakeRate[id] = value;
    }
        
}

contract ServiceRegister is MarketRegister {
    mapping(bytes32 => uint) public tolerance;

    function setTolerance(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id) { 
        tolerance[id] = value;
    }
        
}