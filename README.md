# OTSMSW one-time signature multisig wallet
One-time signatures is a most secure method, private key is used only once. Mutlisig - multiple private keys are used to sign one transaction. Multisig keys can be managed by many independent signers.

### competition
[parity signer](https://www.parity.io/technologies/signer/)
[gnosis safe](https://gnosis-safe.io/)
[whcypher](https://www.whalesheaven.com/whcypher)

A whole bunch of [ethereum wallets](https://ethereum.org/nl/wallets/find-wallet/)

### basics
OTSMSW is a contract (EVM or any other). Number of signers (n), threshold (th) and initial accounts (next) are defined at deployment .  
Each transaction is a transfer or any other contracts methods execution (DAO like feature). Transaction must be signed by accounts that defined at previous transaction or deploy and next accounts are stored for future transaction. Counter (nonce) are used to prevent same transaction reuse.
More illustrated post [One-time multi-signatures to improve security](https://medium.com/p/7b8ff6cd3878)


### setup
```js
// edit conf.js
// setup provider, network, scrypt
```
### offline
```bash
# optionally generate single key file, u don't need it if use metamask or similar
node code/otsmsw.js --keygen --keyfile keys/k2.json [--pwdfile keys.pwd]
# get some small amount of eth to generated address

# clear 
./clear.sh # remove next.json, prev.json, sig.json

# generate multisig keys/addresses
node code/otsmsw.js --next --n 3 --th 2 [--pwdfile keys.pwd]

# copy next.json to online device
```

### online
```bash
# deploy contract
node code/otsmsw.js --deploy --n 3 --th 2 [--pwdfile keys.pwd]
# get some big amount of eth to contract address

# debug only
node code/sendeth.js --to <addr> --value 0.1

# optionally read contract
node code/otsmsw.js --read

# copy contracts.json to offline device
```

### offline
```bash
# sign transaction
node code/otsmsw.js --sign --to <addr> --value 0.01 [--pwdfile keys.pwd]

# copy sig.json to online device
```

### online
```bash
# multisig transfer, data in sig.json
node code/otsmsw.js --transfer [--pwdfile keys.pwd]
```

##roadmap
cli version  
audit/refactoring  
ui version  
