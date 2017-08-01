var Ledger = artifacts.require("Ledger");
var MarketStake = artifacts.require("ProductStake");
var OrderBook = artifacts.require("ProductOrderBook");
var Register = artifacts.require("MarketRegister");

contract('TestMarketStakeDeployment', function(accounts) {
	
	it("Should be empty at deployment", function() {
		
		return MarketStake.deployed().then(function(instance) {
			return instance.contract._eth.getBalance(instance.address);
		}).then(function(balance) {
			assert.equal(balance.toNumber(), 0, "Contract didn't start empty");
		});
	});
	
	it("Should have ownership of subcontracts", function() {
		
		var dapp;
		var ledger;
		var register;
		var orderBook;
		
		return MarketStake.deployed().then(function(instance) {
			dapp = instance;
			return Ledger.deployed();
		}).then(function(instance) {
			ledger = instance;
			return Register.deployed();
		}).then(function(instance) {
			register = instance;
			return OrderBook.deployed();
		}).then(function(instance) {
			orderBook = instance;
			return dapp.ledger.call();
		}).then(function(address) {
			assert.equal(address, ledger.address, "Ledger isn't the same!");
			return dapp.register.call();
		}).then(function(address) {
			assert.equal(address, register.address, "Register isn't the same!");
			return dapp.orderBook.call();
		}).then(function(address) {
			assert.equal(address, orderBook.address, "Order book isn't the same!");
			return ledger.owner.call();
		}).then(function(address) {
			assert.equal(address, dapp.address, "Dapp is not the owner of the ledger!");
			return register.owner.call();
		}).then(function(address) {
			assert.equal(address, dapp.address, "Dapp is not the owner of the register!");
			return orderBook.owner.call();
		}).then(function(address) {
			assert.equal(address, dapp.address, "Dapp is not the owner of the order book!");
		});
	});
	
});

contract('TestMarketStakeDeposit', function() {
	it("Should be able to deposit", function() {
		var init_balance;
		var final_balance;
		var init_pending;
		var final_pending;
		var amount = 100;
		
		var dapp;
		
		return MarketStake.deployed().then(function(instance) {
			dapp = instance;
			return dapp.contract._eth.getBalance(dapp.address);
		}).then(function(balance) {
			init_balance = balance.toNumber();
			return dapp.getPending.call();
		}).then(function(pending) {
			init_pending = pending.toNumber();
			return dapp.deposit({value: amount});
		}).then(function() {
			return dapp.contract._eth.getBalance(dapp.address);
		}).then(function(balance) {
			final_balance = balance.toNumber();
			console.log(init_balance);
			console.log(final_balance);
			assert.equal(final_balance, init_balance + amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return dapp.getPending();
		}).then(function(pending) {
			final_pending = pending.toNumber();
			assert.equal(final_pending, init_pending + amount, amount + " should have been added.");
		});
	});
});
	
	
contract('TestMarketStakeWithdraw', function() {
	it("Should be able to withdraw", function() {
		var init_balance;
		var final_balance;
		var init_pending;
		var final_pending;
		var amount = 100;
		
		var dapp;
		
		return MarketStake.deployed().then(function(instance) {
			dapp = instance;
			return dapp.contract._eth.getBalance(dapp.address);
		}).then(function(balance) {
			assert.equal(balance.toNumber(), 0, "Contract should have no ether to send");
			return dapp.getPending.call();
		}).then(function(pending) {
			assert.equal(pending.toNumber(), 0, "Ledger should show no ether to send");
			return dapp.withdraw();
		}).then(function(error) {
			return dapp.deposit({value: amount});
		}).then(function() {
			return dapp.contract._eth.getBalance(dapp.address);
		}).then(function(balance) {
			init_balance = balance.toNumber();
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
			return dapp.contract._eth.getBalance(dapp.address);
		}).then(function(balance) {
			final_balance = balance.toNumber();
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