var OrderBook = artifacts.require("OrderBook");

contract("TestOrderBookDelete", function() {
	
	var book;
	
	var accounts;
	var account_one;
	var account_two;
	
	beforeEach(function() {
		return OrderBook.new().then(function(instance) {
			book = instance;
			accounts = book.contract._eth.accounts;
			account_one = accounts[0];
			account_two = accounts[1];
			//console.log(account_one);
			//console.log(account_two);
			return book.allow(account_one);
		}).then(function() {
			return book.allowed(account_one);
		}).then(function(b) {
			assert.isTrue(b[0], "Account one should be allowed");
		});
	});
	
	it("Should be able to delete", function() {
		var id = "0x0000000000000000000000000000000000000000000000000000000000000001";
		var m_id = "0x0000000000000000000000000000000000000000000000000000000000000002";
		var price=100;
		var stake = 200;
		var fee = 100;
		var reading = 12;
		
		
		return book.setExists(id, true).then(function() {
			return book.exists(id);
		}).then(function(e) {
			assert.isTrue(e, "Should exist");
			return book.setMarket(id, m_id);
		}).then(function() {
			return book.markets(id);
		}).then(function(m) {
			assert.equal(m, m_id, "Market should be set");
			return book.setClient(id, account_one);
		}).then(function() {
			return book.clients(id);
		}).then(function(c) {
			assert.equal(c, account_one, "Account should be set");
			return book.setPrice(id, price);
		}).then(function() {
			return book.price(id);
		}).then(function(p) {
			assert.equal(p, price, "Price should be set");
			return book.setStake(id, stake);
		}).then(function() {
			return book.stake(id);
		}).then(function(s) {
			assert.equal(s, stake, "Stake should be set");
			return book.setFee(id, fee);
		}).then(function() {
			return book.fee(id);
		}).then(function(f) {
			assert.equal(f, fee, "Fee should be set");
			return book.setActive(id, true);
		}).then(function() {
			return book.active(id);
		}).then(function(a) {
			assert.isTrue(a, "Should be active");
			return book.setConfirmations(id, true, true);
		}).then(function() {
			return book.setConfirmations(id, true, false);
		}).then(function() {
			return book.confirmations(id);
		}).then(function(c) {
			assert.isTrue(c[0], "Client should be set");
			assert.isTrue(c[1], "Provider should be set");
			return book.setReadings(id, reading, true);
		}).then(function() {
			return book.setReadings(id, reading, false);
		}).then(function() {
			return book.readings(id);
		}).then(function(r) {
			assert.equal(r[0], reading, "Client should be set");
			assert.equal(r[1], reading, "Provider should be set");
			return book.setGivenReadings(id, true, true);
		}).then(function() {
			return book.setGivenReadings(id, true, false);
		}).then(function() {
			return book.givenReadings(id);
		}).then(function(g) {
			assert.isTrue(g[0], "Client should be set");
			assert.isTrue(g[1], "Provider should be set");
			return book.setBilateral(id, true, true);
		}).then(function() {
			return book.setBilateral(id, true, false);
		}).then(function() {
			return book.bilateral_cancel(id);
		}).then(function(b) {
			assert.isTrue(b[0], "Client should be set");
			assert.isTrue(b[1], "Provider should be set");
			return book.deleteItem(id);
		}).then(function() {
			return book.exists(id);
		}).then(function(e) {
			assert.isFalse(e, "Should no longer exist");
			return book.markets(id);
		}).then(function(m) {
			assert.equal(m, 0, "Market should no longer be set");
			return book.clients(id);
		}).then(function(c) {
			assert.equal(c.valueOf(), 0, "Account should no longer be set");
			return book.price(id);
		}).then(function(p) {
			assert.equal(p, 0, "Price should no longer be set");
			return book.stake(id);
		}).then(function(s) {
			assert.equal(s, 0, "Stake should no longer be set");
			return book.fee(id);
		}).then(function(f) {
			assert.equal(f, 0, "Fee should no longer be set");
			return book.active(id);
		}).then(function(a) {
			assert.isFalse(a, "Should no longer be active");
			return book.confirmations(id);
		}).then(function(c) {
			assert.isFalse(c[0], "Client should no longer be set");
			assert.isFalse(c[1], "Provider should no longer be set");
			return book.readings(id);
		}).then(function(r) {
			assert.equal(r[0], 0, "Client should no longer be set");
			assert.equal(r[1], 0, "Provider should no longer be set");
			return book.givenReadings(id);
		}).then(function(g) {
			assert.isFalse(g[0], "Client should no longer be set");
			assert.isFalse(g[1], "Provider should no longer be set");
			return book.bilateral_cancel(id);
		}).then(function(b) {
			assert.isFalse(b[0], "Client should no longer be set");
			assert.isFalse(b[1], "Provider should no longer be set");
		});
	});
});