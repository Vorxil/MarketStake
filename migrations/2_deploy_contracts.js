var LedgerLib = artifacts.require("LedgerLib");
var MarketLib = artifacts.require("MarketLib");
var MarketConstLib = artifacts.require("MarketConstLib");
var OrderBookLib = artifacts.require("OrderBookLib");
var OrderBookConstLib = artifacts.require("OrderBookConstLib");
var MathLib = artifacts.require("MathLib");
var Ledger = artifacts.require("Ledger");
var ProductRegister = artifacts.require("MarketRegister");
var ProductOrderBook = artifacts.require("ProductOrderBook");
var ServiceRegister = artifacts.require("ServiceRegister");
var ServiceOrderBook = artifacts.require("ServiceOrderBook");
var MarketStake = artifacts.require("MarketStake");


module.exports = function(deployer) {
	
	deployer.deploy([
		LedgerLib,
		MarketLib,
		MarketConstLib,
		OrderBookConstLib,
		MathLib
	]).then(function() {
		return deployer.link(MathLib, OrderBookLib);
	}).then(function() {
		return deployer.link(OrderBookConstLib, [OrderBookLib, MarketStake]);
	}).then(function() {
		return deployer.link(MarketConstLib, MarketStake);
	}).then(function() {
		return deployer.deploy(OrderBookLib);
	}).then(function() {
		return deployer.link(LedgerLib, MarketStake);
	}).then(function() {
		return deployer.link(MarketLib, MarketStake);
	}).then(function() {
		return deployer.link(OrderBookLib, MarketStake);
	});
};
