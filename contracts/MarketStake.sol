pragma solidity ^0.4.11;

import "./Owned.sol";
import "./LedgerLib.sol";
import "./MarketLib.sol";
import "./OrderBookLib.sol";

contract MarketStake is Owned{
    
    address public ledger;
    address public register;
    address public orderBook;
    
    function MarketStake(
        address _ledger,
        address _register,
        address _orderBook
    )
    Owned()
    {
        ledger = _ledger;
        register = _register;
        orderBook = _orderBook;
    }
    
    event LogNewMarket(bytes32 id);
    event LogMarketShutdown(bytes32 id);
    
    event LogMarketPriceChanged(bytes32 id, uint oldPrice, uint newPrice);
    event LogMarketMinStakeChanged(bytes32 id, uint oldMinimum, uint newMinimum);
    event LogMarketStakeRateChanged(bytes32 id, uint oldRate, uint newRate);
    
    event LogNewOrder(bytes32 marketID, bytes32 orderID, uint price, uint amount, uint stake);
    event LogOrderConfirmed(bytes32 orderID, address confirmer);
    event LogOrderActivated(bytes32 orderID);
    event LogOrderNewReading(bytes32 orderID, uint reading);
    event LogOrderFilled(bytes32 orderID, uint cost);
    event LogOrderCancelled(bytes32 orderID, address canceller);
    event LogOrderBilateralSought(bytes32 orderID, address seeker);
    event LogOrderBilateralCancel(bytes32 orderID);
    
    event LogDeposit(address depositor, uint deposit);
    event LogWithdraw(address withdrawer);
    
    function changePrice(bytes32 id, uint newPrice) external;
    
    function changeMinStake(bytes32 id, uint newMinimum) external {
        uint oldMinimum = MarketLib.minStake(register, id);
        MarketLib.changeMinStake(register, id, newMinimum);
        LogMarketMinStakeChanged(id, oldMinimum, newMinimum);
    }
    
    function changeStakeRate(bytes32 id, uint newRate) external {
        uint oldRate = MarketLib.minStake(register, id);
        MarketLib.changeStakeRate(register, id, newRate);
        LogMarketStakeRateChanged(id, oldRate, newRate);
    }
    
    function shutdownMarket(bytes32 id) external {
        MarketLib.shutdownMarket(register, id);
        LogMarketShutdown(id);
    }
    
    function order(bytes32 id, uint amount) external {
        bytes32 orderID = OrderBookLib.makeOrder(
            orderBook,
            register,
            id,
            amount,
            isProduct()
        );
        LogNewOrder(
            id,
            orderID,
            OrderBookLib.price(orderBook, id),
            amount, OrderBookLib.stake(orderBook, id)
        );
    }
    
    function confirm(bytes32 id) external {
        bool success = OrderBookLib.confirmOrder(orderBook, register, ledger, id);
        LogOrderConfirmed(id, msg.sender);
        if (success) {
            LogOrderActivated(id);
        }
    }
    
    function completeOrder(bytes32 id, uint reading) external {
        uint cost;
        bool success;
        (cost, success) = OrderBookLib.completeOrder(
            orderBook,
            register,
            ledger,
            id,
            reading,
            isProduct()
        );
        LogOrderNewReading(id, reading);
        if (success) {
            LogOrderFilled(id, cost);
        }
    }
    
    function cancelOrder(bytes32 id) external {
        OrderBookLib.cancelOrder(orderBook, register, ledger, id, isProduct());
        bytes32 market = OrderBookLib.market(orderBook, id);
        LogOrderCancelled(
            id, 
            (MarketLib.active(register, market)) ? msg.sender :
            MarketLib.provider(register, market)
        );
    }
    
    function bilateralCancelOrder(bytes32 id) external {
        bool success = OrderBookLib.bilateralCancel(orderBook, register, ledger, id, isProduct());
        LogOrderBilateralSought(id, msg.sender);
        if (success) {
            LogOrderBilateralCancel(id);
        }
    }
    
    function deposit() payable external {
        LedgerLib.deposit(ledger, msg.value);
        LogDeposit(msg.sender, msg.value);
    }
    
    function withdraw() external {
        LedgerLib.withdraw(ledger);
        LogWithdraw(msg.sender);
    }
    
    function getBalance() constant external returns (uint) {
        return LedgerLib.getBalance(ledger);
    }
    
    function getPending() constant external returns (uint) {
        return LedgerLib.getPending(ledger);
    }
    
    function isProduct() constant public returns (bool);
    
}


contract ProductStake is MarketStake {
    
    function ProductStake(
        address ledger,
        address register,
        address orderBook
    )
    MarketStake(ledger, register, orderBook)
    {}
    
    function changePrice(bytes32 id, uint newPrice) external {
        uint oldPrice = MarketLib.price(register, id);
        MarketLib.changeProductPrice(register, id, newPrice);
        LogMarketPriceChanged(id, oldPrice, newPrice);
    }
    
    function addMarket(uint price, uint minStake, uint stakeRate) external {
        bytes32 id = MarketLib.addProduct(register, price, minStake, stakeRate);
        LogNewMarket(id);
    }
    
    function isProduct() constant public returns (bool) { return true; }
}


contract ServiceStake is MarketStake {
    
    function ServiceStake(
        address ledger,
        address register,
        address orderBook
    )
    MarketStake(ledger, register, orderBook)
    {}
    
    event LogMarketToleranceChanged(bytes32 id, uint oldTolerance, uint newTolerance);
    
    function changePrice(bytes32 id, uint newPrice) external {
        uint oldPrice = MarketLib.price(register, id);
        MarketLib.changeServicePrice(register, id, newPrice);
        LogMarketPriceChanged(id, oldPrice, newPrice);
    }
    
    function changeTolernace(bytes32 id, uint newTolerance) external {
        uint oldTolerance = MarketLib.tolerance(register, id);
        MarketLib.changeServiceTolerance(register, id, newTolerance);
        LogMarketToleranceChanged(id, oldTolerance, newTolerance);
    }
    
    function addMarket(uint price, uint minStake, uint stakeRate, uint tolerance) external {
        bytes32 id = MarketLib.addService(register, price, minStake, stakeRate, tolerance);
        LogNewMarket(id);
    }
    
    function isProduct() constant public returns (bool) { return false; }
}