pragma solidity ^0.4.11;

import "./UUID.sol";

contract OrderBook is UUID {
    struct uintTuple {
        uint client;
        uint provider;
    }
    struct boolTuple {
        bool client;
        bool provider;
    }
    mapping(bytes32 => bytes32) public markets;
    mapping(bytes32 => address) public clients;
    mapping(bytes32 => uint) public price;
    mapping(bytes32 => uint) public stake;
    mapping(bytes32 => uint) public fee;
    mapping(bytes32 => bool) public active;
    mapping(bytes32 => boolTuple) public confirmations;
    mapping(bytes32 => uintTuple) public readings;
    mapping(bytes32 => boolTuple) public givenReadings;
    mapping(bytes32 => boolTuple) public bilateral_cancel;
    
    function setMarket(bytes32 id, bytes32 market_id)
    external
    onlyOwner
    mustExist(id)
    {
        markets[id] = market_id;
    }
    
    function setClient(bytes32 id, address client)
    external
    onlyOwner
    mustExist(id)
    validAccount(client)
    {
        clients[id] = client;
    }
    
    function setPrice(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    {
        price[id] = value;
    }
    
    function setStake(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    {
        stake[id] = value;
    }
    
    function setFee(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    {
        fee[id] = value;
    }
    
    function setActive(bytes32 id, bool value)
    external
    onlyOwner
    mustExist(id)
    {
        active[id] = value;
    }
    
    function setConfirmations(bytes32 id, bool value, bool client)
    external
    onlyOwner
    mustExist(id)
    {
        if (client) { confirmations[id].client = value; }
        else { confirmations[id].provider = value; }
    }
    
    function setReadings(bytes32 id, uint value, bool client)
    external
    onlyOwner
    mustExist(id)
    {
        if (client) { readings[id].client = value; }
        else { readings[id].provider = value; }
    }
    
    function setGivenReadings(bytes32 id, bool value, bool client)
    external
    onlyOwner
    mustExist(id)
    {
        if (client) { givenReadings[id].client = value; }
        else { givenReadings[id].provider = value; }
    }
    
    function setBilateral(bytes32 id, bool value, bool client)
    external
    onlyOwner
    mustExist(id)
    {
        if (client) { bilateral_cancel[id].client = value; }
        else { bilateral_cancel[id].provider = value; }
    }
    
}

contract ProductOrderBook is OrderBook {
    mapping(bytes32 => uint) public count;
    
    function setCount(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    {
        count[id] = value;
    }
}

contract ServiceOrderBook is OrderBook {
    mapping(bytes32 => uint) public tolerance;
    
    function setTolerance(bytes32 id, uint value)
    external
    onlyOwner
    mustExist(id)
    {
        tolerance[id] = value;
    }
}