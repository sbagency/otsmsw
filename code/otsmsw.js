const { ethers } = require("ethers");
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

const getPwdFromFileOrConsole = (fpwd)=>{

    return new Promise( (resolve, reject) => {
    
    if(fpwd){
       let pwd=fs.readFileSync(fpwd).toString()
       let l=pwd.length
       if(l<1){reject(new Error('empty pwd file'));return;}
       let pb=Buffer.from(pwd)
       if(pb[l-1] == 10 || pb[l-1] == 13) pwd=pwd.slice(0,l-1)
       if(pwd.length<1){reject(new Error('empty pwd'));return;}
       resolve(pwd)
    } else {
      const rl = readline.createInterface({input: process.stdin, output: process.stdout});
      rl.question('enter password:', (pwd) => {
          rl.close();
          console.log();
          if(pwd.length<1){reject(new Error('empty pwd'));return;}
          resolve(pwd)
      })
      rl._writeToOutput = (s)=>{};
    }
    
    
    }) // promise
}    

const getContractData=(name)=>{
    const dir='./build'
    const abi= JSON.parse(fs.readFileSync(`${dir}/${name}.abi`).toString())
    const bytecode = fs.readFileSync(`${dir}/${name}.bin`).toString()
    return {abi,bytecode}
}

const commandLineArgs = require('command-line-args')

const options = commandLineArgs([
    { name: 'help', alias: 'h', type: Boolean },
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'keygen', type: Boolean },
    { name: 'next', type: Boolean },
    { name: 'sign', type: Boolean },
    { name: 'deploy', type: Boolean },
    { name: 'transfer', type: Boolean },
    { name: 'read', type: Boolean },
    { name: 'key', type: String },
    { name: 'keyfile', type: String},
    { name: 'pwdfile', type: String},
    { name: 'addrfile', type: String, defaultValue:'contracts.json' },
    { name: 'nextfile', type: String, defaultValue:'next.json'  },
    { name: 'prevfile', type: String, defaultValue:'prev.json'  },
    { name: 'sigfile', type: String, defaultValue:'sig.json'  },
    { name: 'th', alias: 't', type: Number, defaultValue:1},
    { name: 'n', alias: 'n', type: Number, defaultValue:1 },
    { name: 'to', type: String },
    { name: 'value', type: String },
  ]) 

if(options.help){
    console.log('usage:')
    console.log('offline')
    console.log('node code/otsmsw.js --keygen')
    console.log('node code/otsmsw.js --next')
    console.log('node code/otsmsw.js --sign --to 0x.. --value 0.01')
    console.log('online')
    console.log('node code/otsmsw.js --deploy -n 3 -t 3')
    console.log('node code/otsmsw.js --read')
    console.log('node code/otsmsw.js --transfer --to 0x.. --value 0.01')
    process.exit(0);
}

const {provider,network,scrypt} = require('./conf');

if(!network || !provider){
    console.log('!network || !provider');
    process.exit(1);
}


(async ()=>{

var pwd;
if(!options.read){
    pwd = await getPwdFromFileOrConsole(options.pwdfile);
}


/*
if(options.pwdfile){
    pwd=fs.readFileSync(options.pwdfile)
} 
if(!pwd || pwd.length<5){
    console.log('bad pwd');
    process.exit(0);
}
*/

//----------------------------------------------------------------------

if(options.keygen){
    console.log('offline keygen...')    
    for(var i=0; i<10; i++){
    try{
        const privateKey=crypto.randomBytes(32);
        const wallet = new ethers.Wallet(privateKey);
        const walletAddress = await wallet.getAddress();
        console.log('walletAddress',walletAddress);
        const testMessage = 'Hello world!';
        const testSignature = await wallet.signMessage(testMessage);
        const a = ethers.utils.verifyMessage(testMessage,testSignature);
        if(a!=walletAddress){
          console.log('test verify failed',a);
          continue;
        }
        console.log('Encrypting... could take some time, define scrypt params in conf.js');
        const encJsonStr = await wallet.encrypt(pwd, {scrypt});
        const encJson = JSON.parse(encJsonStr);
        fs.writeFileSync(options.keyfile,JSON.stringify(encJson,null,2));  
    } catch(e){
        console.log(e);
        continue;
    }
    break;
    }    
    process.exit(0);
} // keygen

//----------------------------------------------------------------------
if(options.next){
console.log('offline next...')

if(!options.nextfile){
    console.log('!options.nextfile');
    process.exit(1);
}
if(options.n>255 || options.n<1){
  console.log('options.n>255 || options.n<1')
  process.exit(0)
}
if(options.th>options.n || options.th<1){
    console.log('options.th>options.n || options.th<1')
    process.exit(0)
}

const next=[];

let i=0; while(i<options.n){
let wallet;

try{
const privateKey=crypto.randomBytes(32);
wallet = new ethers.Wallet(privateKey);
const walletAddress = await wallet.getAddress();
//console.log('walletAddress',walletAddress);
const testMessage = 'Hello world!';
const testSignature = await wallet.signMessage(testMessage);
const a = ethers.utils.verifyMessage(testMessage,testSignature);
if(a!=walletAddress){
  console.log('test verify failed');
  continue;
}
} catch(e){console.log(e);continue;}

const encJsonStr = await wallet.encrypt(pwd, {scrypt});
next.push(JSON.parse(encJsonStr));

i++;
}

let nonce=1;

let nextFile;
try{ 
    nextFile=JSON.parse(fs.readFileSync(options.nextfile).toString());
    nonce=nextFile.nonce+1;
    // copy next -> prev
    fs.writeFileSync(options.prevfile,JSON.stringify(nextFile,null,2));
}catch(e){console.log('nextfile read error')}

console.log('nonce',nonce)

fs.writeFileSync(options.nextfile,JSON.stringify({next,nonce},null,2));   

process.exit(0)
} // next

//----------------------------------------------------------------------

var wallet;

if(!options.keyfile){
    wallet = provider.getSigner();
}   
else if(options.key) { 
    wallet = new ethers.Wallet(options.key); 
    wallet = wallet.connect(provider); 
}
else if(options.keyfile){
    const encrypted = fs.readFileSync(options.keyfile).toString();
    wallet = await ethers.Wallet.fromEncryptedJson(encrypted,pwd);
    wallet = wallet.connect(provider)
} else { 
    console.log('wrong key options');process.exit(0);
}

const walletAddress = await wallet.getAddress()
console.log('walletAddress',walletAddress)

const contractName='OTSMSW2';



const deployContract=async (contractName,args)=>{
    const {abi,bytecode}=getContractData(contractName)
    const Factory=new ethers.ContractFactory(abi, bytecode, wallet)
    const contract = await Factory.deploy(...args)
    return await contract.deployed()    
}

const connectContract=async (contractName,address)=>{
    const {abi}=getContractData(contractName)
    return new ethers.Contract(address, abi, wallet);
}


//----------------------------------------------------------------------

if(options.deploy){

console.log('deploy...')    


if(!options.nextfile){
    console.log('!options.nextfile');
    process.exit(1);
}

const {next,nonce} = JSON.parse(fs.readFileSync(options.nextfile).toString());
console.log('nextfile: n',next.length,'nonce',nonce)
if(!next){
    console.log('nextfile parse / read error');
    process.exit(1);
}

const addrs=[];
for(var w of next){
    addrs.push('0x'+w.address);
}

let ln=options.n;
let th=options.th || ln;

if(next.length!=ln){
    console.log('next.length!=ln',next.length,ln)
    process.exit(1)
}

console.log(addrs,ln,th)



//const contractName='OTSMSW2'
const contract = await deployContract(contractName,[addrs,th,ln]);

const chainInfo=await contract.getChainInfo()
const chainid=chainInfo[0].toHexString();

let contracts;

try{
    contracts=JSON.parse(fs.readFileSync(options.addrfile).toString());
}catch(e){contracts={}}


console.log('contract.address',contract.address)
if(!contracts[contractName]) contracts[contractName]={}
contracts[contractName][network]={address:contract.address,chainid,n:ln,th}

fs.writeFileSync(options.addrfile,JSON.stringify(contracts,null,2));   


process.exit(0);

} // deploy
//----------------------------------------------------------------------

var contracts;
try{
    contracts=JSON.parse(fs.readFileSync(options.addrfile).toString());
}catch(e){
    console.log('contracts parse / read error',options.addrfile);
    process.exit(0);    
}

const contractInfo = contracts[contractName][network];

//----------------------------------------------------------------------

if(options.read){

console.log('read...')


console.log('walletAddress',walletAddress, 
    ethers.utils.formatEther(await provider.getBalance(walletAddress)))


//var contracts;

//try{
//    contracts=JSON.parse(fs.readFileSync(options.addrfile).toString());
//}catch(e){contracts={}}


//const contractName='OTSMSW2'
//const contractInfo = contracts[contractName][network];

console.log('contractInfo',contractInfo); 
console.log('contract balance',ethers.utils.formatEther(await provider.getBalance(contractInfo.address)))

const contract = await connectContract(contractName,contractInfo.address);
console.log('th',await contract.getTh());
console.log('ln',await contract.getLn());
const nonce = await contract.getNonce();
console.log('nonce',nonce);
const chainInfo=await contract.getChainInfo()
const chainId=chainInfo[0].toHexString();
console.log('chainId',chainId);
console.log('block.timestamp',chainInfo[1].toString());

//function transferHash(address[] memory next, uint256 value, address to,
//    uint32 nonce) public view returns(bytes32){
//    return keccak256(abi.encode(address(this),next,value,to,nonce,block.chainid));
const nextFile = JSON.parse(fs.readFileSync(options.nextfile).toString());
console.log(options.nextfile,'length',nextFile.next.length,'nonce',nextFile.nonce);

const addrs=[];
for(var w of nextFile.next){
    addrs.push('0x'+w.address);
}

const value=ethers.utils.parseEther("0.01")

console.log('transferHash',
    await contract.transferHash(addrs,value,walletAddress,nonce));

// abi.encode(address(this),next,value,to,nonce,block.chainid)
console.log('transferHash',
    ethers.utils.keccak256( ethers.utils.defaultAbiCoder.encode(
        ["address","address[]", "uint256","address","uint32","uint"], 
        [contract.address,addrs,value,walletAddress,nonce,chainId]))
)

process.exit(0);

} // read    



const prevFile = (JSON.parse(fs.readFileSync(options.prevfile).toString()));
const prevAddrs=[];for(var w of prevFile.next){prevAddrs.push('0x'+w.address);}

const nextFile = (JSON.parse(fs.readFileSync(options.nextfile).toString()));
const nextAddrs=[];for(var w of nextFile.next){nextAddrs.push('0x'+w.address);}

//----------------------------------------------------------------------
if(options.sign){
    console.log('offline sign...')
    
    
    if(!options.value){
        console.log('!options.value');
        process.exit(0);
    }
    
    if(!options.to){
        console.log('!options.to');
        process.exit(0);
    }
    
    
    const value=ethers.utils.parseEther(options.value)
    const to=options.to
    
    
    const sig=[]
    const addr=[]
    
    const hash = ethers.utils.keccak256( ethers.utils.defaultAbiCoder.encode(
        ["address","address[]", "uint256[]","address[]","uint32","uint"], 
        [contractInfo.address,nextAddrs,[value],[to],prevFile.nonce,contractInfo.chainid]))
    
    for(var a of prevFile.next){
        w = await ethers.Wallet.fromEncryptedJson(JSON.stringify(a),pwd);
        addr.push(w.address);
        w = w.connect(provider);
        const s = await w.signMessage(ethers.utils.arrayify(hash));
        sig.push(s);
    }
    
    const sigFile = {sig, addr, nonce:prevFile.nonce, to, value:options.value, contract:contractInfo}
    
    fs.writeFileSync(options.sigfile,JSON.stringify(sigFile,null,2));   
    
    process.exit(0);
    }
    
//-------------------------------------------------------------------


if(options.transfer){
console.log('transfer...')

var sigFile;
try{ 
    sigFile=JSON.parse(fs.readFileSync(options.sigfile).toString());
}catch(e){
    console.log('sigfile error');
    process.exit(0);
}

const value= ethers.utils.parseEther(sigFile.value)
const to= sigFile.to

const contract = await connectContract(contractName,contractInfo.address);
console.log('contract.address',contract.address,
    ethers.utils.formatEther(await provider.getBalance(contract.address)))

const nonce = await contract.getNonce();
const chainInfo=await contract.getChainInfo();
const chainId=chainInfo[0].toHexString();
const blockTimestamp=chainInfo[1].toString();

console.log('th',await contract.getTh(),'ln',await contract.getLn(),'nonce',nonce,
    'chainId',chainId,'block.timestamp',blockTimestamp);

if(sigFile.nonce!=nonce){
    console.log('sigFile.nonce!=nonce')
    process.exit(1)
}

//function transferTest(bytes[] memory sig, address[] memory next, uint256 value, address to,
//    uint32 nonce) public view returns(bool){        

const tx = await contract.transfer(sigFile.sig,nextAddrs,[value],[to],nonce);
const tx_rec = await tx.wait();
console.log(tx_rec.transactionHash,tx_rec.gasUsed.toNumber());

console.log('contract.address',contract.address,
    ethers.utils.formatEther(await provider.getBalance(contract.address)))

console.log('to',to,
    ethers.utils.formatEther(await provider.getBalance(to)))

process.exit(0)
} // transfer

console.log('WTF!??')

})()
