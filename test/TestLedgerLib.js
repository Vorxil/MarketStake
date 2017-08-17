var Ledger = artifacts.require("Ledger");
var MarketStake = artifacts.require("MarketStake");
var OrderBook = artifacts.require("OrderBook");
var Register = artifacts.require("MarketRegister");

function assertUserEvent(result, event_id, fields, values, message) {
	var event_occurred;
	
	for(var i = 0; i < result.logs.length; i++) {
		var log = result.logs[i];
		if (log.event === event_id) {
			//console.log(log.args);
			event_occurred = true;
			for(var i=0; i < fields.length; i++) {
				event_occurred = event_occurred &&
					(log.args[fields[i]].valueOf().toString() === values[i].toString());
			}
			if (event_occurred === true) {
				break;
			}
		}
	}
	
	assert.isTrue(
		event_occurred !== undefined && event_occurred === true,
		message
	);	
}

contract('TestMarketStakeLedger', function(accounts) {
	
	var dapp;
	var clientLedger;
	var providerLedger;
	var register;
	var orderBook;
	
	var accounts;
	var account;
	
	beforeEach(function() {
		return Ledger.new().then(function(instance) {
			clientLedger = instance;
			return Ledger.new();
		}).then(function(instance) {
			providerLedger = instance;
			return Register.new();
		}).then(function(instance) {
			register = instance;
			return OrderBook.new();
		}).then(function(instance) {
			orderBook = instance;
			return MarketStake.new(
				clientLedger.address,
				providerLedger.address,
				register.address,
				orderBook.address
			);
		}).then(function(instance) {
			dapp = instance;
			return clientLedger.allow(dapp.address);
		}).then(function() {
			return clientLedger.allowed(dapp.address);
		}).then(function(b) {
			assert.isTrue(b[0], "Dapp should be allowed on client ledger");
			return providerLedger.allow(dapp.address);
		}).then(function() {
			return providerLedger.allowed(dapp.address);
		}).then(function(b) {
			assert.isTrue(b[0], "Dapp should be allowed on provider ledger");
			return register.allow(dapp.address);
		}).then(function() {
			return register.allowed(dapp.address);
		}).then(function(b) {
			assert.isTrue(b[0], "Dapp should be allowed on register");
			return orderBook.allow(dapp.address);
		}).then(function() {
			return orderBook.allowed(dapp.address);
		}).then(function(b) {
			assert.isTrue(b[0], "Dapp should be allowed on order book");
			accounts = dapp.contract._eth.accounts;
			account = accounts[0];
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
	
	it("Should have access to subcontracts", function() {
		
		return dapp.clientLedger().then(function(address) {
			assert.equal(address, clientLedger.address, "Client ledger isn't the same!");
			return dapp.providerLedger();
		}).then(function(address) {
			assert.equal(address, providerLedger.address, "Provider ledger isn't the same!");
			return dapp.register();
		}).then(function(address) {
			assert.equal(address, register.address, "Register isn't the same!");
			return dapp.orderBook();
		}).then(function(address) {
			assert.equal(address, orderBook.address, "Order book isn't the same!");
		});
	});
	
	it("Should be able to deposit", function() {
		var init_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
		var final_balance;
		var init_pending;
		var final_pending;
		var amount = 100;
		
		return clientLedger.pending(account).then(function(pending) {
			init_pending = pending.toNumber();
			return dapp.depositClient({value: amount});
		}).then(function(result) {
			assertUserEvent(
				result,
				"LogDepositClient",
				["depositor", "deposit"],
				[account, amount],
				"Event LogDepositClient should be fired"
			);
			final_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			//assert.equal(final_balance, init_balance + amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return clientLedger.pending(account);
		}).then(function(pending) {
			final_pending = pending.toNumber();
			assert.equal(final_pending, init_pending + amount, amount + " should have been added.");
			return providerLedger.pending(account);
		}).then(function(pending) {
			init_pending = pending.toNumber();
			return dapp.depositProvider({value: amount});
		}).then(function(result) {
			assertUserEvent(
				result,
				"LogDepositProvider",
				["depositor", "deposit"],
				[account, amount],
				"Event LogDepositProvider should be fired"
			);
			final_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			//assert.equal(final_balance, init_balance + amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return providerLedger.pending(account);
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
		
		return clientLedger.pending(account).then(function(pending) {
			assert.equal(pending.toNumber(), 0, "Ledger should show no ether to send");
			return dapp.withdrawClient();
		}).then(function(error) {
			assertUserEvent(
				error,
				"LogWithdrawClient",
				["withdrawer"],
				[account],
				"Event WithdrawClient should be fired"
			);
			return dapp.depositClient({value: amount});
		}).then(function() {
			init_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			//console.log(init_balance);
			//assert.equal(init_balance, amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return clientLedger.pending(account);
		}).then(function(pending) {
			init_pending = pending.toNumber();
			assert.equal(init_pending, amount, amount + " should have been added.");
			return dapp.withdrawClient();
		}).then(function(result) {
			assertUserEvent(
				result,
				"LogWithdrawClient",
				["withdrawer"],
				[account],
				"Event WithdrawClient should be fired"
			);
			final_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			//console.log(final_balance);
			//assert.equal(final_balance, init_balance - amount, amount + " should have been withdrawn");
			//assert.equal(final_balance, 0, " Contract should be empty");
			//As of TestRPC 4.0.1, this fails due to previous deposit having deposited twice.
			return clientLedger.pending(account);
		}).then(function(pending) {
			final_pending = pending.toNumber();
			assert.equal(final_pending, init_pending - amount, amount + " should be shown to be withdrawn");
			assert.equal(final_pending, 0, "Should show to be empty.");
			return providerLedger.pending(account);
		}).then(function(pending) {
			assert.equal(pending.toNumber(), 0, "Ledger should show no ether to send");
			return dapp.withdrawProvider();
		}).then(function(error) {
			assertUserEvent(
				error,
				"LogWithdrawProvider",
				["withdrawer"],
				[account],
				"Event WithdrawProvider should be fired"
			);
			return dapp.depositProvider({value: amount});
		}).then(function() {
			init_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			//console.log(init_balance);
			//assert.equal(init_balance, amount, amount + " should have been added.");
			//As of TestRPC 4.0.1, this fails due to library calls from payable contract tx spends
			//sent amount multiple times
			return providerLedger.pending(account);
		}).then(function(pending) {
			init_pending = pending.toNumber();
			assert.equal(init_pending, amount, amount + " should have been added.");
			return dapp.withdrawProvider();
		}).then(function(result) {
			assertUserEvent(
				result,
				"LogWithdrawProvider",
				["withdrawer"],
				[account],
				"Event WithdrawProvider should be fired"
			);
			final_balance = dapp.contract._eth.getBalance(dapp.address).toNumber();
			//console.log(final_balance);
			//assert.equal(final_balance, init_balance - amount, amount + " should have been withdrawn");
			//assert.equal(final_balance, 0, " Contract should be empty");
			//As of TestRPC 4.0.1, this fails due to previous deposit having deposited twice.
			return providerLedger.pending(account);
		}).then(function(pending) {
			final_pending = pending.toNumber();
			assert.equal(final_pending, init_pending - amount, amount + " should be shown to be withdrawn");
			assert.equal(final_pending, 0, "Should show to be empty.");
		});
	});
});