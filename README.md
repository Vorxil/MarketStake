# MarketStake
Proof of concept for an Ethereum contract for buying and selling products and services off-chain using stakes to incentivize cooperaton and reduce risk of fraud.

## Contract ABI
##### addMarket
```javascript
function addMarket(
uint256 price,
uint256 minStake,
uint8 stakeRate,
uint256 tolerance,
bool tagged
)
```
Adds a new market. The provider sets the parameters for his market. 

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

##### shutdownMarket
```javascript
function shutdownMarket(bytes32 market_id)
```
Shuts down the market, permanently. Can only be done by the provider for his active markets.

_market\_id_ is the market ID.

Markets are stored permanently in the contract (with 256 bit hashes, collisions will be way off in the future). This is due to Session being dependent on Market. As the session only stores the hash ID of the market, deleting the market would require deleting, and refunding, all sessions, which is too expensive to do in a single transaction.

An alternative approach is to store a copy of the Market in the Session instance. This would allow the session to continue, but all sessions would still need to be informed that the market has shutdown. This could be done by signalling an update for the sessions' copies by storing an updated version elsewhere. But as some readers might notice, this is merely kicking the can down the road.

@Event _marketShutdown_ is fired if successful, containing the market ID.

##### transferMarket
```javascript
function transferMarket(bytes32 market_id, address newProvider)
```
Transfer ownership of the market to a new account. The new provider gets ownership rights and all future funds, including funds from all currently active sessions.