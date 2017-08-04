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
	event LogMarketToleranceChanged(bytes32 id, uint oldTolerance, uint newTolerance);
    
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
	
	function addMarket(uint price, uint minStake, uint stakeRate, uint tolerance) external returns (bytes32 id){
        id = MarketLib.addMarket(register, price, minStake, stakeRate, tolerance);
        LogNewMarket(id);
    }
    
    function changePrice(bytes32 id, uint newPrice) external {
		uint oldPrice = MarketConstLib.price(register, id);
        MarketLib.changePrice(register, id, newPrice);
        LogMarketPriceChanged(id, oldPrice, newPrice);
	}
    
    function changeMinStake(bytes32 id, uint newMinimum) external {
        uint oldMinimum = MarketConstLib.minStake(register, id);
        MarketLib.changeMinStake(register, id, newMinimum);
        LogMarketMinStakeChanged(id, oldMinimum, newMinimum);
    }
    
    function changeStakeRate(bytes32 id, uint newRate) external {
        uint oldRate = MarketConstLib.stakeRate(register, id);
        MarketLib.changeStakeRate(register, id, newRate);
        LogMarketStakeRateChanged(id, oldRate, newRate);
    }
	
	function changeTolerance(bytes32 id, uint newTolerance) external {
        uint oldTolerance = MarketConstLib.tolerance(register, id);
        MarketLib.changeTolerance(register, id, newTolerance);
        LogMarketToleranceChanged(id, oldTolerance, newTolerance);
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
            amount
        );
        LogNewOrder(
            id,
            orderID,
            OrderBookConstLib.price(orderBook, id),
            amount,
			OrderBookConstLib.stake(orderBook, id)
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
            reading
        );
        LogOrderNewReading(id, reading);
        if (success) {
            LogOrderFilled(id, cost);
        }
    }
    
    function cancelOrder(bytes32 id) external {
		bytes32 market = OrderBookConstLib.market(orderBook, id);
        OrderBookLib.cancelOrder(orderBook, register, ledger, id);        
        LogOrderCancelled(
            id, 
            (MarketConstLib.active(register, market)) ? msg.sender :
            MarketConstLib.provider(register, market)
        );
    }
    
    function bilateralCancelOrder(bytes32 id) external {
        bool success = OrderBookLib.bilateralCancel(orderBook, register, ledger, id);
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
	
	function getProvider(bytes32 id) constant external returns (address) {
		return MarketConstLib.provider(register, id);
	}
	
	function doesExist(bytes32 id) constant external returns (bool) {
		return MarketConstLib.exists(register,id);
	}
	
	function isActive(bytes32 id) constant external returns (bool) {
		return MarketConstLib.active(register,id);
	}
	
	function getPrice(bytes32 id) constant external returns (uint) {
		return MarketConstLib.price(register, id);
	}
	
	function getMinStake(bytes32 id) constant external returns (uint) {
		return MarketConstLib.minStake(register, id);
	}
    
	function getStakeRate(bytes32 id) constant external returns (uint) {
		return MarketConstLib.stakeRate(register, id);
	}
	
	function getTolerance(bytes32 id) constant external returns (uint) {
		return MarketConstLib.tolerance(register, id);
	}
	
    function isMetered() constant external returns (bool) {
		return MarketConstLib.isMetered(register);
	}
    
}