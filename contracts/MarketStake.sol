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
        uint256 cancellationFee;
        
        uint256 providerReading;
        uint256 clientReading;
        bool clientGiven;
        bool providerGiven;
        
        bool clientBiCancel;
        bool providerBiCancel;
        
        bool active;
        bool exists;
    }
    
    mapping(address => uint) public supply;//Total supply of ether involved by user
    mapping(address => uint) public balances;//Total amount of ether deposited by user
    mapping(address => uint) public pending; //Withdrawable ether
    /* Details:
     * pending := withdrawable ether
     * balances := pending + stakes
     * supply := balances + cancellation fee reservations
     * Invariant: pending <= balances <= supply
     */
    
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
     * Price must be less than ((2^256)-1)/stakeRate
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
        require(invariant(msg.sender));
        require(stakeRate > 1); //Incentive to force cooperation
        require(!tagged || tolerance == 0); //Zero tolerance for discrete products
        require(price <= uint256(-1)/stakeRate); //Overflow protection
        
        /* Generate market ID using the provider's address.
         * Market nonce added to allow multiple markets per provider.
         * Block number added so that provider doesn't get stuck in case
         * of hash collision and thus doesn't have to wait for a new market;
         * just wait for a new block i.e a few seconds.
         */
        bytes32 market_id = keccak256(msg.sender, block.number, market_nonce++);
        
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
        require(invariant(msg.sender));
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
        require(invariant(msg.sender));
        markets[market_id].active = false;
        marketShutdown(market_id);
        require(invariant(msg.sender));
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
        require(invariant(msg.sender));
        require(invariant(newProvider));
        
        uint256 lockedStakesAndFees = supply[msg.sender] - pending[msg.sender];
        uint256 lockedStakes = balances[msg.sender] - pending[msg.sender];
        require(lockedStakesAndFees <= uint256(-1) - supply[newProvider]);//Overflow protection
        
        /* Details:
         * The new provider must be able to accommodate the locked in stakes,
         * as the stakes aren't refunded on transfers.
         * Potential cancellation fees must also be accommodated.
         */
        
        //Set new provider
        markets[market_id].provider = newProvider;
        
        //Update pending
        //No update needed
        
        //Update balances
        //Transfer locked stakes
        balances[newProvider] += lockedStakes;
        balances[msg.sender] -= lockedStakes;
        
        //Update supply
        //Transfer locked stakes and fee reservations
        supply[newProvider] += lockedStakesAndFees;
        supply[msg.sender] -= lockedStakesAndFees;
        
        newMarketProvider(market_id);
        
        require(invariant(msg.sender));
        require(invariant(newProvider));
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
        require(invariant(msg.sender));
        
        /* Generate session ID using the client's address.
         * Market nonce added to allow multiple sessions per cient.
         * Block number added so that client doesn't get stuck in case
         * of hash collision and thus doesn't have to wait for a new session;
         * just wait for a new block i.e a few seconds.
         */
        bytes32 session_id = keccak256(msg.sender, block.number, session_nonce++);
        
        Market memory market = markets[market_id];
        
        require(!sessions[session_id].exists);
        require(pending[msg.sender] >= stake);
        require(stake >= market.minStake);
        require(stake >= (market.tagged ? market.price : 1)*market.stakeRate);
        
        uint256 fee = (market.tagged ? market.price : stake/market.stakeRate);
        
        require(fee <= uint256(-1) - supply[msg.sender]); //Overflow protection
        
        //Update pending
        //Lock stake
        pending[msg.sender] -= stake;
        
        //Update balances
        //Internal transfer, no update needed
        
        //Update supply
        //Add fee reservation
        supply[msg.sender] += fee;
        
        //Create session
        sessions[session_id] = Session(
            market_id, 
            msg.sender, 
            stake,
            fee,
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
        
        require(invariant(msg.sender));
    }
    
    /**
     * Provider stakes an equivalent sum from provider's deposit
     * and starts the session.
     * @param session_id The hash id of the session.
     * @return session_id via @event sessionStarted.
     */
    function counterStake(bytes32 session_id) external {
        
        require(invariant(msg.sender));
        
        Session memory session = sessions[session_id];
        Market memory market = markets[session.market_id];
        
        require(market.provider == msg.sender);
        require(market.exists);
        require(market.active);
        require(session.exists);
        require(!session.active);
        require(pending[market.provider] >= session.stake);
        
        require(session.cancellationFee <= uint256(-1) - supply[market.provider]); //Overflow protection
        
        //Update pending
        //Lock stake
        pending[market.provider] -= session.stake;
        
        //Update balances
        //Internal transfer, no update needed
        
        //Update supply
        //Add fee reservation
        supply[market.provider] += session.cancellationFee;
        
        //Start session
        sessions[session_id].active = true;
        
        sessionStarted(session_id);
        
        require(invariant(msg.sender));
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
        require(invariant(msg.sender));
        
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
        require(invariant(msg.sender));
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
        
        require(invariant(session.client));
        require(invariant(market.provider));
        
        require(session.exists);
        require(market.exists);
        require(session.client == msg.sender || market.provider == msg.sender);
        
        if (!session.active) {
            //No counter stake, just take money back
            
            //Update pending
            //Return stake
            pending[session.client] += session.stake;
            
            //Update balacnes
            //Internal transfer, no update needed
            
            //Update supply
            //Remove fee reservation
            supply[session.client] -= session.cancellationFee;
            
            //Delete session
            delete sessions[session_id];
            sessionCancelled(session_id);
            
            require(invariant(msg.sender));
            return;
        } 
        
        if (!market.active) {
            //Effective breach of contract by provider
            
            //Update pending
            //Return stakes and transfer fees
            pending[session.client] += session.stake + session.cancellationFee; 
            pending[market.provider] += session.stake - session.cancellationFee;
            
            //Update balances
            //Transfer fees
            balances[session.client] += session.cancellationFee;
            balances[market.provider] -= session.cancellationFee;
            
            //Update supply
            //Remove fee reservation and tranfer fees
            supply[market.provider] -= 2*session.cancellationFee;
            //Client's cancel's out
            
            delete sessions[session_id];
            sessionCancelled(session_id);
        } else {
            //Breach of contract by caller, caller pays fee equal to full price.
            address callee = (msg.sender == market.provider) ? session.client : market.provider;
            
            //Update pending
            //Return stakes and transfer fees
            pending[msg.sender] += session.stake - session.cancellationFee;
            pending[callee] += session.stake + session.cancellationFee;
            
            //Update balances
            //Transfer fees
            balances[msg.sender] -= session.cancellationFee;
            balances[callee] += session.cancellationFee;
            
            //Update supply
            //Remove fee reservation and tranfer fees
            supply[msg.sender] -= 2*session.cancellationFee;
            //Callee's cancels out
            
            delete sessions[session_id];
            sessionCancelled(session_id);
        }
        
        require(invariant(session.client));
        require(invariant(market.provider));
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
        
        require(invariant(session.client));
        require(invariant(market.provider));
        
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
            //Update pending
            //Return stakes
            pending[session.client] += session.stake;
            pending[market.provider] += session.stake;
            
            //Update balances
            //Internal transfer, no update needed
            
            //Update supply
            //Remove fee reservations
            supply[session.client] -= session.cancellationFee;
            supply[market.provider] -= session.cancellationFee;
            delete sessions[session_id];
            sessionCancelled(session_id);
        }
        
        require(invariant(session.client));
        require(invariant(market.provider));
    }
    
    /**
     * Deposit a sum of Ether onto the contract.
     * Payable
     */
    function deposit() payable external {
        
        require(invariant(msg.sender));
        require(msg.value <= uint256(-1) - supply[msg.sender]);
        
        pending[msg.sender] += msg.value;
        balances[msg.sender] += msg.value;
        supply[msg.sender] += msg.value;
        
        require(invariant(msg.sender));
    }
    
    /**
     * Withdraw deposit.
     * @return bool True if no error, throws otherwise.
     */
    function withdraw() external returns(bool){
        
        require(invariant(msg.sender));
        uint amount = pending[msg.sender];
        if (amount > 0) {
            pending[msg.sender] = 0;
            balances[msg.sender] -= amount;
            supply[msg.sender] -= amount;
            msg.sender.transfer(amount);
        }
        return true;
        
        require(invariant(msg.sender));
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
                uint256 correspondingStake = market.stakeRate*cost;
                
                //Check for overflows
                if ((avgReading > 0 && market.price != cost/avgReading) || 
                    (cost != correspondingStake/market.stakeRate) ||
                    (correspondingStake > session.stake)) //If overflowed, then correspondingStake > session.stake
                {
                    cost = session.stake/market.stakeRate;
                }
            } else {
                cost = market.price;
            }
            
            //Update pending
            //Return stakes and transfer cost
            pending[market.provider] += session.stake + cost;
            pending[session.client] += session.stake - cost;
            
            //Update balances
            //Transfer cost
            balances[market.provider] += cost;
            balances[session.client] -= cost;
            
            //Update supply
            //Remove fee reservations and transfer cost
            supply[market.provider] -= session.cancellationFee - cost; //fee >= cost
            supply[session.client] -= session.cancellationFee + cost;
                
            //Finish and delete session
            delete sessions[session_id];
            
            sessionEnded(session_id, cost);
            return true;
        }
        return false;
    }
    
    function invariant(address toCheck) private constant returns (bool) {
        return (pending[toCheck] <= balances[toCheck] && balances[toCheck] <= supply[toCheck]);
    }
	
	/**
	 * Fallback function
	 * Throws to prevent accidental deposits.
	 */
	function() { revert(); }
}