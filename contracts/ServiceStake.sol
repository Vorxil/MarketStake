pragma solidity ^0.4.11;

contract ServiceStake {
    
	mapping(address => uint) public pending;
    
    struct Service {
    	address provider;
    	uint256 price;
    	uint256 minStake;
    	uint256 tolerance;
    	uint8 stakeRate;
    	bool activeService;
    	bool exists;
    }
	
	mapping(bytes32 => Service) public services;
	//Services are never deleted, only deactivated.
	
	uint256 session_nonce = 0;
	uint256 service_nonce = 0;
	
	struct Session {
	    bytes32 service_id;
	    address client;
	    
		uint256 stake;
		
		uint256 providerReading;
		uint256 clientReading;
		bool clientGiven;
		bool providerGiven;
		
		bool active;
		bool exists;
	}
	
	mapping(bytes32 => Session) public sessions;
	
	event newService(bytes32 service_id);
	event newStake(bytes32 session_id);
	event sessionStarted(bytes32 session_id);
	event sessionEnded(bytes32 session_id, uint256 cost);
	event sessionReading(bytes32 session_id, uint256 reading);
	event sessionCancelled(bytes32 session_id);
	
	modifier serviceExists(bytes32 service_id) {
	    require(services[service_id].exists);
	    _;
	}
	modifier sessionExists(bytes32 session_id) {
	    require(sessions[session_id].exists);
	    _;
	}
	
	modifier onlyProvider(bytes32 service_id) {
	    require(msg.sender == services[service_id].provider);
	    _;
	}
	
	modifier isActiveService(bytes32 service_id) {
	    require(services[service_id].activeService);
	    _;
	}
	
	modifier isActiveSession(bytes32 session_id) {
	    require(sessions[session_id].active);
	    _;
	}
	
	
	function addService(address _provider, uint256 _price, uint256 _minStake, uint8 _stakeRate, uint256 _tolerance) {
	    require(_stakeRate > 1);
	    bytes32 service_id = keccak256(_provider, service_nonce++);
	    
	    require(!services[service_id].exists);
	    services[service_id] = Service(_provider, _price, _minStake, _tolerance, _stakeRate, true, true);
	    newService(service_id);
	}
	
	function shutdownService(bytes32 service_id) serviceExists(service_id) onlyProvider(service_id){
	    services[service_id].activeService = false;
	}
	
	function transferService(bytes32 service_id, address newProvider) serviceExists(service_id) onlyProvider(service_id) {
	    services[service_id].provider = newProvider;
	}
	
    function addStake(bytes32 service_id, uint256 stake) serviceExists(service_id) isActiveService(service_id) {
        bytes32 session_id = keccak256(msg.sender, session_nonce++);
        
        require(!sessions[session_id].exists);
        require(pending[msg.sender] >= stake);
        require(stake >= services[service_id].minStake);
        require(stake >= services[service_id].stakeRate);
        
        pending[msg.sender] -= stake;
        sessions[session_id] = Session(service_id, msg.sender, stake, 0, 0, false, false, false, true);
        newStake(session_id);
    }
    
    function counterStake(bytes32 session_id) {
        Session memory session = sessions[session_id];
        Service memory service = services[session.service_id];
        
        require(service.provider == msg.sender);
        require(service.exists);
        require(service.activeService);
        require(session.exists);
        require(!session.active);
        require(pending[service.provider] >= session.stake);
        
        pending[service.provider] -= session.stake;
        sessions[session_id].active = true;
        
        sessionStarted(session_id);
    }
    
    function checkReadings(bytes32 session_id, Session memory session, Service memory service) private returns(bool) {
        if (session.clientGiven && session.providerGiven && 
            ((session.clientReading >= session.providerReading && 
            session.clientReading - session.providerReading <= service.tolerance) || 
            (session.clientReading < session.providerReading && 
            session.providerReading - session.clientReading <= service.tolerance))) {
            
            
            uint256 avgReading = session.clientReading/2 + session.providerReading/2 + ((session.clientReading & 1) & (session.providerReading & 1));
                                    
            uint256 cost = avgReading*service.price;
            
            if (service.stakeRate*cost > session.stake) {
                cost = session.stake/service.stakeRate;
            }
                
            pending[service.provider] += session.stake + cost;
            pending[session.client] += session.stake - cost;
                
            delete sessions[session_id];
            
            sessionEnded(session_id, cost);
            return true;
        }
        return false;
    }
    
    function completeSession(bytes32 session_id, uint256 reading) {
        
        Session memory session = sessions[session_id];
        Service memory service = services[session.service_id];
        
        require(service.exists);
        require(service.activeService);
        require(session.exists);
        require(session.active);
        require(msg.sender == session.client || msg.sender == service.provider);
        
        if (msg.sender == session.client) {
            (session.clientReading, sessions[session_id].clientReading) = (reading, reading);
            if (!session.clientGiven) {
                (session.clientGiven, sessions[session_id].clientGiven) = (true, true);
            }
            if (!checkReadings(session_id, session, service)) {
                sessionReading(session_id, reading);
            }
        } 
        
        if (msg.sender == service.provider) {
            (session.providerReading, sessions[session_id].providerReading) = (reading, reading);
            if (!session.providerGiven) {
                (session.providerGiven, sessions[session_id].providerGiven) = (true, true);
            }
            if (!checkReadings(session_id, session, service)) {
                sessionReading(session_id, reading);
            }
        }
    }
    
    function cancel(bytes32 session_id) {
        Session memory session = sessions[session_id];
        Service memory service = services[session.service_id];
        
        require(session.exists);
        require(service.exists);
        require(session.client == msg.sender || service.provider == msg.sender);
        
        if (!session.active) {
            //No counter stake, just take money back
            pending[session.client] += session.stake;
            delete sessions[session_id];
            sessionCancelled(session_id);
            return;
        } 
        
        uint256 cost = session.stake/service.stakeRate;
        
        if (!service.activeService) {
            //Effective breach of contract by provider
            pending[session.client] += session.stake + cost;
            pending[service.provider] += session.stake - cost;
            delete sessions[session_id];
            sessionCancelled(session_id);
        } else {
            //Breach of contract by caller, caller pays fee equal to full price.
            pending[msg.sender] += session.stake - cost;
            pending[(msg.sender == service.provider) ? session.client : service.provider] += session.stake + cost;
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