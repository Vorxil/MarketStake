var LedgerLib = artifacts.require("LedgerLib");
var MarketLib = artifacts.require("MarketLib");
var OrderBookLib = artifacts.require("OrderBookLib");
var Ledger = artifacts.require("Ledger");
var Register = artifacts.require("MarketRegister");
var OrderBook = artifacts.require("ProductOrderBook");
var MarketStake = artifacts.require("ProductStake");


module.exports = function(deployer) {
	
	deployer.deploy([
		LedgerLib,
		MarketLib,
		OrderBookLib,
		Ledger,
		Register,
		OrderBook
	]).then(function() {
			return deployer.link(LedgerLib, MarketStake);
	}).then(function() {
			return deployer.link(MarketLib, MarketStake);
	}).then(function() {
			return deployer.link(OrderBookLib, MarketStake);
	}).then(function() {
		return deployer.deploy(MarketStake, Ledger.address, Register.address, OrderBook.address);
	}).then(function() {
		return Ledger.deployed();
	}).then(function(instance) {
		return instance.transferOwnership(MarketStake.address);
	}).then(function() {
		return Register.deployed();
	}) .then(function(instance) {
		return instance.transferOwnership(MarketStake.address);
	}).then(function() {
		return OrderBook.deployed();
	}).then(function(instance) {
		return instance.transferOwnership(MarketStake.address);
	});
};
