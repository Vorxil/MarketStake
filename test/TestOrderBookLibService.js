var Ledger = artifacts.require("Ledger");
var ServiceRegister = artifacts.require("ServiceRegister");
var ServiceOrderBook = artifacts.require("ServiceOrderBook");
var MarketStake = artifacts.require("MarketStake");

function assertEvent(result, event_id, id, message) {
	var event_occurred;
	
	for(var i = 0; i < result.logs.length; i++) {
		var log = result.logs[i];
		if (log.event === event_id) {
			//console.log(log.args);
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
			//console.log(log.args);
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
			//console.log(log.args);
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

//TODO: Reorganize, test basic functionality first, then assume correctness.
contract("TestServiceOrderBook", function() {
	
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
	var tolerance = 10;
	
	beforeEach(function() {
		return Ledger.new().then(function(instance) {
			clientLedger = instance;
			return Ledger.new();
		}).then(function(instance) {
			providerLedger = instance;
			return ServiceRegister.new();
		}).then(function(instance) {
			register = instance;
			return ServiceOrderBook.new();
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
			assert.isTrue(b, "Register should be metered");
			return book.isMetered();
		}).then(function(b) {
			assert.isTrue(b, "Order book should be metered");
			return dapp.addMarket(price, minStake, stakeRate, tolerance, {from: provider});
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
	
	function checkLedger(ledger, account, pending, locked, gains) {
		return ledger.pending(account).then(function(p) {
			assert.equal(p, pending, "Pending should match");
			return clientLedger.locked(account);
		}).then(function(b) {
			assert.equal(b, locked, "Locked should match");
			return clientLedger.gains(account);
		}).then(function(g) {
			assert.equal(g, gains, "Gains should match");
		});
	}
	
	function order(market, amount, sender, expectedStake, expectedFee) {
		var id;
		
		function worker() {
			return dapp.order(market, amount, {from: sender}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market);
				assertUserEvent(
					result,
					"LogNewOrder",
					["marketID", "orderID", "price", "amount", "stake"],
					[market_id, id, price, amount, expectedStake],
					"Event LogNewOrder should be fired"
				);
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
				assert.equal(a, sender, "Client of the order should be the sender of the order");
				return book.price(id);
			}).then(function(p) {
				assert.equal(p, price, "Price should match");
				return book.stake(id);
			}).then(function(s) {
				assert.equal(s, expectedStake, "Stake should match expected");
				return book.fee(id);
			}).then(function(f) {
				assert.equal(f, expectedFee, "Fee should match expected");
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
			return checkLedger(clientLedger, client, client_deposit, 0, 0);
		}).then(function() {
			return checkLedger(providerLedger, provider, provider_deposit, 0, 0);
		});
	}
	
	function verifyOrderStarted(id, client, client_deposit, provider, provider_deposit, stake, fee) {
		return book.confirmations(id).then(function(c) {
			assert.isTrue(c[0], "Client should be confirmed");
			assert.isTrue(c[1], "Provider should be confirmed");
			return book.active(id);
		}).then(function(a) {
			assert.isTrue(a, "Order should be activated");
			return checkLedger(clientLedger, client, client_deposit-stake, stake, fee);
		}).then(function() {
			return checkLedger(providerLedger, provider, provider_deposit-stake, stake, 2*fee);
		});
	}
	
	function dep(client, provider, deposit) {
		return dapp.depositClient({value: deposit, from: client}).then(function() {
			return dapp.depositProvider({value: deposit, from: provider});
		});
	}

	function wit(client, provider) {
		return dapp.withdrawClient({from: client}).then(function() {
			return dapp.withdrawProvider({from: provider});
		});
	}
	
	it("Should be able to make an order", function() {
		var id;
		var amount = 1000;
		var expectedStake = amount*stakeRate;
		var expectedFee = amount;
		
		return order(market_id, amount, client, expectedStake, expectedFee).then(function(_id) {
			id = _id;
			//console.log(id);
		});
	});
	
	it("The provider should be able to make an order on its own market", function() {
		var id;
		var amount = 1000;
		var expectedStake = amount*stakeRate;
		var expectedFee = amount;
		
		return order(market_id, amount, provider, expectedStake, expectedFee).then(function(_id) {
			id = _id;
			//console.log(id);
		});
	});
	
	it("Should not make orders that can overflow stake", function() {
		var id;
		var amount = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
		var expectedStake = amount*stakeRate;
		var expectedFee = amount;
		
		return order(market_id, amount, client, expectedStake, expectedFee).then(assert.fail).catch(function(error) {
			assertInvalid(error, "Should be invalid opcode because overflow");
		});
	});
	
	it("Given funds have been deposited, client and provider should be able to confirm order", function() {
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var deposit = 3*stake;
		
		var init_client;
		var init_provider;
		var final_client;
		var final_provider;
		
		function clientProvider() {
			return order(market_id, amount, client, stake, fee).then(function(_id) {
				id = _id;
				//console.log(id);
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
		}
		
		function providerProvider() {
			return order(market_id, amount, provider, stake, fee).then(function(_id) {
				id = _id;
				init_provider = final_provider;
				return dapp.depositClient({value: deposit, from: provider});
			}).then(function(result) {
				assertUserEvent(
					result,
					"LogDepositClient",
					["depositor", "deposit"],
					[provider, deposit],
					"Event LogDepositClient should have been fired"
				);
				return clientLedger.pending(provider);
			}).then(function(p) {
				init_client = p;
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
				return book.confirmations(id).then(function(c) {
					assert.isTrue(c[0], "Client should be confirmed");
					assert.isTrue(c[1], "Provider should be confirmed");				
					return book.active(id);
				}).then(function(a) {
					assert.isTrue(a, "Order should be activated");
					return checkLedger(clientLedger, provider, deposit-stake, stake, fee);
				}).then(function() {
					return checkLedger(providerLedger, provider, deposit-2*stake, 2*stake, 4*fee);
				});
			}).then(function() {
				return clientLedger.pending(provider).then(function(p) {
					final_client = p;
					return providerLedger.pending(provider);
				}).then(function(p) {
					final_provider = p;
					assert.equal(final_client, init_client-stake, "Stake should be locked");
					assert.equal(final_provider, init_provider-stake, "Stake should be locked");
				});
			});
		}
	});
	
	it("Given lack of funds, order should not be confirmable", function() {
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		
		function clientProvider() {
			return clientLedger.pending(client).then(function(p) {
				assert.equal(p, 0, "Client should have no money on the ledger");
				return providerLedger.pending(provider);
			}).then(function(p) {
				assert.equal(p, 0, "Provider should have no money on the ledger");
				return order(market_id, amount, client, stake, fee);
			}).then(function(_id) {
				id = _id;
				return verifyOrderNotStarted(id, client, 0, provider, 0, [false, false]);
			}).then(function() {
				return dapp.confirm(id, {from: client});
			}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderConfirmed",
					["orderID", "confirmer"],
					[id, client],
					"Event LogOrderConfirmed should be fired"
				);
				return verifyOrderNotStarted(id, client, 0, provider, 0, [true, false]);
			}).then(function() {
				return dapp.confirm(id, {from: provider}).then(assert.fail).catch(function(error) {
					assertInvalid(error, "Invalid opcode due to lack of funds");
					return verifyOrderNotStarted(id, client, 0, provider, 0, [true, false]);
				});
			}).then(function() {
				return order(market_id, amount, client, stake, fee);
			}).then(function(_id) {
				id = _id;
				return verifyOrderNotStarted(id, client, 0, provider, 0, [false, false]);
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
				return verifyOrderNotStarted(id, client, 0, provider, 0, [false, true]);
			}).then(function() {
				return dapp.confirm(id, {from: client}).then(assert.fail).catch(function(error) {
					assertInvalid(error, "Invalid opcode due to lack of funds");
					return verifyOrderNotStarted(id, client, 0, provider, 0, [false, true]);
				});
			});
		}
		
		function providerProvider() {
			return clientLedger.pending(provider).then(function(p) {
				assert.equal(p, 0, "Provider should have no money on the client ledger");
				return providerLedger.pending(provider);
			}).then(function(p) {
				assert.equal(p, 0, "Provider should have no money on the provider ledger");
				return order(market_id, amount, provider, stake, fee);
			}).then(function(_id) {
				id = _id;
				return verifyOrderNotStarted(id, client, 0, provider, 0, [false, false]);
			}).then(function() {
				return dapp.confirm(id, {from: provider}).then(assert.fail).catch(function(error) {
					assertInvalid(error, "Invalid opcode due to lack of funds");
					return verifyOrderNotStarted(id, client, 0, provider, 0, [false, false]);
				});
			});
		}
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
	});
	
	it("If order has not been confirmed, then the order should be cancellable without paying fee", function() {
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var deposit = 3*stake;
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
		function dep(client, provider) {
			return dapp.depositClient({value: deposit, from: client}).then(function() {
				return dapp.depositProvider({value: deposit, from: provider});
			});
		}
		
		function wit(client, provider) {
			return dapp.withdrawClient({from: client}).then(function() {
				return dapp.withdrawProvider({from: provider});
			});
		}
		
		function cancel(id, canceller, deposit, client, provider) {
			return dapp.cancelOrder(id, {from: canceller}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderCancelled",
					["orderID", "canceller"],
					[id, canceller],
					"Event LogOrderCancelled should be fired"
				);
				return book.exists(id)
			}).then(function(e) {
				assert.isFalse(e, "Order should no longer exist");
				return book.active(id);
			}).then(function(a) {
				assert.isFalse(a, "Order should not be active");
				return checkLedger(clientLedger, client, deposit, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit, 0, 0);
			});
		}
		
		function confirmOrder(id, confirmer) {
			return dapp.confirm(id, {from: confirmer});
		}
		
		function makeOrder(client, provider) {
			return order(market_id, amount, client, stake, fee).then(function(_id) {
				id = _id;
				return checkLedger(clientLedger, client, deposit, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit, 0, 0);
			});
		}
		
		function clientProvider() {
			
			//console.log("Client - Provider");
			
			return noConfirm().then(function() {
				return clientConfirm();
			}).then(function() {
				return providerConfirm;
			});
			
			function noConfirm() {
				//console.log("Client - Provider : No confirmation");
				
				return dep(client, provider).then(function() {
					return makeOrder(client, provider);
				}).then(function() {
					return cancel(id, client, deposit, client, provider);
				}).then(function() {
					return makeOrder(client, provider);
				}).then(function() {
					return cancel(id, provider, deposit, client, provider);
				}).then(function() {
					return wit(client,provider);
				});
			}
			
			function clientConfirm() {
				//console.log("Client - Provider : Client confirmation");
				
				return dep(client, provider).then(function() {
					return makeOrder(client, provider);
				}).then(function() {
					return confirmOrder(id, provider);
				}).then(function() {
					return cancel(id, client, deposit, client, provider);
				}).then(function() {
					return makeOrder(client, provider);
				}).then(function() {
					return confirmOrder(id, provider);
				}).then(function() {
					return cancel(id, provider, deposit, client, provider);
				}).then(function() {
					return wit(client,provider);
				});
			}
			
			function providerConfirm() {
				//console.log("Client - Provider : Provider confirmation");
				
				return dep(client, provider).then(function() {
					return makeOrder(client, provider);
				}).then(function() {
					return confirmOrder(id, provider);
				}).then(function() {
					return cancel(id, client, deposit, client, provider);
				}).then(function() {
					return makeOrder(client, provider);
				}).then(function() {
					return confirmOrder(id, provider);
				}).then(function() {
					return cancel(id, provider, deposit, client, provider);
				}).then(function() {
					return wit(client,provider);
				});
			}
		}
		
		function providerProvider() {
			
			//console.log("Provider - Provider");
			
			return noConfirm();
			
			function noConfirm() {
				//console.log("Provider - Provider : No confirmation");
				
				return dep(provider, provider).then(function() {
					return makeOrder(provider, provider);
				}).then(function() {
					return cancel(id, provider, deposit, provider, provider);
				}).then(function() {
					return wit(provider,provider);
				});
			}
			
		}
	});
	
	function avg(a, b) {
		return (a >>> 1) + (b >>> 1) + (a & b & 1);
	}
	
	it("If confirmed, the client and provider should be able to provide readings, completing if matched", function() {
		
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var cost;
		var deposit = 3*stake;
		var reading = 10;
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
		function giveReading(id, reading, sender, expectedReading, expectedGiven) {
			return dapp.completeOrder(id, reading, {from: sender}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderNewReading",
					["orderID", "reading"],
					[id, reading],
					"Event LogOrderNewReading should be fired"
				);
				return book.readings(id);
			}).then(function(r) {
				assert.equal(r[0], expectedReading[0], "Readings should match");
				assert.equal(r[1], expectedReading[1], "Readings should match");
				return book.givenReadings(id);
			}).then(function(g) {
				assert.equal(g[0], expectedGiven[0], "Given should match");
				assert.equal(g[1], expectedGiven[1], "Given should match");
			});
		}
		
		function giveReadingAndComplete(id, reading, sender, cost) {
			return dapp.completeOrder(id, reading, {from: sender}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderNewReading",
					["orderID", "reading"],
					[id, reading],
					"Event LogOrderNewReading should be fired"
				);
				assertUserEvent(
					result,
					"LogOrderFilled",
					["orderID", "cost"],
					[id, cost],
					"Event LogOrderFilled should be fired"
				);
				return book.exists(id);
			}).then(function(e) {
				assert.isFalse(e, "Order should be filled and deleted");
				return book.active(id);
			}).then(function(a) {
				assert.isFalse(a, "Order should be filled and inactive");
			});
		} 
		
		function clientProvider() {
			return dep(client, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: client});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: client});
			}).then(function() {
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be confirmed");
				return giveReading(id, reading, client, [reading, 0], [true, false]);
			}).then(function() {
				return giveReading(id, reading, client, [reading, 0], [true, false]);
			}).then(function() {
				return giveReading(id, reading+20, provider, [reading, reading+20], [true, true]);
			}).then(function() {
				cost = price*avg(reading, reading+5);
				return giveReadingAndComplete(id, reading+5, provider, cost);
			}).then(function() {
				return checkLedger(clientLedger, client, deposit-cost, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit+cost, 0, 0);
			}).then(function() {
				return wit(client, provider);
			}).then(function() {
				return dep(client, provider, deposit);
			}).then(function() {
				return dapp.order(market_id, amount, {from: client});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: client});
			}).then(function() {
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be confirmed");
				return giveReading(id, reading, provider, [0, reading], [false, true]);
			}).then(function() {
				return giveReading(id, reading, provider, [0, reading], [false, true]);
			}).then(function() {
				return giveReading(id, reading+20, client, [reading+20, reading], [true, true]);
			}).then(function() {
				return giveReadingAndComplete(id, reading+5, client, cost);
			}).then(function() {
				return checkLedger(clientLedger, client, deposit-cost, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit+cost, 0, 0);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function providerProvider() {
			return dep(provider, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: provider});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be confirmed");
				cost = price*reading;
				return giveReadingAndComplete(id, reading, provider, cost);
			}).then(function() {
				return checkLedger(clientLedger, provider, deposit-cost, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit+cost, 0, 0);
			}).then(function() {
				return wit(provider, provider);
			});
		};
	});
	
	it("At any time, if confirmed, the order can be cancelled unilaterally by paying a fee", function() {
		
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var deposit = 3*stake;
		var reading = 10;
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
		function uniCancel(client, provider, canceller) {
			return dapp.cancelOrder(id, {from: canceller}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderCancelled",
					["orderID", "canceller"],
					[id, canceller],
					"Event LogOrderCancelled should be fired"
				);
				return book.exists(id);
			}).then(function(e) {
				assert.isFalse(e, "Order should be cancelled");
				return checkLedger(clientLedger, client, (canceller == client)?deposit-fee:deposit+fee, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, (canceller == client)?deposit+fee:deposit-fee, 0, 0);
			});
		}
		
		function setup(client, provider) {
			return dep(client, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: client});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: client});
			}).then(function() {
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be confirmed");
			});
		}
		
		function testNoReading(client, provider, canceller) {
			return setup(client,provider).then(function() {
				return uniCancel(client, provider, canceller);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function testWithReading(client, provider, canceller, reader) {
			return setup(client, provider).then(function() {
				return dapp.completeOrder(id, reading, {from: reader});
			}).then(function() {
				return uniCancel(client, provider, canceller);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function testWithDifferentReading(client, provider, canceller) {
			return setup(client,provider).then(function() {
				return dapp.completeOrder(id, reading, {from: client});
			}).then(function() {
				return dapp.completeOrder(id, reading+20, {from: provider});
			}).then(function() {
				return uniCancel(client, provider, canceller);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function clientProvider() {
			//No reading, client cancels
			return testNoReading(client, provider, client).then(function() {
				//No reading, provider cancels
				return testNoReading(client, provider, provider);
			}).then(function() {
				//Client reading, client cancels
				return testWithReading(client, provider, client, client);
			}).then(function() {
				//Client reading, provider cancels
				return testWithReading(client, provider, provider, client);
			}).then(function() {
				//Provider reading, client cancels
				return testWithReading(client, provider, client, provider);
			}).then(function() {
				//Provider reading, provider cancels
				return testWithReading(client, provider, provider, provider);
			}).then(function() {
				//Different readings, client cancels
				return testWithDifferentReading(client, provider, client);
			}).then(function() {
				//Different readings, provider cancels
				return testWithDifferentReading(client, provider, provider);
			});
		}
		
		function providerProvider() {
			return dep(provider, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: provider});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be confirmed");
				return dapp.cancelOrder(id, {from: provider});
			}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderCancelled",
					["orderID", "canceller"],
					[id, provider],
					"Event LogOrderCancelled should be fired"
				);
				return book.exists(id);
			}).then(function(e) {
				assert.isFalse(e, "Order should be cancelled");
				return checkLedger(clientLedger, provider, deposit+fee, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit-fee, 0, 0);
			}).then(function() {
				return wit(provider, provider);
			});
		};
	});
	
	it("If market has shutdown during confirmed order, the provider pays the cancellation fee", function() {
		var market;
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var deposit = 3*stake;
		var reading = 10;
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
		function createMarket() {
			return dapp.addMarket(price, minStake, stakeRate, tolerance, {from: provider}).then(function(result) {
				market = fetchID(result, "LogNewMarket");
			});
		}
		
		function setup(client, provider) {
			return createMarket().then(function() {
				return dep(client, provider, deposit);
			}).then(function() {
				return dapp.order(market, amount, {from: client});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market);
				return dapp.confirm(id, {from: client});
			}).then(function() {
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be active");
			});
		}
		
		function shutdown() {
			return dapp.shutdownMarket(market, {from: provider}).then(function() {
				return register.active(market);
			}).then(function(a) {
				assert.isFalse(a, "Market should not be active");
			});
		}
		
		function cancel(canceller) {
			return dapp.cancelOrder(id, {from: canceller}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderCancelled",
					["orderID", "canceller"],
					[id, provider],
					"Event LogOrderCancelled should be fired"
				);
				return book.exists(id);
			}).then(function(e) {
				assert.isFalse(e, "Order should be cancelled");
			});
		}
		
		function tearDown(client, provider) {
			return checkLedger(clientLedger, client, deposit+fee, 0, 0).then(function() {
				return checkLedger(providerLedger, provider, deposit-fee, 0, 0);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function testNoReading(client, provider, canceller) {
			return setup(client, provider).then(function() {
				return shutdown();
			}).then(function() {
				return cancel(canceller);
			}).then(function() {
				return tearDown(client, provider);
			});
		}
		
		function testWithReading(client, provider, canceller, reader) {
			return setup(client, provider).then(function() {
				return dapp.completeOrder(id, reading, {from: reader});
			}).then(function() {
				return shutdown();
			}).then(function() {
				return cancel(canceller);
			}).then(function() {
				return tearDown(client, provider);
			});
		}
		
		function testWithDifferentReading(client, provider, canceller) {
			return setup(client, provider).then(function() {
				return dapp.completeOrder(id, reading, {from: client});
			}).then(function() {
				return dapp.completeOrder(id, reading+20, {from: provider});
			}).then(function() {
				return shutdown();
			}).then(function() {
				return cancel(canceller);
			}).then(function() {
				return tearDown(client, provider);
			});
		}
		
		function clientProvider() { //1363
			//No reading - client cancels
			return testNoReading(client, provider, client).then(function() {
				//No reading - provider cancels
				return testNoReading(client, provider, provider);
			}).then(function() {
				//Client reading - client cancels
				return testWithReading(client, provider, client, client);
			}).then(function() {
				//Client reading - provider cancels
				return testWithReading(client, provider, provider, client);
			}).then(function() {
				//Provider reading - client cancels
				return testWithReading(client, provider, client, provider);
			}).then(function() {
				//Provider reading - provider cancels
				return testWithReading(client, provider, provider, provider);
			}).then(function() {
				//Different reading - client cancels
				return testWithDifferentReading(client, provider, client);
			}).then(function() {
				//Different reading - provider cancels
				return testWithDifferentReading(client, provider, provider);
			});
		}
		
		function providerProvider() {
			//No reading - cancel
			return createMarket().then(function() {
				return dep(provider, provider, deposit);
			}).then(function() {
				return dapp.order(market, amount, {from: provider});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market);
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be active");
			}).then(function() {
				return shutdown();
			}).then(function() {
				return cancel(provider);
			}).then(function() {
				return tearDown(provider, provider);
			});
		}
	});
	
	it("If confirmed, the client and provider can agree to cancel bilaterally, waiving the fee", function() {
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var deposit = 3*stake;
		var reading = 10;
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
		function setup(client, provider) {
			return dep(client, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: client});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: client});
			}).then(function() {
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be active");
			});
		}
		
		function cancel(canceller) {
			return dapp.bilateralCancelOrder(id, {from: canceller}).then(function(result) {
				assertUserEvent(
					result,
					"LogOrderBilateralSought",
					["orderID", "seeker"],
					[id, canceller],
					"Event LogOrderBilateralSought should be fired"
				);
				return result;
			});				
		}
		
		function verifyCancel(result) {
			assertUserEvent(
				result,
				"LogOrderBilateralCancel",
				["orderID"],
				[id],
				"Event LogOrderBilateralCancel should be fired"
			);
			return book.exists(id).then(function(e) {
				assert.isFalse(e, "Order should be cancelled");
			});
		}
		
		function tearDown(client, provider) {
			return checkLedger(clientLedger, client, deposit, 0, 0).then(function() {
				return checkLedger(providerLedger, provider, deposit, 0, 0);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function testNoReading(client, provider, first, second) {
			return setup(client, provider).then(function() {
				return cancel(first);
			}).then(function() {
				return cancel(second);
			}).then(function(result) {
				return verifyCancel(result);
			}).then(function() {
				return tearDown(client, provider);
			});
		}
		
		function testWithReading(client, provider, first, second, reader) {
			return setup(client, provider).then(function() {
				return dapp.completeOrder(id, reading, {from: reader});
			}).then(function() {
				return cancel(first);
			}).then(function() {
				return cancel(second);
			}).then(function(result) {
				return verifyCancel(result);
			}).then(function() {
				return tearDown(client, provider);
			});
		}
		
		function testWithDifferentReading(client, provider, first, second) {
			return setup(client, provider).then(function() {
				return dapp.completeOrder(id, reading, {from: client});
			}).then(function() {
				return dapp.completeOrder(id, reading+20, {from: provider});
			}).then(function() {
				return cancel(first);
			}).then(function() {
				return cancel(second);
			}).then(function(result) {
				return verifyCancel(result);
			}).then(function() {
				return tearDown(client, provider);
			});
		}
		
		function clientProvider() {
			//No reading - client first
			return testNoReading(client, provider, client, provider).then(function() {
				//No reading - provider first
				return testNoReading(client, provider, provider, client);
			}).then(function() {
				//Client reading - provider first
				return testWithReading(client, provider, provider, client, client);
			}).then(function() {
				//Client reading - client first
				return testWithReading(client, provider, client, provider, client);
			}).then(function() {
				//Provider reading - client first
				return testWithReading(client, provider, client, provider, provider);
			}).then(function() {
				//Provider reading - provider first
				return testWithReading(client, provider, provider, client, provider);
			}).then(function() {
				//Different reading - provider first
				return testWithDifferentReading(client, provider, provider, client);
			}).then(function() {
				//Different reading - client first
				return testWithDifferentReading(client, provider, client, provider);
			});
		}
		
		function providerProvider() {
			//No reading
			return dep(provider, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: provider});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
				return dapp.confirm(id, {from: provider});
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Order should be active");
			}).then(function() {
				return cancel(provider);
			}).then(function(result) {
				return verifyCancel(result);
			}).then(function() {
				return tearDown(provider, provider);
			});
		}
	});
	
	it("Third parties should have no control access to orders", function() {
		var id;
		var amount = 1000;
		var stake = amount*stakeRate;
		var fee = amount;
		var deposit = 3*stake;
		var reading = 10;
		var cost = reading*price;
		
		return clientProvider().then(function() {
			return providerProvider();
		});
		
		function setup(client, provider) {
			return dep(client, provider, deposit).then(function() {
				return dapp.order(market_id, amount, {from: client});
			}).then(function(result) {
				id = fetchOrderID(result, "LogNewOrder", market_id);
			});
		}
		
		function confirmOrder(confirmer) {
			return dapp.confirm(id, {from: confirmer});
		}
		
		function cancelOrder(canceller) {
			return dapp.cancelOrder(id, {from: canceller});
		}
		
		function biCancel(seeker) {
			return dapp.bilateralCancelOrder(id, {from: seeker});
		}
		
		function complete(completer) {
			return dapp.completeOrder(id, reading, {from: completer});
		}
		
		function tearDown(client, provider) {
			return checkLedger(clientLedger, client, deposit, 0, 0).then(function() {
				return checkLedger(providerLedger, provider, deposit, 0, 0);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function testConfirm() {
			return confirmOrder(admin).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because admin is third party");
				return confirmOrder(outsider);
			}).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because outsider is third party");
			});
		}
		
		function testCancel() {
			return cancelOrder(admin).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because admin is third party");
				return cancelOrder(outsider);
			}).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because outsider is third party");
			});
		}
		
		function testBiCancel() {
			return biCancel(admin).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because admin is third party");
				return biCancel(outsider);
			}).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because outsider is third party");
			});
		}
		
		function testCompletion() {
			return complete(admin).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because admin is third party");
				return complete(outsider);
			}).then(assert.fail).catch(function(err) {
				assertInvalid(err, "Invalid because outsider is third party");
			});
		}
		
		function testThirdParty() {
			return testConfirm().then(function() {
				return testCancel();
			}).then(function() {
				return testBiCancel();
			}).then(function() {
				return testCompletion();
			});
		}
		
		function testInit(client, provider) {
			return setup(client, provider).then(function() {
				return testThirdParty;
			}).then(function() {
				return confirmOrder(client);
			}).then(function() {
				return confirmOrder(provider);
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Should be active");
				return testThirdParty();
			});
		}
		
		function clientProvider() {
			//Completing
			return testInit(client, provider).then(function() {
				return complete(client);
			}).then(function() {
				return testThirdParty();
			}).then(function() {
				return complete(provider);
			}).then(function() {
				return testThirdParty();
			}).then(function() {
				return checkLedger(clientLedger, client, deposit-cost, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit+cost, 0, 0);
			}).then(function() {
				return wit(client, provider);
			}).then(function() {
				//Cancelling
				return testInit(client, provider);
			}).then(function() {
				return cancelOrder(client);
			}).then(function() {
				return testThirdParty();
			}).then(function() {
				return checkLedger(clientLedger, client, deposit-fee, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit+fee, 0, 0);
			}).then(function() {
				return wit(client, provider);
			}).then(function() {
				return testInit(client, provider);
			}).then(function() {
				return cancelOrder(provider);
			}).then(function() {
				return testThirdParty();
			}).then(function() {
				return checkLedger(clientLedger, client, deposit+fee, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit-fee, 0, 0);
			}).then(function() {
				return wit(client, provider);
			}).then(function() {
				//Bilateral
				return testInit(client, provider);
			}).then(function() {
				return biCancel(client);
			}).then(function() {
				return testThirdParty();
			}).then(function() {
				return biCancel(provider);
			}).then(function() {
				return checkLedger(clientLedger, client, deposit, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit, 0, 0);
			}).then(function() {
				return wit(client, provider);
			}).then(function() {
				return testInit(client, provider);
			}).then(function() {
				return biCancel(provider);
			}).then(function() {
				return testThirdParty();
			}).then(function() {
				return biCancel(client);
			}).then(function() {
				return checkLedger(clientLedger, client, deposit, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit, 0, 0);
			}).then(function() {
				return wit(client, provider);
			});
		}
		
		function providerProvider() {
			return setup(provider, provider).then(function() {
				return testThirdParty;
			}).then(function() {
				return confirmOrder(provider);
			}).then(function() {
				return book.active(id);
			}).then(function(a) {
				assert.isTrue(a, "Should be active");
				return testThirdParty();
			}).then(function() {
				return complete(provider);
			}).then(function() {
				return checkLedger(clientLedger, provider, deposit-cost, 0, 0);
			}).then(function() {
				return checkLedger(providerLedger, provider, deposit+cost, 0, 0);
			}).then(function() {
				return wit(provider, provider);
			});			
		}
	});
	
	it("No action can be taken on orders that don't exist, without creating one", function() {
		var id = "0x0";
		
		return book.exists(id).then(function(e) {
			assert.isFalse(e, "Order shouldn't exist");
			return dapp.confirm(id, {from: client});
		}).then(assert.fail).catch(function(err) {
			assertInvalid(err, "Invalid because order doesn't exist");
			return dapp.cancelOrder(id, {from: client});
		}).then(assert.fail).catch(function(err) {
			assertInvalid(err, "Invalid because order doesn't exist");
			return dapp.bilateralCancelOrder(id, {from: client});
		}).then(assert.fail).catch(function(err) {
			assertInvalid(err, "Invalid because order doesn't exist");
			return dapp.completeOrder(id, 0, {from: client});
		}).then(assert.fail).catch(function(err) {
			assertInvalid(err, "Invalid because order doesn't exist");
		});
			
	});
	
})