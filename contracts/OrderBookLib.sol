pragma solidity ^0.4.11;

import "./Ledger.sol";
import "./MarketRegister.sol";
import "./OrderBook.sol";

library OrderBookLib {
    
    modifier activeMarket(address register, bytes32 market) {
        require(MarketRegister(register).exists(market));
        require(MarketRegister(register).active(market));
        _;
    }
    
    modifier onlyParties(address orderBook, address register, bytes32 id) {
        require(
            msg.sender == OrderBook(orderBook).clients(id) ||
            msg.sender == MarketRegister(register).provider(
                OrderBook(orderBook).markets(id)
            )
        );
        _;
    }
    
    modifier mustExist(address orderBook, bytes32 id) {
        require(OrderBook(orderBook).exists(id));
        _;
    }
    
    function makeOrder(
        address orderBook,
        address register,
        bytes32 market,
        uint amount,
        bool isProduct
    )
    public
    activeMarket(register, market)
    returns (bytes32 id)
    {
        id = OrderBook(orderBook).new_id(msg.sender);
        require(!OrderBook(orderBook).exists(id));
        
        uint price = MarketRegister(register).price(id);
        
        createOrder(
            orderBook,
            id,
            market,
            msg.sender,
            price,
            MarketRegister(register).stakeRate(id),
            (isProduct)?amount*price:amount
        );
        
        if (isProduct) {
            ProductOrderBook(orderBook).setCount(id, amount);
        } else {
            ServiceOrderBook(orderBook).setTolerance(
                id,
                ServiceRegister(register).tolerance(market)
            );
        }
    }
    
    function confirmOrder(
        address orderBook,
        address register,
        address ledger,
        bytes32 id
    )
    public
    onlyParties(orderBook, register, id)
    returns (bool started)
    {
        address client = OrderBook(orderBook).clients(id);
        address provider = MarketRegister(register).provider(
            OrderBook(orderBook).markets(id)
        );
        
        OrderBook(orderBook).setConfirmations(id, true, (msg.sender == client));
        
        if (fetchConfirm(orderBook, id)) {
            uint stake = OrderBook(orderBook).stake(id);
            uint fee = OrderBook(orderBook).fee(id);
            
            Ledger(ledger).removePending(client, stake);
            Ledger(ledger).addLocked(client, stake);
            Ledger(ledger).addGains(client, fee);
            
            Ledger(ledger).removePending(provider, stake);
            Ledger(ledger).addLocked(provider, stake);
            Ledger(ledger).addGains(provider, 2*fee);
            
            OrderBook(orderBook).setActive(id, true);
            started = true;
        }
    }
    
    function cancelOrder(
        address orderBook,
        address register,
        address ledger,
        bytes32 id,
        bool isProduct
    )
    public
    onlyParties(orderBook, register, id)
    {
        bytes32 market = OrderBook(orderBook).markets(id);
        address client = OrderBook(orderBook).clients(id);
        address provider = MarketRegister(register).provider(market);
        
        if (OrderBook(orderBook).active(id)) {
            if (!MarketRegister(register).active(market)) {
                payFee(orderBook, ledger, id, client, provider, true);
            } else {
                payFee(orderBook, ledger, id, client, provider, (msg.sender == provider));
            }
        }
        (isProduct)?
            deleteProductOrder(orderBook, id) : 
            deleteServiceOrder(orderBook, id);
    }
    
    function bilateralCancel(
        address orderBook,
        address register,
        address ledger,
        bytes32 id,
        bool isProduct
    )
    public
    onlyParties(orderBook, register, id)
    returns (bool success)
    {
        bytes32 market = OrderBook(orderBook).markets(id);
        address client = OrderBook(orderBook).clients(id);
        address provider = MarketRegister(register).provider(market);
        
        if (OrderBook(orderBook).active(id)) {
            OrderBook(orderBook).setBilateral(id, true, (msg.sender == client));
            
            if (fetchBilateral(orderBook, id)) {
                refundOrder(orderBook, ledger, id, client, provider);
                (isProduct)?
                    deleteProductOrder(orderBook, id) : 
                    deleteServiceOrder(orderBook, id);
                success = true;
            }
        }
    }
    
    function completeOrder(
        address orderBook,
        address register,
        address ledger,
        bytes32 id,
        uint reading,
        bool isProduct
    )
    public
    onlyParties(orderBook, register, id)
    returns (uint cost, bool success)
    {
        require(OrderBook(orderBook).active(id));
        
        bytes32 market = OrderBook(orderBook).markets(id);
        address client = OrderBook(orderBook).clients(id);
        address provider = MarketRegister(register).provider(market);
        bool isClient = msg.sender == client;
        
        OrderBook(orderBook).setGivenReadings(id, true, isClient);
        OrderBook(orderBook).setReadings(id, reading, isClient);
        
        if (fetchGiven(orderBook, id)) {
            (cost, success) = computeCost(orderBook, id, isProduct);
            if (success) {
                fillOrder(orderBook, ledger, id, client, provider, cost);
                (isProduct)?
                    deleteProductOrder(orderBook, id) : 
                    deleteServiceOrder(orderBook, id);
            }
        }
        
    }
    
    function fetchConfirm(address orderBook, bytes32 id)
    constant
    public
    returns (bool isConfirmed)
    {
        bool clientConfirm;
        bool providerConfirm;
        
        (clientConfirm, providerConfirm) = OrderBook(orderBook).confirmations(id);
        
        return (clientConfirm && providerConfirm);
    }
    
    function fetchBilateral(address orderBook, bytes32 id)
    constant
    public
    returns (bool isConfirmed)
    {
        bool clientConfirm;
        bool providerConfirm;
        
        (clientConfirm, providerConfirm) = OrderBook(orderBook).bilateral_cancel(id);
        
        return (clientConfirm && providerConfirm);
    }
    
    function fetchGiven(address orderBook, bytes32 id)
    constant
    public
    returns (bool isConfirmed)
    {
        bool clientConfirm;
        bool providerConfirm;
        
        (clientConfirm, providerConfirm) = OrderBook(orderBook).givenReadings(id);
        
        return (clientConfirm && providerConfirm);
    }
    
    function exists(address orderBook, bytes32 id)
    constant
    public
    returns (bool)
    {
        return OrderBook(orderBook).exists(id);
    }
    
    function active(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (bool)
    {
        return OrderBook(orderBook).active(id);
    }
    
    function market(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (bytes32)
    {
        return OrderBook(orderBook).markets(id);
    }
    
    function client(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (address)
    {
        return OrderBook(orderBook).clients(id);
    }
    
    function price(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (uint)
    {
        return OrderBook(orderBook).price(id);
    }
    
    function stake(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (uint)
    {
        return OrderBook(orderBook).stake(id);
    }
    
    function fee(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (uint)
    {
        return OrderBook(orderBook).fee(id);
    }
    
    function count(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (uint)
    {
        return ProductOrderBook(orderBook).count(id);
    }
    
    function tolerance(address orderBook, bytes32 id)
    constant
    public
    mustExist(orderBook, id)
    returns (uint)
    {
        return ServiceOrderBook(orderBook).tolerance(id);
    }
    
    function computeCost(
        address orderBook,
        bytes32 id,
        bool isProduct
    )
    private
    returns (uint cost, bool success)
    {
        uint clientReading;
        uint providerReading;
        
        (clientReading, providerReading) = OrderBook(orderBook).readings(id);
        
        if (isProduct) {
            cost = OrderBook(orderBook).fee(id);
            success = (clientReading == providerReading);
        } else {
            uint tolerance = ServiceOrderBook(orderBook).tolerance(id);
            uint price = OrderBook(orderBook).price(id);
            if ((clientReading <= providerReading && 
                providerReading - clientReading <= tolerance) ||
                (clientReading > providerReading &&
                clientReading - providerReading <= tolerance)) {

                uint avg = clientReading>>1 +
                            providerReading>>1 +
                            (clientReading & providerReading & 1);
                
                cost = avg*price;
                if (price != 0 && avg > cost/price) {
                    cost = uint(-1);
                }
                success = true;
            } else {
                cost = 0;
                success = false;
            }
        }
    }
    
    function fillOrder(
        address orderBook,
        address ledger,
        bytes32 id,
        address client,
        address provider,
        uint amount
    )
    private
    {
        uint stake = OrderBook(orderBook).stake(id);
        uint fee = OrderBook(orderBook).fee(id);
        uint cost = (amount <= fee)? amount : fee;
        
        Ledger(ledger).removeLocked(client, stake);
        Ledger(ledger).removeGains(client, fee);
        Ledger(ledger).addPending(client, stake - cost);
            
        Ledger(ledger).removeLocked(provider, stake);
        Ledger(ledger).removeGains(provider, 2*fee);
        Ledger(ledger).addPending(provider, stake + cost);
    }
    
    function payFee(
        address orderBook,
        address ledger,
        bytes32 id,
        address client,
        address provider,
        bool toClient
    )
    private
    {
        uint stake = OrderBook(orderBook).stake(id);
        uint fee = OrderBook(orderBook).fee(id);
        
        Ledger(ledger).removeLocked(client, stake);
        Ledger(ledger).removeGains(client, fee);
        Ledger(ledger).addPending(client, (toClient)?(stake + fee):(stake - fee));
            
        Ledger(ledger).removeLocked(provider, stake);
        Ledger(ledger).removeGains(provider, 2*fee);
        Ledger(ledger).addPending(provider, (toClient)?(stake - fee):(stake + fee));
    }
    
    function refundOrder(
        address orderBook,
        address ledger,
        bytes32 id,
        address client,
        address provider
    )
    private
    {
        uint stake = OrderBook(orderBook).stake(id);
        uint fee = OrderBook(orderBook).fee(id);
        
        Ledger(ledger).removeLocked(client, stake);
        Ledger(ledger).removeGains(client, fee);
        Ledger(ledger).addPending(client, stake);
        
        Ledger(ledger).removeLocked(provider, stake);
        Ledger(ledger).removeGains(provider, 2*fee);
        Ledger(ledger).addPending(provider, stake);
        
    }
    
    function deleteOrder(address orderBook, bytes32 id) private {
        OrderBook(orderBook).setMarket(id, bytes32(0));
        OrderBook(orderBook).setClient(id, address(0));
        OrderBook(orderBook).setPrice(id, 0);
        OrderBook(orderBook).setStake(id, 0);
        OrderBook(orderBook).setFee(id, 0);
        OrderBook(orderBook).setActive(id, false);
        OrderBook(orderBook).setConfirmations(id, false, true);
        OrderBook(orderBook).setConfirmations(id, false, false);
        OrderBook(orderBook).setReadings(id, 0, true);
        OrderBook(orderBook).setReadings(id, 0, false);
        OrderBook(orderBook).setGivenReadings(id, false, true);
        OrderBook(orderBook).setGivenReadings(id, false, false);
        OrderBook(orderBook).setBilateral(id, false, true);
        OrderBook(orderBook).setBilateral(id, false, false);
        OrderBook(orderBook).setExists(id, false);
    }
    
    function deleteProductOrder(address orderBook, bytes32 id) private {
        ProductOrderBook(orderBook).setCount(id, 0);
        deleteOrder(orderBook, id);
    }
    
    function deleteServiceOrder(address orderBook, bytes32 id) private {
        ServiceOrderBook(orderBook).setTolerance(id, 0);
        deleteOrder(orderBook, id);
    }
    
    function createOrder(
        address orderBook,
        bytes32 id,
        bytes32 market,
        address client,
        uint price,
        uint stakeRate,
        uint cost
    )
    private
    {
        OrderBook(orderBook).setExists(id, true);
        OrderBook(orderBook).setMarket(id, market);
        OrderBook(orderBook).setClient(id, client);
        OrderBook(orderBook).setPrice(id, price);
        OrderBook(orderBook).setStake(id, cost*stakeRate);
        OrderBook(orderBook).setFee(id, cost);
    }
    
    
}