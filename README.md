# MarketStake
Proof of concept for an Ethereum contract for buying and selling products and services off-chain using stakes to incentivize cooperaton and reduce risk of fraud.

## Disclaimer
Code is law. Use MarketStake at your own risk.

Read and understand source code before use.

More details found in LICENSE.

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

_tolerance_ is the maximum deviation two parties' readings can deviate from each other. For discrete products, this must be zero as the readings are token IDs. For continuous readings, this is twice the sensitivity of the reader, in [smallest measurable reading].

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
