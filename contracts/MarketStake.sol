pragma solidity ^0.4.11;

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
		
		bool active;
		bool exists;
	}
	
	mapping(address => uint) public pending;
	mapping(bytes32 => Market) public markets; //Markets are never deleted, only deactivated.
	mapping(bytes32 => Session) public sessions;
	
	uint256 session_nonce = 0;
	uint256 market_nonce = 0;
	
	event newMarket(bytes32 market_id);
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
	
	
	function addMarket(uint256 _price, uint256 _minStake, uint8 _stakeRate, uint256 _tolerance, bool _tagged) {
	    require(_stakeRate > 1);
	    require(!_tagged || _tolerance == 0);
	    bytes32 market_id = keccak256(msg.sender, market_nonce++);
	    
	    require(!markets[market_id].exists);
	    markets[market_id] = Market(msg.sender, _price, _minStake, _tolerance, _stakeRate, true, _tagged, true);
	    newMarket(market_id);
	}
	
	function shutdownMarket(bytes32 market_id) marketExists(market_id) onlyProvider(market_id){
	    markets[market_id].active = false;
	}
	
	function transferMarket(bytes32 market_id, address newProvider) marketExists(market_id) onlyProvider(market_id) {
	    markets[market_id].provider = newProvider;
	}
	
    function addStake(bytes32 market_id, uint256 stake) marketExists(market_id) isActiveMarket(market_id) {
        bytes32 session_id = keccak256(msg.sender, session_nonce++);
        
        Market memory market = markets[market_id];
        
        require(!sessions[session_id].exists);
        require(pending[msg.sender] >= stake);
        require(stake >= market.minStake);
        require(stake >= (market.tagged ? 1 : market.price)*market.stakeRate);
        
        pending[msg.sender] -= stake;
        sessions[session_id] = Session(market_id, msg.sender, stake, 0, 0, false, false, false, true);
        newStake(session_id);
    }
    
    function counterStake(bytes32 session_id) {
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
    
    function completeSession(bytes32 session_id, uint256 reading) {
        
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
    
    function cancel(bytes32 session_id) {
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
    
    function deposit() payable {
        pending[msg.sender] += msg.value;
    }
    
    function withdraw() returns(bool){
        uint amount = pending[msg.sender];
        if (amount > 0) {
            pending[msg.sender] = 0;
            msg.sender.transfer(amount);
        }
        return true;
    }
}