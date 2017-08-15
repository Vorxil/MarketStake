pragma solidity ^0.4.11;

import "./Owned.sol";
import "./LedgerLib.sol";
import "./MarketLib.sol";
import "./OrderBookLib.sol";

contract MarketStake is Upgradeable{
    
    address public clientLedger;
	address public providerLedger;
    address public register;
    address public orderBook;
    
    function MarketStake(
        address _clientLedger,
		address _providerLedger,
        address _register,
        address _orderBook
    )
    Upgradeable()
    {
        clientLedger = _clientLedger;
		providerLedger = _providerLedger;
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
    
    event LogDepositClient(address depositor, uint deposit);
    event LogWithdrawClient(address withdrawer);
	event LogDepositProvider(address depositor, uint deposit);
    event LogWithdrawProvider(address withdrawer);
	
	function addMarket(uint price, uint minStake, uint stakeRate, uint tolerance) external returns (bytes32 id){
        id = MarketLib.addMarket(register, price, minStake, stakeRate, tolerance);
        LogNewMarket(id);
    }
    
    function changePrice(bytes32 id, uint newPrice) external {
		uint oldPrice = MarketRegister(register).price(id);
        MarketLib.changePrice(register, id, newPrice);
        LogMarketPriceChanged(id, oldPrice, newPrice);
	}
    
    function changeMinStake(bytes32 id, uint newMinimum) external {
        uint oldMinimum = MarketRegister(register).minStake(id);
        MarketLib.changeMinStake(register, id, newMinimum);
        LogMarketMinStakeChanged(id, oldMinimum, newMinimum);
    }
    
    function changeStakeRate(bytes32 id, uint newRate) external {
        uint oldRate = MarketRegister(register).stakeRate(id);
        MarketLib.changeStakeRate(register, id, newRate);
        LogMarketStakeRateChanged(id, oldRate, newRate);
    }
	
	function changeTolerance(bytes32 id, uint newTolerance) external {
        uint oldTolerance = ServiceRegister(register).tolerance(id);
        MarketLib.changeTolerance(register, id, newTolerance);
        LogMarketToleranceChanged(id, oldTolerance, newTolerance);
    }
    
    function shutdownMarket(bytes32 id) external {
        MarketLib.shutdownMarket(register, id);
        LogMarketShutdown(id);
    }
    
    function order(bytes32 id, uint amount, uint stakeOffer) external {
        bytes32 orderID = OrderBookLib.makeOrder(
            orderBook,
            register,
            id,
            amount,
			stakeOffer
        );
        LogNewOrder(
            id,
            orderID,
            OrderBook(orderBook).price(orderID),
            amount,
			stakeOffer
        );
    }
    
    function confirm(bytes32 id) external {
        bool success = OrderBookLib.confirmOrder(
			orderBook,
			register,
			clientLedger,
			providerLedger,
			id
		);
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
            clientLedger,
			providerLedger,
            id,
            reading
        );
        LogOrderNewReading(id, reading);
        if (success) {
            LogOrderFilled(id, cost);
        }
    }
    
    function cancelOrder(bytes32 id) external {
		bytes32 market = OrderBook(orderBook).markets(id);
        OrderBookLib.cancelOrder(
			orderBook,
			register,
			clientLedger,
			providerLedger,
			id
		);        
        LogOrderCancelled(
            id, 
            (MarketRegister(register).active(market)) ? msg.sender :
			MarketRegister(register).provider(market)
        );
    }
    
    function bilateralCancelOrder(bytes32 id) external {
        bool success = OrderBookLib.bilateralCancel(
			orderBook,
			register,
			clientLedger,
			providerLedger,
			id
		);
        LogOrderBilateralSought(id, msg.sender);
        if (success) {
            LogOrderBilateralCancel(id);
        }
    }
    
    function depositClient() payable external {
        LedgerLib.deposit(clientLedger, msg.value);
        LogDepositClient(msg.sender, msg.value);
    }
    
    function withdrawClient() external {
        LedgerLib.withdraw(clientLedger);
        LogWithdrawClient(msg.sender);
    }    
	
	function depositProvider() payable external {
        LedgerLib.deposit(providerLedger, msg.value);
        LogDepositProvider(msg.sender, msg.value);
    }
    
    function withdrawProvider() external {
        LedgerLib.withdraw(providerLedger);
        LogWithdrawProvider(msg.sender);
    }    
	
	function upgradeDuties() private {
		Allowable(clientLedger).allow(upgradeTo);
		Allowable(providerLedger).allow(upgradeTo);
		Allowable(register).allow(upgradeTo);
		Allowable(orderBook).allow(upgradeTo);
		Allowable(clientLedger).disallow(this);
		Allowable(providerLedger).disallow(this);
		Allowable(register).disallow(this);
		Allowable(orderBook).disallow(this);
		Allowable(clientLedger).transferOwnership(upgradeTo);
		Allowable(providerLedger).transferOwnership(upgradeTo);
		Allowable(register).transferOwnership(upgradeTo);
		Allowable(orderBook).transferOwnership(upgradeTo);
	}
}