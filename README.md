# MarketStake
Proof of concept for an Ethereum contract for buying and selling products and services off-chain using stakes to incentivize cooperaton and reduce risk of fraud.

## Disclaimer
Code is law. Use MarketStake at your own risk.

Read and understand source code before use.

More details found in LICENSE.

## Description

### Introduction
Using Ethereum for payment transactions is a traditional use-case. Over time, implementations have moved from low-level transactions, to tokens and payment channels, and mostly for digital assets. Adapting this to physical assets is desirable for cutting out the middle man of markets. To this endeavor, there are various ideas on how to bring it to fruition using the power of smart contracts on Ethereum.

Take the use case of buying a car. It is easy for a car salesman to make the financial transaction with the customer on-site. A simple low-level transaction is all that's really needed. Alternatively tokens, whether they're stable or not. The reason for this is that the two parties are in direct contact with each other, thus cooperation is easily taken care of. The customer can verify the car works (short-term) to his satisfaction and the salesman can ensure he'll get his sales money.

Put some distance between the two, however, and the situation gets more complicated. The customer is seeking to buy the car off some website and suddenly a whole lot of care and trust needs to be put in, preferrably by both sides. If the salesman still delivers the car, then it's a simple fix. Payment can be done at the time the car changes hands.

What if the salesman never meets the customer face-to-face? The salesman might deliver the car but the customer may not be home. In terms of cars, there's a solution using smart devices to lock down the car until payment has been sent. A trial period may also be included for the user once a deposit has been made. This is known as smart property. Should the user be satisfied, or the trial run expires, the money is transferred to the salesman. The user can cancel the deposit before the trial expires, thus getting his money back and locking the car down again.

This requires the smart device to be integral to the system itself. Otherwise, a malicious savvy user can simply remove the device. Which presents us with another problem: incompatability. Not all systems can be wired to the blockchain. Old cars may not even have a computer on them! Strange, I know, but the world wasn't always all about computers. Other systems lack the ability to lock the goods down.

Let's look at the former, the henceforth called "dumb property". How could this be handled? If small enough, perhaps they could be fitted inside a Smart Crate, locked inside until payment is done. This, however, prevents the "trial run". The customer has no way of knowing he has gotten what he wants until he has already forfeited his money, even if the crate is made of transparent materials (there's more to a product than visuals!). The alternative of providing a trial run, however, prevents the salesman from getting his money. The customer can simply take the car and run.

A similar issue exists when it comes to services. For this, let's distinguish discrete products, e.g. "dumb property", from continuous services. An example is an electric vehicle charging station. Let's say Tesla decides to put up a few 120 kW chargers around the country. How would the customer charge his car while paying a fair price? He can't simply plug the charging chord in and immediately get his electric charge lest he simply run off with it. Neither can he give the money directly to Tesla and tell them to charge. That's a lot trust put into Tesla, no? And granted, Tesla may not be a money-grubbing supervillain but in a decentralized, trustless world, trust is something to be avoided.

### Prisoner Ransom Problem

This all can be visualized with a simple thought experiment. Imagine two parties, Alice and Bob, separated by a wide and foggy river. Alice has a prisoner, Peter, whom Bob is seeking to ransom. Both Alice and Bob have their own automated boats. However, neither can see nor hear eachother over the foggy river. Nor do they trust each other. Traveling to the other side could spell disaster for either of them. All they have is a phone, with which they can communicate.

How can Alice and Bob complete the exchance such that Alice gets the ransom and Bob gets Peter back, with neither of them being able to run off with both the ransom and Peter?

One way of looking at it is that the exchange must be simultaneous. Both the ransom and Peter must be sent across at the same time. This, however, requires synchronization of external events and with only their phones at hand to send a SYNC signal, this is unreliable.

In the real world, this would be handled with a mutually trusted, noncoercible, third party, Tina. Tina would hold onto the ransom, travel across the river, present Alice with the money, do the exchange in person, then return to Bob with Peter (or some variation thereof).

Ethereum would make an excellent third party, has its allegience lies only with the code itself. Alice and Bob could verify the source code and thus trust the contract. In Ethereum land, however, this is complicated by the fact that Ethereum lives in its own pocket universe, the EVM. It has _no idea_ of what happens around and it will only take whatever information the fire magicians would provide Ethereum, trapped in its platonic cave.

Ethereum can hold onto the money, certainly, but the main problem remains: it cannot, on its own, verify the external exchange has been completed. It needs external input, which still leaves open the problem Alice and Bob is facing: there is value to be gained by both sides but no value or incentive to cooperate.

Again, in the real world, we still have a pseudo-trustworthy entity we can turn to: the government. In Ethereum land, however, the purpose of the government is less defined. Instead, what we have is reputation, which is made complicated by the pseudonymity offered by Ethereum. Any malicious user can set up a convincing website and when that website goes bust, the malicious user can simply put up another one using a different account. And we cannot simply blacklist accounts based on to whomever the malicious user might have sent his ill-gotten gains without innocent users getting caught in the crossfire.

Reputation is a nice idea, but without serious consequences, I personally don't see it coming with any strong guarantees without a very high barrier to entry in the form of high trust from the community. Thus risk of fraud is a serious threat with no good way of combating it besides _caveat emptor_.

### MarketStake Solution

This is where MarketStake enters the picture. In the real world case of the trusted third party, by giving Tina his money, Bob now has an incentive to complete the transaction. By Tina's showing Bob's money, Alice now has an incentive to send Peter across. So the real world _has_ a solution, but Ethereum does not due to its blindness to external events in the real world. A proper solution must bridge this gap, must get Alice and Bob to agree on when the transaction is complete. So Tina writes a smart contract to do this.

If Bob gives the contract the ransom, he has a reason to complete the transfer. The contract obviously cannot send the money anywhere without knowing both Alice and Bob have agreed to complete (or cancel) the transaction. Similarly, neither Alice nor Bob can singlehandedly decide on completeness. If Alice controls it, she can take the money without sending Peter. If Bob controls it, he can leave the money stuck in the contract as he's already "paid" for Peter.

The solution, is that a user must lose more value by non-cooperation than cooperation. This is done through stakes. For instance, let's say Bob must stake twice the ransom. If he controlled the transaction completeness, Alice would send Peter off and Bob, like a truly terrible human being, believes Peter is not worth that much money, thus he completes the transaction. The contract then sends off the ransom to Alice and the remainder of the stake is returned to him.

Sounds simple, doesn't it?

Not quite. Let's say Bob stakes his money. Let's also say that Alice hates Bob and only wants to hurt him. She may have no intention to send Peter and may not care about the money. Thus if Peter isn't sent, then Bob is screwed. His money is stuck on the contract. And Bob cannot simply unilaterally cancel the transaction and expect to be fully reimbursed--that would be abusable as Bob could simply cancel the transaction once Peter arrives.

The solution is to have Alice stake her money as well. How much is up to debate but for the purpose of MarketStake, the stakes must match. A malicious Alice would now face, hopefully, prohibitevly expensive costs in trying to damage Bob.

However, Bob still controls the transaction completeness. And while this may not be so bad at first glance, consider the charging station. How much is Bob to be charged for charging his car? Cars are charged based on a rate. If Bob decides, then he can get free energy by saying he charged zero kWh. If Alice decides, then she can make Bob pay the maximum amount every time by inflating the amount charged.

Clearly, both must agree on how much was charged. Thus both get to decide on when a transaction is completed.

Equal stakes with mutual agreement on transaction completeness, thus incentivizing cooperation and reducing risk of fraud. This is what MarketStake does.

### Potential

MarketStake's potential lies in facilitating decentralized and, optionally automated, off-chain trade of goods and services. 

Think of someone ordering from home. That order could be handled by small server in an automated warehouse, delivering the good by drone while having no interaction with the client besides the smart contract and encrypted delivery details.

Think of charging your car with just about any outlet, all automated with just the necessary deposit.

Selling goods and services over the world as if it was on the street with barely any interaction and no intermediaries.


## Issues

Rarely does an implementation lack issues, even less so for new technologies. As such, MarketStake will no doubt have a few quirks to iron out. Issues like currency fluctuation will, however, not be focused on, as it's outside the scope. Consumer protection laws et al. will also vary from country to country and there's nothing that can be done other than _code is law_ until stated otherwise. 

### Relative value problem

The idea behind MarketStake is to force two contractual parties to cooperate through economic incentive. Two economically rational parties, even if they don't trust each other, will still behave productively as they stand to gain their stakes back (after transaction fees and product/service price). In order for this to occur, the stake (which includes the price) must be greater than the price by some factor _k_ > 1. How large that factor needs to be is anyone's guess, but MarketStake accepts any integer _n_ > 1 and realistically needs to take transaction fees into account. Thus by not cooperating, the non-cooperator risks losing his whole stake, which is at least twice the price.

What is not factored in, however, and is difficult to mitigate is that the penalty of non-cooperating can still be relatively small compared to the non-cooperator's funds and/or income. Such a non-cooperator could simply eat the losses. Raising the stakes means fewer can afford to do so, but fewer honest parties can also afford to lay stakes.

An alternative approach is to implement a timer. However, if the stakes are returned at the end of the timer, then the client could simply receive the product and wait out the timer and get his money back. Alternatively, the provider can signal the contract the product has been delivered, thus the timer running out would transfer the price to the provider. However, this is also abusable as now the provider has no incentive to deliver what was promised, product or no. Both parties must agree that the product has arrived.

Which brings us to another problem...

### Dead non-cooperator

If one of the parties were to "disappear", then the funds would stay locked in the contract forever. As a timer would again be abusable, it is uncertain what could be done about this. I don't expect large providers and clients to drop off the planet without someone coming to pick up the assets. The hope is that larger parties will have a reduced risk of dead non-cooperator and smaller parties won't induce too large costs.

Until accounts are tied to national IDs alongside a trusted, external party that can verify the "state" of the account, there is little else that can be done.

### Dispute resolution

MarketStake is not a dispute resolver, it is merely the infrastructure for trustless off-chain transactions where the two parties don't even need to meet. The delivery address could be in the public, or a dead drop. If a dispute arises, all that MarketStake offers is unilateral and bilateral cancellation, the former having the cancelling party pay a cancellation fee and the latter returning the stakes in full.

At the moment, any other form of dispute resolution is up to the client and provider.

### Poisoned Apple Attack

As with any unregulated market, there is a serious concern for poisoned goods i.e. goods where the act of getting a reading (e.g. sampling an apple before entering the token ID) is potentially dangerous to the party getting the reading. As governmental action cannot be counted on, there still exists a level of _caveat emptor_ to be considered.

On its own, a poisoned apple attack is relatively expensive. However, if the provider's being paid by a third party to sell poisoned apples, the provider may not even care about getting the funds back from the contract.

Thus the need for reputation still exists. But hopefully in a less significant manner.

### Third-Party Collusion Attack

A third-party collusion attack is where the client colludes with a third party unknown to the provider. This third party would try to steal the product while in transit and the client would try to convince the provider that the product never arrived. The provider would then either send a new product or bilaterally cancel. The third party would afterwards hand over the stolen good to the client, leaving the client with the product without having to pay for it.

An on-chain solution is unknown to me. The best way to mitigate is to ensure the transport is secure and preferrably on a secret delivery path/schedule.

## Contract ABI

### Public Data

#### Market
```javascript
struct Market {
    address provider;
    uint256 price;
    uint256 minStake;
    uint256 tolerance;
    uint8 stakeRate;
    bool active;
    bool tagged;
    bool exists;
}
```

#### Session
```javascript
struct Session {
    bytes32 market_id;
    address client;

    uint256 stake;

    uint256 providerReading;
    uint256 clientReading;
    bool clientGiven;
    bool providerGiven;

    bool clientBiCancel;
    bool providerBiCancel;

    bool active;
    bool exists;
}
```

#### pending
```javascript
mapping(address => uint) public pending;
```

#### markets
```javascript
mapping(bytes32 => Market) public markets;
```

#### sessions
```javascript
mapping(bytes32 => Session) public sessions;
```

### Events
```javascript
event newMarket(bytes32 market_id);
event marketShutdown(bytes32 market_id);
event newMarketProvider(bytes32 market_id);
event newStake(bytes32 session_id);
event sessionStarted(bytes32 session_id);
event sessionEnded(bytes32 session_id, uint256 cost);
event sessionReading(bytes32 session_id, uint256 reading);
event sessionCancelled(bytes32 session_id);
```

### Functions

#### addMarket
```javascript
function addMarket(
    uint256 price,
    uint256 minStake,
    uint8 stakeRate,
    uint256 tolerance,
    bool tagged
) external
```
Adds a new market. The provider sets the parameters for his market.

Requires an empty market ID slot.

_price_  is the price per unit of the market item. For discete products, this is measured in Wei. For continuous services, this is measured in the Wei/[smallest measurable unit].

For example, the price of a car might be listed in Wei. A charging station might have a price listed in USD/kWh, but the contract, for the sake of precision, might list the price in Wei/J.

_minStake_ is the smallest absolute sum of Wei a client can stake.

_stakeRate_ is the smallest relative sum of Wei a client can stake. For discrete products, this is relative to the price. For continuous services, this is relative to the smallest payable unit i.e. 1 Wei/[smallest measurable unit].

_tolerance_ is the maximum deviation two parties' readings can deviate from each other. For discrete products, this must be zero as the readings are token IDs. For continuous services, this is twice the sensitivity of the reader, in [smallest measurable unit].

For instance, the car has a public token, whose ID the provider has set e.g. to the session ID. The client can read this token once the product arrives (or is savvy enough to guess). The provider reads the same token when sending the car. Both the provider and the client can then insert the token ID to complete the transaction.

For the car charging station, the provider and the client have their own sensors on their own ends, from which the they can read off how much they client has charged. The sensors might only be accurate to within 0.05 kWh thus a reasonable tolerance would be at least 0.1 kWh or 360 000 J. The provider and client can then insert their readings until they more or less agree with each other.

Note that a safety bound might be needed in case of hardware aging/failure.

_tagged_ decides whether or not the market is selling discrete products or continuous services.

@Event _newMarket_ is fired if successful, containing the market ID, a _keccak256_ hash of the caller's address and the market nonce.

#### shutdownMarket
```javascript
function shutdownMarket(bytes32 market_id) external
```
Shuts down the market, permanently.

Requires caller to be the provider and for the given market to exist and be active.

_market\_id_ is the market ID.

@Event _marketShutdown_ is fired if successful, containing the market ID.

Markets are stored permanently in the contract (with 256 bit hashes, collisions will be way off in the future). This is due to Session being dependent on Market. As the session only stores the hash ID of the market, deleting the market would require deleting, and refunding, all sessions, which is too expensive to do in a single transaction.

An alternative approach is to store a copy of the Market in the Session instance. This would allow the session to continue, but all sessions would still need to be informed that the market has shutdown. This could be done by signalling an update for the sessions' copies by storing an updated version elsewhere. But as some readers might notice, this is merely kicking the can down the road.

#### transferMarket
```javascript
function transferMarket(bytes32 market_id, address newProvider) external
```
Transfer ownership of the market to a new account. The new provider gets ownership rights and all future funds, including funds from all currently active sessions.

Requires the caller to be the provider and for the market to exist.

_market\_id_ is the market ID.

_newProvider_ is the new provider, to which the old provider wants to transfer the market.

@Event _newMarketProvider_ is fired if successful, containing the market Id.

#### addStake
```javascript
function addStake(bytes32 market_id, uint256 stake) external
```
Adds a stake on the market, setting up a new session.

Requires the market to exist and be active.

Requires the caller to have enough deposited funds to support the stake.

Requires the stake to be larger than the relative and absolute minimum stakes.

_market\_id_ is the market ID.

_stake_ is the amount of Ether in Wei that the caller, here designated the client, wants to stake.

@Event _newStake_ is fired if successful, containing the session ID, a _keccak256_ hash of the caller's address and the session nonce.

#### counterStake
```javascript
function counterStake(bytes32 session_id) external
```
Counters the client's stake with an equal stake, starting the session transaction.

Requires the caller to be the provider.

Requires the market to exist and be active.

Requires the session to exist and be inactive.

Requires the provider to have enough deposited funds to cover the stake.

_session\_id_ is the session ID.

@Event _sessionStarted_ is fired if successful, containing the session ID.

#### completeSession
```javascript
function completeSession(bytes32 session_id, uint256 reading) external
```
Send a reading to the session and complete the session transaction should the client and provider readings match within the tolerance of the market.

Requires the market to exist and be active.

Requires the session to exist and be active.

Requires the caller to be the client or provider (or both!)

_session\_id_ is the session ID.

_reading_ is the sensor reading in [smallest measurable unit] or token ID (unitless).

@Event _sessionReading_ is fired if Ethereum transaction is successful, but the readings didn't match. Contains the session ID and the reading.

@Event _sessionEnded_ is fired if Ethereum transaction is successful and the readings match, transferring the funds accordingly. Contains the session ID and the cost. The cost is the _price_ if the market is for discrete products. For continuous services, the cost is:

```
MIN(FLOOR((clientReading + providerReading)/2)*price, FLOOR(stake/stakeRate))
```

Providers, supply your services accordingly.

#### cancel
```javascript
function cancel(bytes32 session_id) external
```
Unilaterally cancel the session transaction.

Requires the market to exist.

Requires the session to exist.

Requires the caller to be the client, provider or both.

_session\_id_ is the session ID.

@Event _sessionCancelled_ is fired if successful, containing the session ID.

If the session hasn't started yet i.e. the session is inactive thus no stake has been countered, the stake is returned in full. 

If the session has started, but the market is inactive due to being shutdown, the provider has thus "breached the contract" and pays the client a cancellation fee equal to the full price.

If the session has started and the market is active, the caller pays the full price as a cancellation fee.

The full price is equal to the _price_ for discrete products and 

```
FLOOR(stake/stakeRate)
```
for continuous services.

#### bilateralCancel
```javascript
function bilateralCancel(bytes32 session_id) external
```
Agree to cancel the session bilaterally, returning the funds in full.

Requires the market to exist and be active.

Requires the session to exist and be active.

Requires the caller to be the client, provider or both.

_session\_id_ is the session ID.

@Event _sessionCancelled_ is fired if successful, containing the session ID.



#### deposit
```javascript
function deposit() payable external
```
Deposit funds on the contract.

Funds are decided by _msg.value_.


#### withdraw
```javascript
function withdraw() returns(bool) external
```
Withdraw deposited fund from contract.

Returns TRUE on success, throws on failure.
