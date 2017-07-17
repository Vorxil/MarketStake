pragma solidity ^0.4.11;

/***
 * Contract for selling discrete products and continuous services
 * using stakes to incentivize cooperation and minimize risk of fraud.
 */
contract MarketStake {
    
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
    
    mapping(address => uint) public pending;
    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => Session) public sessions;
    
    /* Markets are never deleted, only deactivated, as sessions depend on markets.
     * Having sessions maintain a copy of the market would make market-wide
     * decisions expensive to implement such as market transfers
     * as each copy has to be updated separately.
     */
    
    uint256 private session_nonce = 0;
    uint256 private market_nonce = 0;
    
    event newMarket(bytes32 market_id);
    event marketShutdown(bytes32 market_id);
    event newMarketProvider(bytes32 market_id);
    event newStake(bytes32 session_id);
    event sessionStarted(bytes32 session_id);
    event sessionEnded(bytes32 session_id, uint256 cost);
    event sessionReading(bytes32 session_id, uint256 reading);
    event sessionCancelled(bytes32 session_id);
    
    modifier marketExists(bytes32 market_id) {
        require(markets[market_id].exists);
        _;
    }
    modifier sessionExists(bytes32 session_id) {
        require(sessions[session_id].exists);
        _;
    }
    
    modifier onlyProvider(bytes32 market_id) {
        require(msg.sender == markets[market_id].provider);
        _;
    }
    
    modifier isActiveMarket(bytes32 market_id) {
        require(markets[market_id].active);
        _;
    }
    
    modifier isActiveSession(bytes32 session_id) {
        require(sessions[session_id].active);
        _;
    }
    
    /**
     * Adds a market for discrete products or continuous services.
     * @param price The price of the market item.
     * Discrete product's price measured in Wei.
     * Continuous service's price measured in Wei/[Smallest measurable unit].
     * @param minStake The absolute minimum stake needed, in Wei.
     * @param stakeRate The relative minimum stake needed, in Wei.
     * Discrete product has minimum stake relative to price.
     * Continuous service has minimum stake relative to 1.
	 * Must be at least 2.
     * @param tolerance The maximum distance in [smallest measurable unit]
     * that two parties' readings can deviate from each other.
     * Must be zero for discrete products.
     * @param tagged True if discrete, False if continuous.
     * @return market_id The hash id of the market, via @event newMarket.
     */
    function addMarket(
        uint256 price,
        uint256 minStake,
        uint8 stakeRate,
        uint256 tolerance,
        bool tagged
    ) 
    external 
    {
        require(stakeRate > 1);
        require(!tagged || tolerance == 0);
        bytes32 market_id = keccak256(msg.sender, market_nonce++);
        
        require(!markets[market_id].exists);
        markets[market_id] = Market(
            msg.sender,
            price,
            minStake,
            tolerance,
            stakeRate,
            true,
            tagged,
            true
        );
        newMarket(market_id);
    }
    
    /**
     * Shutsdown the market, permanently.
     * Active sessions needs to be cancelled one by one.
     * @param market_id The hash id of the market.
     * @return market_id via @event marketShutdown.
     */
    function shutdownMarket(bytes32 market_id) 
    marketExists(market_id) 
    onlyProvider(market_id)
	isActiveMarket(market_id)
    external
    {
        markets[market_id].active = false;
        marketShutdown(market_id);
    }
    
    /**
     * Transfers ownership and payment account of the market.
     * @param market_id The hash id of the market.
     * @param newProvider The new provider account.
     * @return market_id via @event newMarketProvider.
     */
    function transferMarket(bytes32 market_id, address newProvider)
    marketExists(market_id)
    onlyProvider(market_id)
    external
    {
        markets[market_id].provider = newProvider;
        newMarketProvider(market_id);
    }
    
    /**
     * Adds a new stake by the client on an existing market.
     * @param market_id The hash id of the market.
     * @param stake How much the client is willing to stake from contract deposit.
     * @return session_id The hash id of the session via @event newStake.
     */
    function addStake(bytes32 market_id, uint256 stake)
    marketExists(market_id) 
    isActiveMarket(market_id) 
    external
    {
        bytes32 session_id = keccak256(msg.sender, session_nonce++);
        
        Market memory market = markets[market_id];
        
        require(!sessions[session_id].exists);
        require(pending[msg.sender] >= stake);
        require(stake >= market.minStake);
        require(stake >= (market.tagged ? market.price : 1)*market.stakeRate);
        
        pending[msg.sender] -= stake;
        sessions[session_id] = Session(
            market_id, 
            msg.sender, 
            stake,
            0, 
            0, 
            false,
            false,
            false,
            false,
            false,
            true
        );
        newStake(session_id);
    }
    
    /**
     * Provider stakes an equivalent sum from provider's deposit
     * and starts the session.
     * @param session_id The hash id of the session.
     * @return session_id via @event sessionStarted.
     */
    function counterStake(bytes32 session_id) external {
        Session memory session = sessions[session_id];
        Market memory market = markets[session.market_id];
        
        require(market.provider == msg.sender);
        require(market.exists);
        require(market.active);
        require(session.exists);
        require(!session.active);
        require(pending[market.provider] >= session.stake);
        
        pending[market.provider] -= session.stake;
        sessions[session_id].active = true;
        
        sessionStarted(session_id);
    }
    
    /**
     * Parties of the session send in their readings to the session.
     * If the readings are close enough to each other i.e. within maximum distance
     * given by the market's tolerance, then the session ends, funds are
     * transferred and stakes are returned.
     * @param session_id The hash id of the session.
     * @param reading The caller's reading. For discrete products, this is a token id.
     * @return session_id via @events sessionReading and sessionEnded.
     * @return reading via @event sessionReading.
     * @return cost The final cost of the transaction, via @event sessionEnded.
     */
    function completeSession(bytes32 session_id, uint256 reading) external {
        
        Session memory session = sessions[session_id];
        Market memory market = markets[session.market_id];
        
        require(market.exists);
        require(market.active);
        require(session.exists);
        require(session.active);
        require(msg.sender == session.client || msg.sender == market.provider);
        
        if (msg.sender == session.client) {
            (session.clientReading, sessions[session_id].clientReading) = (reading, reading);
            if (!session.clientGiven) {
                (session.clientGiven, sessions[session_id].clientGiven) = (true, true);
            }
            if (!checkReadings(session_id, session, market)) {
                sessionReading(session_id, reading);
            }
        } 
        
        if (msg.sender == market.provider) {
            (session.providerReading, sessions[session_id].providerReading) = (reading, reading);
            if (!session.providerGiven) {
                (session.providerGiven, sessions[session_id].providerGiven) = (true, true);
            }
            if (!checkReadings(session_id, session, market)) {
                sessionReading(session_id, reading);
            }
        }
    }
    
    /**
     * Unilaterally cancel the session. If the stake hasn't been countered, 
     * the stake is returned in full. Else, the caller pays the full price,
     * unless the provider has shutdown the market. In that case, the
     * provider pays the full price.
     * @param session_id The hash of the session.
     * @return session_id via @event sessionCancelled.
     */
    function cancel(bytes32 session_id) external {
        Session memory session = sessions[session_id];
        Market memory market = markets[session.market_id];
        
        require(session.exists);
        require(market.exists);
        require(session.client == msg.sender || market.provider == msg.sender);
        
        if (!session.active) {
            //No counter stake, just take money back
            pending[session.client] += session.stake;
            delete sessions[session_id];
            sessionCancelled(session_id);
            return;
        } 
        
        uint256 cost = market.tagged ? market.price : session.stake/market.stakeRate;
        
        if (!market.active) {
            //Effective breach of contract by provider
            pending[session.client] += session.stake + cost;
            pending[market.provider] += session.stake - cost;
            delete sessions[session_id];
            sessionCancelled(session_id);
        } else {
            //Breach of contract by caller, caller pays fee equal to full price.
            pending[msg.sender] += session.stake - cost;
            pending[(msg.sender == market.provider) ? session.client : market.provider] += session.stake + cost;
            delete sessions[session_id];
            sessionCancelled(session_id);
        }
    }
    
    
    /**
     * Bilaterally cancel the session. If both parties agree to cancel,
     * the stakes are returned in full.
     * @param session_id The hash ID of the session
     * @return session_id via @event sessionCancelled
     */
    function bilateralCancel(bytes32 session_id) external {
        Session memory session = sessions[session_id];
        Market memory market = markets[session_id];
        
        require(session.exists);
        require(market.exists);
        require(session.client == msg.sender || market.provider == msg.sender);
        require(market.active);
        require(session.active);
        
        if (msg.sender == session.client && !session.clientBiCancel) {
            (session.clientBiCancel, sessions[session_id].clientBiCancel) = (true, true);
        }
        
        if (msg.sender == market.provider && !session.providerBiCancel) {
            (session.providerBiCancel, sessions[session_id].providerBiCancel) = (true, true);
        }
        
        if (session.clientBiCancel && session.providerBiCancel) {
            pending[session.client] += session.stake;
            pending[market.provider] += session.stake;
            delete sessions[session_id];
            sessionCancelled(session_id);
        }
    }
    
    /**
     * Deposit a sum of Ether onto the contract.
     * Payable
     */
    function deposit() payable external {
        pending[msg.sender] += msg.value;
    }
    
    /**
     * Withdraw deposit.
     * @return bool True if no error, throws otherwise.
     */
    function withdraw() external returns(bool){
        uint amount = pending[msg.sender];
        if (amount > 0) {
            pending[msg.sender] = 0;
            msg.sender.transfer(amount);
        }
        return true;
    }
    
    /**
     * Checks the readings given the parties of the session and transfer funds.
     * Private helper function
     * @param session_id The hash id of the session.
     * @param session A memory pointer to the session.
     * @param market A memory pointer to the market.
     * @return bool True if session was completed, false if not.
     * @return session_id via @event sessionEnded.
     * @return cost The final cost of the transaction, via @event sessionEnded.
     */
    function checkReadings(bytes32 session_id, Session memory session, Market memory market) private returns(bool) {
        if (session.clientGiven && session.providerGiven && 
            ((session.clientReading >= session.providerReading && 
            session.clientReading - session.providerReading <= market.tolerance) || 
            (session.clientReading < session.providerReading && 
            session.providerReading - session.clientReading <= market.tolerance))) {
            
            uint256 cost;
            
            if (!market.tagged) {
                uint256 avgReading = session.clientReading/2 + session.providerReading/2 + 
                                    ((session.clientReading & 1) & (session.providerReading & 1));
                
                cost = avgReading*market.price;
                
                if (market.stakeRate*cost > session.stake) {
                    cost = session.stake/market.stakeRate;
                }
            } else {
                cost = market.price;
            }
                
            pending[market.provider] += session.stake + cost;
            pending[session.client] += session.stake - cost;
                
            delete sessions[session_id];
            
            sessionEnded(session_id, cost);
            return true;
        }
        return false;
    }
	
	/**
	 * Fallback function
	 * Throws to prevent accidental deposits.
	 */
	function() { revert(); }
}