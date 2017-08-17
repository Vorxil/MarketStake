module.exports = function(callback) {
	var Ledger = artifacts.require("Ledger");
	var Register = artifacts.require("ServiceRegister");
	var OrderBook = artifacts.require("ServiceOrderBook");
	var MarketStake = artifacts.require("MarketStake");

	var clientLedger;
	var providerLedger;
	var register;
	var book;
	var dapp;
	
	return Ledger.new().then(function(instance) {
		clientLedger = instance;
		return Ledger.new();
	}).then(function(instance) {
		providerLedger = instance
		return Register.new();
	}).then(function(instance) {
		register = instance
		return OrderBook.new();
	}).then(function(instance) {
		book = instance
		return MarketStake.new(
			clientLedger.address,
			providerLedger.address,
			register.address,
			book.address
		);
	}).then(function(instance) {
		dapp = instance
		return clientLedger.allow(dapp.address);
	}).then(function() {
		return clientLedger.transferOwnership(dapp.address);
	}).then(function() {
		return providerLedger.allow(dapp.address);
	}).then(function() {
		return providerLedger.transferOwnership(dapp.address);
	}).then(function() {
		return register.allow(dapp.address);
	}).then(function() {
		return register.transferOwnership(dapp.address);
	}).then(function() {
		return book.allow(dapp.address);
	}).then(function() {
		return book.transferOwnership(dapp.address);
	}).then(function() {
		console.log("MarketStake at:\t" + dapp.address.toString());
	}).catch(function(err) {
		return callback(err);
	});
}