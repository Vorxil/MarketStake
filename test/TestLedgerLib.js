var Ledger = artifacts.require("Ledger");
var MarketStake = artifacts.require("MarketStake");
var OrderBook = artifacts.require("ProductOrderBook");
var Register = artifacts.require("MarketRegister");

contract('TestMarketStakeLedger', function(accounts) {
	
	var dapp;
	var ledger;
	var register;
	var orderBook;
	
	beforeEach(function() {
		return Ledger.new().then(function(instance) {
			ledger = instance;
			return Register.new();
		}).then(function(instance) {
			register = instance;
			return OrderBook.new();
		}).then(function(instance) {
			orderBook = instance;
			return MarketStake.new(ledger.address, register.address, orderBook.address);
		}).then(function(instance) {
			dapp = instance;
			return ledger.allow(dapp.address);
		}).then(function() {
			return register.allow(dapp.address);
		}).then(function() {
			return orderBook.allow(dapp.address);
			
		});
	});
	
	it("Should be empty at deployment", function() {
		assert.equal(
			dapp.contract._eth.getBalance(dapp.address).toNumber(),
			0,
			"Contract didn't start empty"
		);
		return;
	});
	
	it("Should have ownership of subcontracts", function() {
		
		return dapp.ledger.call().then(function(address) {
			assert.equal(address, ledger.address, "Ledger isn't the same!");
			return dapp.register.call();
		}).then(function(address) {
			assert.equal(address, register.address, "Register isn't the same!");
			return dapp.orderBook.call();
		}).then(function(address) {
			assert.equal(address, orderBook.address, "Order book isn't the same!");
			return ledger.allowed.call(dapp.address);
		}).then(function(allowed) {
			assert.isTrue(allowed[0], "Dapp is not the owner of the ledger!");
			return register.allowed.call(dapp.address);
		}).then(function(allowed) {
			assert.isTrue(allowed[0], "Dapp is not the owner of the register!");
			return orderBook.allowed.call(dapp.address);
		}).then(function(allowed) {
			assert.isTrue(allowed[0], "Dapp is not the owner of the order book!");
		});
	});
	
	it("Should be able to deposit", function() {
		var init_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
		var final_balance;
		var init_pending;
		var final_pending;
		var amount = 100;
		
		return dapp.getPending().then(function(pending) {
			init_pending = pending.toNumber();
			return dapp.deposit({value: amount});
		}).then(function() {
			final_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			assert.equal(final_balance, init_balance + amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return dapp.getPending();
		}).then(function(pending) {
			final_pending = pending.toNumber();
			assert.equal(final_pending, init_pending + amount, amount + " should have been added.");
		});
	});
	
	it("Should be able to withdraw", function() {
		var init_balance;
		var final_balance;
		var init_pending;
		var final_pending;
		var amount = 100;
		
		return dapp.getPending().then(function(pending) {
			assert.equal(pending.toNumber(), 0, "Ledger should show no ether to send");
			return dapp.withdraw();
		}).then(function(error) {
			return dapp.deposit({value: amount});
		}).then(function() {
			init_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			console.log(init_balance);
			assert.equal(init_balance, amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return dapp.getPending();
		}).then(function(pending) {
			init_pending = pending.toNumber();
			assert.equal(init_pending, amount, amount + " should have been added.");
			return dapp.withdraw();
		}).then(function() {
			final_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			console.log(final_balance);
			assert.equal(final_pending, init_pending - amount, amount + " should have been withdrawn");
			assert.equal(final_pending, 0, " Contract should be empty");
			//As of TestRPC 4.0.1, this fails due to previous deposit having deposited twice.
			return dapp.getPending();
		}).then(function(pending) {
			final_pending = pending.toNumber();
			assert.equal(final_pending, init_pending - amount, amount + " should be shown to be withdrawn");
			assert.equal(final_pending, 0, "Should show to be empty.");
		});
	})
});