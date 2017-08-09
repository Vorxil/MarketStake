pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/OrderBook.sol";
import "./ThrowProxy.sol";

contract TestOrderBook {
	
	OrderBook book;
	ThrowProxy proxy;
	
	function beforeEach() {
		book = new OrderBook();
		proxy = new ThrowProxy(book);
		book.allow(proxy);
		book.allow(this);
	}	
	
	function testMetered() {
		Assert.isFalse(book.isMetered(), "Orders should not be metered");
		Assert.isFalse((new ProductOrderBook()).isMetered(), "Product orders should not be metered");
		Assert.isTrue((new ServiceOrderBook()).isMetered(), "Service orders should be metered");
	}
}
