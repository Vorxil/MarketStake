var Ledger = artifacts.require("Ledger");
var ProductRegister = artifacts.require("MarketRegister");
var ProductOrderBook = artifacts.require("ProductOrderBook");
var MarketStake = artifacts.require("MarketStake");

function assertEvent(result, event_id, id, message) {
	var event_occurred;
	
	for(var i = 0; i < result.logs.length; i++) {
		var log = result.logs[i];
		if (log.event === event_id) {
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

function assertUserEvent(result, event_id, fields, values, message) {
	var event_occurred;
	
	for(var i = 0; i < result.logs.length; i++) {
		var log = result.logs[i];
		if (log.event === event_id) {
			console.log(log.args);
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

function assertInvalid(error, message) {
	assert.isAbove(
		error.message.search('invalid opcode'),
		-1,
		message
	);
}

function fetchID(result, eventName) {
	var id;
	for(var i = 0; i < result.logs.length; i++) {
		var log = result.logs[i];
		if (log.event === eventName) {
			console.log(log.args);
			id = log.args.id;
			break;
		}
	}
	assert.isTrue(id !== undefined, "There should be an id");
	return id;
}

function fetchOrderID(result, eventName, market) {
	var event_occurred;
	
	var id;
	for(var i = 0; i < result.logs.length; i++) {
		var log = result.logs[i];
		if (log.event === eventName) {
			console.log(log.args);
			event_occurred = (market === log.args.marketID);
			if (event_occurred) {
				id = log.args.orderID;
				break;
			}
		}
	}
	assert.isTrue(event_occurred && id !== undefined, "There should be an id");
	return id;
}

contract("TestProductOrderBook", function() {
	
	var dapp;
	var clientLedger;
	var providerLedger;
	var register;
	var book;
	
	var accounts;
	var admin;
	var client;
	var provider;
	var outsider;
	
	var market_id;
	var price = 10;
	var stakeRate = 2;
	var minStake = 25;
	
	beforeEach(function() {
		return Ledger.new().then(function(instance) {
			clientLedger = instance;
			return Ledger.new();
		}).then(function(instance) {
			providerLedger = instance;
			return ProductRegister.new();
		}).then(function(instance) {
			register = instance;
			return ProductOrderBook.new();
		}).then(function(instance) {
			book = instance;
			return MarketStake.new(
				clientLedger.address,
				providerLedger.address,
				register.address,
				book.address
			);
		}).then(function(instance) {
			dapp = instance;
			accounts = dapp.contract._eth.accounts;
			admin = accounts[0];
			client = accounts[1];
			provider = accounts[2];
			outsider = accounts[3];
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
			return book.allow(dapp.address);
		}).then(function() {
			return book.allowed(dapp.address);
		}).then(function(b) {
			assert.isTrue(b[0], "Dapp should be allowed on order book");
			return register.isMetered();
		}).then(function(b) {
			assert.isFalse(b, "Register should not be metered");
			return book.isMetered();
		}).then(function(b) {
			assert.isFalse(b, "Order book should not be metered");
			return dapp.addMarket(price, minStake, stakeRate, 0, {from: provider});
		}).then(function(result) {
			market_id = fetchID(result, "LogNewMarket");
			return register.exists(market_id);
		}).then(function(b) {
			assert.isTrue(b, "Market should exist");
			return register.provider(market_id);
		}).then(function(a) {
			assert.equal(a, provider, "Provider should be the owner");
		});
	});
	
	function order(market, count, sender, expectedStake, expectedFee) {
		var id;
		
		function worker() {
			return dapp.order(market, count, {from: client}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market);
				return book.exists(id);
			}).then(function(b) {
				assert.isTrue(b, "Order should exist");
				return book.active(id);
			}).then(function(b) {
				assert.isFalse(b, "Order should be inactive");
				return book.markets(id);
			}).then(function(m) {
				assert.equal(m, market, "Order should have the right market");
				return book.clients(id);
			}).then(function(a) {
				assert.equal(a, client, "Client of the order should be the sender of the order");
				return book.price(id);
			}).then(function(p) {
				assert.equal(p, price, "Price should match");
				return book.stake(id);
			}).then(function(s) {
				assert.equal(s, expectedStake, "Stake should match expected");
				return book.fee(id);
			}).then(function(f) {
				assert.equal(f, expectedFee, "Fee should match expected");
				return book.count(id);
			}).then(function(c) {
				assert.equal(c, count, "Count should match");
			});
		}
		
		return worker().then(function() {return id;});		
	}
	
	function verifyOrderNotStarted(id, client, client_deposit, provider, provider_deposit, confirmations) {
		return book.confirmations(id).then(function(c) {
			assert.isTrue(c[0] === confirmations[0], "Client confirm should match");
			assert.isTrue(c[1] === confirmations[1], "Provider confirm should match");
			return book.active(id);
		}).then(function(a) {
			assert.isFalse(a, "Order should not yet be activated");
			return clientLedger.pending(client);
		}).then(function(p) {
			assert.equal(p, client_deposit, "Client funds should not yet be moved");
			return clientLedger.locked(client);
		}).then(function(b) {
			assert.equal(b, 0, "Client ledger should be intact.");
			return clientLedger.gains(client);
		}).then(function(g) {
			assert.equal(g, 0, "Client ledger should be intact.");
			return providerLedger.pending(provider);
		}).then(function(p) {
			assert.equal(p, provider_deposit, "Provider funds should not yet be moved");
			return providerLedger.locked(provider);
		}).then(function(b) {
			assert.equal(b, 0, "Provider ledger should be intact.");
			return providerLedger.gains(provider);
		}).then(function(g) {
			assert.equal(g, 0, "Provider ledger should be intact.");
		});
	}
	
	function verifyOrderStarted(id, client, client_deposit, provider, provider_deposit, stake, fee) {
		return book.confirmations(id).then(function(c) {
			assert.isTrue(c[0], "Client should be confirmed");
			assert.isTrue(c[1], "Provider should be confirmed");
			return book.active(id);
		}).then(function(a) {
			assert.isTrue(a, "Order should be activated");
			return clientLedger.pending(client);
		}).then(function(p) {
			assert.equal(p, client_deposit-stake, "Client funds should not yet be moved");
			return clientLedger.locked(client);
		}).then(function(b) {
			assert.equal(b, stake, "Client ledger should be intact.");
			return clientLedger.gains(client);
		}).then(function(g) {
			assert.equal(g, fee, "Client ledger should be intact.");
			return providerLedger.pending(provider);
		}).then(function(p) {
			assert.equal(p, provider_deposit-stake, "Provider funds should not yet be moved");
			return providerLedger.locked(provider);
		}).then(function(b) {
			assert.equal(b, stake, "Provider ledger should be intact.");
			return providerLedger.gains(provider);
		}).then(function(g) {
			assert.equal(g, 2*fee, "Provider ledger should be intact.");
		});
	}
	
	it("Should be able to make an order", function() {
		var id;
		var count = 1;
		var expectedStake = count*price*stakeRate;
		var expectedFee = count*price;
		
		return order(market_id, count, client, expectedStake, expectedFee).then(function(_id) {
			id = _id;
			console.log(id);
		});
	});
	
	it("The provider should be able to make an order on its own market", function() {
		var id;
		var count = 1;
		var expectedStake = count*price*stakeRate;
		var expectedFee = count*price;
		
		return order(market_id, count, provider, expectedStake, expectedFee).then(function(_id) {
			id = _id;
			console.log(id);
		});
	});
	
	it("Should be able to make an order for more than one non-metered goods", function() {
		var id;
		var count = 5;
		var expectedStake = count*price*stakeRate;
		var expectedFee = count*price;
		
		return order(market_id, count, client, expectedStake, expectedFee).then(function(_id) {
			id = _id;
			console.log(id);
			return order(market_id, count, provider, expectedStake, expectedFee);
		}).then(function(_id) {
			id = _id;
			console.log(id);
		});
	});
	
	it("Should not make orders that can overflow stake", function() {
		var id;
		var count = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
		var expectedStake = count*price*stakeRate;
		var expectedFee = count*price;
		
		return order(market_id, count, client, expectedStake, expectedFee).then(assert.fail).catch(function(error) {
			assertInvalid(error, "Should be invalid opcode because overflow");
		});
	});
	
	it("Given funds have been deposited, client and provider should be able to confirm order", function() {
		var id;
		var count = 1;
		var stake = count*price*stakeRate;
		var fee = count*price;
		var deposit = 3*stake;
		
		var init_client;
		var init_provider;
		var final_client;
		var final_provider;
		
		return order(market_id, count, client, stake, fee).then(function(_id) {
			id = _id;
			console.log(id);
			return dapp.depositClient({value: deposit, from: client});
		}).then(function(result) {
			return dapp.depositProvider({value: deposit, from: provider});
		}).then(function(result) {
			return clientLedger.pending(client);
		}).then(function(p) {
			init_client = p;
			return providerLedger.pending(provider);
		}).then(function(p) {
			init_provider = p;
			return dapp.confirm(id, {from: client});
		}).then(function(result) {
			assertUserEvent(
				result,
				"LogOrderConfirmed",
				["orderID", "confirmer"],
				[id, client],
				"Event LogOrderConfirmed should be fired"
			);
			return verifyOrderNotStarted(
				id,
				client,
				deposit,
				provider,
				deposit,
				[true, false]
			);
		}).then(function() {			
			return dapp.confirm(id, {from: provider});
		}).then(function(result) {
			assertUserEvent(
				result,
				"LogOrderConfirmed",
				["orderID", "confirmer"],
				[id, provider],
				"Event LogOrderConfirmed should be fired"
			);
			assertUserEvent(
				result,
				"LogOrderActivated",
				["orderID"],
				[id],
				"Event LogOrderActivated should be fired"
			);
			return verifyOrderStarted(
				id,
				client,
				deposit,
				provider,
				deposit,
				stake,
				fee
			);
		}).then(function() {
			return clientLedger.pending(client);
		}).then(function(p) {
			final_client = p;
			return providerLedger.pending(provider);
		}).then(function(p) {
			final_provider = p;
			assert.equal(final_client, init_client-stake, "Stake should be locked");
			assert.equal(final_provider, init_provider-stake, "Stake should be locked");
		});
	});
	it("Given lack of funds, order should not be confirmable");
	it("If order has not been confirmed, then the order should be cancellable without paying fee");
	it("If confirmed, the order is now active");
	it("If confirmed, the client and provider should be able to provide readings");
	it("If the readings match, the order should be filled");
	it("At any time, if confirmed, the order can be cancelled unilaterally by paying a fee");
	it("If confirmed, the client and provider can agree to cancel bilaterally, waiving the fee");
	
})