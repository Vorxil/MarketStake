pragma solidity ^0.4.11;

import "./Ledger.sol";

library LedgerLib {
    
    function deposit(address ledger, uint amount) public {
        Ledger(ledger).addPending(msg.sender, amount);
    }
    
    function withdraw(address ledger) public {
        uint amount = Ledger(ledger).pending(msg.sender);
        if (amount > 0) {
            Ledger(ledger).removePending(msg.sender, amount);
            msg.sender.transfer(amount);
        }
    }
    
    function getBalance(address ledger) public returns (uint){
        return Ledger(ledger).balanceOf(msg.sender);
    }
    
    function getPending(address ledger) public returns (uint){
        return Ledger(ledger).pending(msg.sender);
    }
}