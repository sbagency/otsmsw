// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


contract OTSMSW2 {
    uint8 private _ln; // total len
    uint8 private _th; // threshold
    uint32 private _nonce; // nonce
    mapping(address=>uint32) private _used; // _used[a]=nonce

    error CallFailed(bytes data);

    constructor(address[] memory next_, 
        uint8 th_, uint8 ln_){ // th of ln, ex: 2 of 3
        require(th_>0 && ln_>=th_,"th_>0 && ln_>=th_");
        _th=th_;
        _ln=ln_;
        _nonce=1;
        _updateNext(next_);
    }

    event Received(address, uint);
    
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        revert("fallback");
    }

    function _updateNext(address[] memory next)internal{
        uint l=next.length;
        require(l==_ln,"l==_ln");
        for(uint i=0;i<l;i++){
            address a=next[i];
            if(_used[a]!=0) revert("already used, _used[a]!=0");
            _used[a]=_nonce;
        }
    }

    function getTh() public view returns(uint8){
        return _th;
    }
    function getLn() public view returns(uint8){
        return _ln;
    }
    function getNonce() public view returns(uint32){
        return _nonce;
    }
    
    function getChainInfo() public view returns(uint,uint){
        return (block.chainid,block.timestamp);
    }

    function transferHash(address[] calldata next, uint256 value, address to,
        uint32 nonce) public view returns(bytes32){
        return keccak256(abi.encode(address(this),next,value,to,nonce,block.chainid));
    }

    bool private _entered;
    modifier enterCheck() {
        require(!_entered, "enter check");
        _entered = true;
        _;
        _entered = false;
    }

    function transferTest(bytes[] calldata sig, address[] calldata next, 
        uint256[] calldata value, address[] calldata to, uint32 nonce) public view returns(bytes32){        
        require(nonce==_nonce,"nonce==_nonce");
        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(abi.encode(address(this),next,value,to,nonce,block.chainid))
        );
        _validateAccounts(sig,hash);
        return hash;
    }

    function transfer(bytes[] calldata sig, address[] calldata next, 
        uint256[] calldata value, address[] calldata to, uint32 nonce) public enterCheck {        
        require(nonce==_nonce,"nonce==_nonce");

        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(abi.encode(address(this),next,value,to,nonce,block.chainid))
        );

        _validateAccounts(sig,hash);
        _nonce++;
        _updateNext(next);

        for (uint256 i = 0; i < to.length; ++i) {
            payable(to[i]).transfer(value[i]);
        }
    }

    function execute(bytes[] calldata sig, address[] calldata next,
        address[] calldata target, uint256[] calldata value, bytes[] calldata data, 
        uint32 nonce) public enterCheck {
        require(nonce==_nonce,"nonce==_nonce");

        bytes32 hash = ECDSA.toEthSignedMessageHash(
            keccak256(abi.encode(address(this),next,target,value,data,nonce,block.chainid))
        );

        _validateAccounts(sig,hash);
        _nonce++;
        _updateNext(next);        

        for (uint i = 0; i < target.length; ++i) {
            (bool success, bytes memory retdata) = target[i].call{value: value[i]}(data[i]);
            if(!success){
                revert CallFailed(retdata);
            } 
        }
        
    }

    function _validateAccounts(bytes[] calldata sig,bytes32 hash) internal view {
        uint l=sig.length;
        require(l <= _ln,"l <= _ln");
        require(l >= _th,"l >= _th");        
        for (uint i = 0; i < l; i++) {
            address a = ECDSA.recover(hash,sig[i]);
            require(_used[a]==_nonce,"_used[a]==_nonce");
        }
    }

}