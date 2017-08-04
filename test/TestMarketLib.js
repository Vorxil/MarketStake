var Ledger = artifacts.require("Ledger");
var MarketStake = artifacts.require("MarketStake");
var ProductOrderBook = artifacts.require("ProductOrderBook");
var ProductRegister = artifacts.require("MarketRegister");
var ServiceOrderBook = artifacts.require("ServiceOrderBook");
var ServiceRegister = artifacts.require("ServiceRegister");

contract("TestMarketStakeProduct", function(accounts) {
	
	var dapp;
	var ledger;
	var register;
	var orderBook;
	
	function assertEvent(result, event_id, id, message) {
		var event_occurred;
		
		for(var i = 0; i < result.logs.length; i++) {
			var log = result.logs[i];
			if (log.event == event_id) {
				console.log(log.args);
				event_occurred = (log.args.id === id);
				break;
			}
		}
		
		assert.isTrue(
			event_occurred !== undefined && event_occurred === true,
			message
		);
	}
	
	function assertInvalid(error, message) {
		assert.isAbove(
			error.message.search('invalid opcode'),
			-1,
			message
		);
	}
	
	function fetchID(result) {
		var id;
		for(var i = 0; i < result.logs.length; i++) {
			var log = result.logs[i];
			if (log.event == "LogNewMarket") {
				console.log(log.args);
				id = log.args.id;
				break;
			}
		}
		assert.isTrue(id !== undefined, "There should be an id");
		return id;
	}
	
	beforeEach(function() {
		return Ledger.new().then(function(instance) {
			ledger = instance;
			return ProductRegister.new();
		}).then(function(instance) {
			register = instance;
			return ProductOrderBook.new();
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
		}).then(function() {
			return register.allowed(dapp.address);
		}).then(function(bool) {
			assert.isTrue(bool[0], "Dapp should be allowed on register");
			return ledger.allowed(dapp.address);
		}).then(function(bool) {
			assert.isTrue(bool[0], "Dapp should be allowed on register");
			return orderBook.allowed(dapp.address);
		}).then(function(bool) {
			assert.isTrue(bool[0], "Dapp should be allowed on register");
		});
	});
	
	it("Should be a non-metered market", function() {
		return dapp.isMetered().then(function(bool) {
			assert.isFalse(bool, "Should not be metered");
		});
	});
	
	it("Should be able to add a market", function() {
		var id;
		var price = 50;
		var minStake = 150;
		var stakeRate = 2;
		var account = dapp.contract._eth.accounts[0];
		
		console.log(account);
		//console.log(dapp);
		
		return dapp.addMarket(price, minStake, stakeRate, 0).then(function(result) {
			id = fetchID(result);
			return register.exists(id);
		}).then(function(_exists) {
			assert.isTrue(_exists, "Product should exist");
			return register.active(id);
		}).then(function(_active) {
			assert.isTrue(_active, "Product should be active");
			return register.provider(id);
		}).then(function(_provider) {
			assert.equal(_provider, account, "Product should be owned");
			return register.price(id);
		}).then(function(_price) {
			assert.equal(_price, price, "Product should have a price");
			return register.minStake(id);
		}).then(function(_min) {
			assert.equal(_min, minStake, "Product should have a minimum stake");
			return register.stakeRate(id);
		}).then(function(_stakeRate) {
			assert.equal(_stakeRate, stakeRate, "Product should have a stakeRate");
			return register.isMetered();
		}).then(function(_metered) {
			assert.isFalse(_metered, "Product should not be metered");
		});
		
	});
	
	it("Should be able to check market properties", function() {
		var id;
		var price = 50;
		var minStake = 150;
		var stakeRate = 2;
		var account = dapp.contract._eth.accounts[0];
		
		console.log(account);
		//console.log(dapp);
		
		return dapp.addMarket(price, minStake, stakeRate, 0).then(function(result) {
			id = fetchID(result);
			return dapp.doesExist(id);
		}).then(function(_exists) {
			assert.isTrue(_exists, "Product should exist");
			return dapp.isActive(id);
		}).then(function(_active) {
			assert.isTrue(_active, "Product should be active");
			return dapp.getProvider(id);
		}).then(function(_provider) {
			assert.equal(_provider, account, "Product should be owned");
			return dapp.getPrice(id);
		}).then(function(_price) {
			assert.equal(_price, price, "Product should have a price");
			return dapp.getMinStake(id);
		}).then(function(_min) {
			assert.equal(_min, minStake, "Product should have a minimum stake");
			return dapp.getStakeRate(id);
		}).then(function(_stakeRate) {
			assert.equal(_stakeRate, stakeRate, "Product should have a stakeRate");
			return dapp.isMetered();
		}).then(function(_metered) {
			assert.isFalse(_metered, "Product should not be metered");
		});
	});
	
	it("Should be able to shutdown the market", function() {
		var id;
		var price = 50;
		var minStake = 150;
		var stakeRate = 2;
		var accounts = dapp.contract._eth.accounts
		var account_one = accounts[0];
		var account_two = accounts[1];
		
		console.log(account_one);
		console.log(account_two);
		//console.log(dapp);
		
		return dapp.addMarket(price, minStake, stakeRate, 0).then(function(result) {
			id = fetchID(result);
			return dapp.doesExist(id);
		}).then(function(_exists) {
			assert.isTrue(_exists, "Product should exist");
			return dapp.isActive(id);
		}).then(function(_active) {
			assert.isTrue(_active, "Product should be active");
			return dapp.shutdownMarket(id, {from: account_two}).then(assert.fail).catch(function(error) {
				assertInvalid(error, 'Expect invalide opcode as account_two is not the provider');
			});
		}).then(function() {
			return dapp.isActive(id);
		}).then(function (_active) {
			assert.isTrue(_active, "Product should still be active");
			return dapp.shutdownMarket(id, {from: account_one});
		}).then(function(result) {
			assertEvent(result, "LogMarketShutdown", id, "Event LogMarketShutdown should have fired");			
			return dapp.isActive(id);
		}).then(function(_active) {
			assert.isFalse(_active, "Market should have shutdown");
			return dapp.shutdownMarket(id, {from: account_one}).then(assert.fail).catch(function(error) {
				assertInvalid(error,'Expect invalide opcode as market cannot be reactivated.');
			});
		});
	});
	
	it("Should be able to change market properties", function() {
		var id;
		var price = 50;
		var new_price = 75;
		var minStake = 150;
		var new_minStake = 200;
		var stakeRate = 2;
		var new_stakeRate = 3;
		var accounts = dapp.contract._eth.accounts
		var account_one = accounts[0];
		var account_two = accounts[1];
		
		console.log(account_one);
		console.log(account_two);
		//console.log(dapp);
		
		
		
		return dapp.addMarket(price, minStake, stakeRate, 0).then(function(result) {
			id = fetchID(result);
			return dapp.doesExist(id);
		}).then(function(_exists) {
			assert.isTrue(_exists, "Product should exist");
			return dapp.changePrice(id, new_price, {from: account_two}).then(assert.fail).catch(function(error) {
				assertInvalid(error,'Expect invalid opcode as account_two is not the provider.');
				return dapp.getPrice(id);
			});
		}).then(function(p) {
			assert.equal(p, price, "Price shouldn't have changed");
			var breaking_price = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
			return dapp.changePrice(id, breaking_price, {from: account_one}).then(assert.fail).catch(function(error) {
				assertInvalid(error, 'Expect invalid opcode as price would overflow stake.');
				return dapp.getPrice(id);
			});
		}).then(function(p) {
			assert.equal(p, price, "Price shouldn't have changed");
			return dapp.changePrice(id, new_price, {from: account_one});
		}).then(function(result) {
			assertEvent(result, "LogMarketPriceChanged", id, "Event LogMarketPriceChanged should have fired");
			return dapp.getPrice(id);
		}).then(function(p) {
			assert.equal(p, new_price, "Price should have changed");
			return dapp.changeMinStake(id, new_minStake, {from: account_two}).then(assert.fail).catch(function(error) {
				assertInvalid(error,'Expect invalid opcode as account_two is not the provider.');
				return dapp.getMinStake(id);
			});
		}).then(function(m) {
			assert.equal(m, minStake, "Minimum stake should not have changed");
			return dapp.changeMinStake(id, new_minStake, {from: account_one});
		}).then(function(result) {
			assertEvent(result, "LogMarketMinStakeChanged", id, "Event LogMarketMinStakeChanged should have fired");
			return dapp.getMinStake(id);
		}).then(function(m) {
			assert.equal(m, new_minStake, "Minimum stake should have changed");
			return dapp.changeStakeRate(id, new_stakeRate, {from: account_two}).then(assert.fail).catch(function(error) {
				assertInvalid(error, "Expect invalid opcode as account_two is not the provider.");
				return dapp.getStakeRate(id);
			});
		}).then(function(s) {
			assert.equal(s, stakeRate, "Stake rate should not have changed");
			return dapp.changeStakeRate(id, 0, {from: account_one}).then(assert.fail).catch(function(error) {
				assertInvalid(error, "Expected invalid opcode as 0 is not a valid stake rate");
				return dapp.getStakeRate(id);
			});
		}).then(function(s) {
			assert.equal(s, stakeRate, "Stake rate should not have changed");
			var breaking_stakeRate = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
			return dapp.changeStakeRate(id, breaking_stakeRate, {from: account_one}).then(assert.fail).catch(function(error) {
				assertInvalid(error, "Expected invalid opcode as stake rate would have been too big");
				return dapp.getStakeRate(id);
			});
		}).then(function(s) {
			assert.equal(s, stakeRate, "Stake rate should not have changed");
			return dapp.changeStakeRate(id, new_stakeRate, {from: account_one});
		}).then(function(result) {
			assertEvent(result, "LogMarketStakeRateChanged", id, "Event LogMarketMinStakeChanged should have fired");
			return dapp.getStakeRate(id);
		}).then(function(s) {
			assert.equal(s, new_stakeRate, "Stake rate should have changed");
		});
	});
	
});