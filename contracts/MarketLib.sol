pragma solidity ^0.4.11;

import "./MarketRegister.sol";

library MarketLib {
    
    modifier activeMarket(address register, bytes32 market) {
        require(MarketRegister(register).active(market));
        require(MarketRegister(register).provider(market) == msg.sender);
        _;
    }
    
    modifier mustExist(address register, bytes32 market) {
        require(MarketRegister(register).exists(market));
        _;
    }
    
    function addProduct(
        address register,
        uint price,
        uint minStake,
        uint stakeRate
    )
    public 
    returns (bytes32 id)
    {
        require(stakeRate > 1);
        require(price <= uint(-1)/stakeRate);
        
        id = MarketRegister(register).new_id(msg.sender);
        require(!MarketRegister(register).exists(id));
        
        MarketRegister(register).setExists(id, true);
        MarketRegister(register).setProvider(id, msg.sender);
        MarketRegister(register).setPrice(id, price);
        MarketRegister(register).setMinStake(id, minStake);
        MarketRegister(register).setStakeRate(id, stakeRate);
        MarketRegister(register).setActive(id, true);
    }
    
    function addService(
        address register,
        uint price,
        uint minStake,
        uint stakeRate,
        uint tolerance
    )
    public 
    returns (bytes32 id)
    {
        require(stakeRate > 1);
        require(price >= stakeRate);
        
        id = ServiceRegister(register).new_id(msg.sender);
        require(!ServiceRegister(register).exists(id));
        
        ServiceRegister(register).setExists(id, true);
        ServiceRegister(register).setProvider(id, msg.sender);
        ServiceRegister(register).setPrice(id, price);
        ServiceRegister(register).setMinStake(id, minStake);
        ServiceRegister(register).setStakeRate(id, stakeRate);
        ServiceRegister(register).setTolerance(id, tolerance);
        ServiceRegister(register).setActive(id, true);
    }
    
    function shutdownMarket(address register, bytes32 market)
    public
    activeMarket(register, market)
    {
        
        MarketRegister(register).setActive(market, false);
    }
    
    function changeProductPrice(address register, bytes32 market, uint newPrice)
    public
    activeMarket(register, market)
    {
        require(newPrice <= uint(-1)/MarketRegister(register).stakeRate(market));
        MarketRegister(register).setPrice(market, newPrice);
    }
    
    function changeServicePrice(address register, bytes32 market, uint newPrice)
    public
    activeMarket(register, market)
    {
        require(newPrice >= ServiceRegister(register).stakeRate(market));
        ServiceRegister(register).setPrice(market, newPrice);
    }
    
    function changeServiceTolerance(address register, bytes32 market, uint newTolerance)
    public
    activeMarket(register, market)
    {
        ServiceRegister(register).setTolerance(market, newTolerance);
    }
    
    function changeStakeRate(address register, bytes32 market, uint newRate)
    public
    activeMarket(register, market)
    {
        require(newRate > 1);
        MarketRegister(register).setStakeRate(market, newRate);
    }
    
    function changeMinStake(address register, bytes32 market, uint newMinimum) 
    public
    activeMarket(register, market)
    {
        MarketRegister(register).setMinStake(market, newMinimum);
    }
    
    function exists(address register, bytes32 market)
    constant
    public
    returns (bool)
    {
        return MarketRegister(register).exists(market);
    }
    
    function active(address register, bytes32 market)
    constant
    public
    mustExist(register, market)
    returns (bool)
    {
        return MarketRegister(register).active(market);
    }
    
    function provider(address register, bytes32 market)
    constant
    public
    mustExist(register, market)
    returns (address)
    {
        return MarketRegister(register).provider(market);
    }
    
    function price(address register, bytes32 market)
    constant
    public
    mustExist(register, market)
    returns (uint)
    {
        return MarketRegister(register).price(market);
    }
    
    function minStake(address register, bytes32 market)
    constant
    public
    mustExist(register, market)
    returns (uint)
    {
        return MarketRegister(register).minStake(market);
    }
    
    function stakeRate(address register, bytes32 market)
    constant
    public
    mustExist(register, market)
    returns (uint)
    {
        return MarketRegister(register).stakeRate(market);
    }
    
    function tolerance(address register, bytes32 market)
    constant
    public
    mustExist(register, market)
    returns (uint)
    {
        return ServiceRegister(register).tolerance(market);
    }
}

