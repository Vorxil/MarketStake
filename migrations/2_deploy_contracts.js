var LedgerLib = artifacts.require("LedgerLib");
var MarketLib = artifacts.require("MarketLib");
var OrderBookLib = artifacts.require("OrderBookLib");
var MathLib = artifacts.require("MathLib");
var MarketStake = artifacts.require("MarketStake");


module.exports = function(deployer) {
	
	deployer.deploy([
		LedgerLib,
		MarketLib,
		MathLib
	]).then(function() {
		return deployer.link(MathLib, OrderBookLib);
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
