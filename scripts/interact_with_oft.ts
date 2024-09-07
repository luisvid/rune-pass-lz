import * as dotenv from 'dotenv'
import { ethers } from 'ethers'

import { Options } from '@layerzerolabs/lz-v2-utilities'

dotenv.config()

import MyOFTArtifact from '../artifacts/contracts/MyOFT.sol/MyOFT.json'
import OFTFactoryArtifact from '../artifacts/contracts/OFTFactory.sol/OFTFactory.json'

// Ensure the ABI is correctly typed
const MyOFT_abi = MyOFTArtifact.abi as ethers.ContractInterface
const OFTFactory_abi = OFTFactoryArtifact.abi as ethers.ContractInterface

const FUJI_RPC = 'https://rpc.ankr.com/avalanche_fuji'
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

// Deployed contract: OFTFactory, network: base-sepolia, address:      0x73a453b9b703877A680F1a5b95757478BaA412f0
// Deployed contract: OFTFactory, network: avalanche-testnet, address: 0x73a453b9b703877A680F1a5b95757478BaA412f0
// Deployed contract: OFTFactory, network: sepolia-testnet, address:   0xf0FF48Db55491fcdeF32B024b10e1bD2F4A0F95B

const FUJI_FACTORY_ADDRESS = '0x73a453b9b703877A680F1a5b95757478BaA412f0'
const BASE_SEPOLIA_FACTORY_ADDRESS = '0x73a453b9b703877A680F1a5b95757478BaA412f0'

const FUJI_EID = 40106
const BASE_SEPOLIA_EID = 40245

async function main() {
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) throw new Error('Private key not found in .env file')

    const fujiProvider = new ethers.providers.JsonRpcProvider(FUJI_RPC)
    const baseSepoliaProvider = new ethers.providers.JsonRpcProvider(BASE_SEPOLIA_RPC)

    const fujiWallet = new ethers.Wallet(privateKey, fujiProvider)
    const baseSepoliaWallet = new ethers.Wallet(privateKey, baseSepoliaProvider)

    const fujiFactory = new ethers.Contract(FUJI_FACTORY_ADDRESS, OFTFactory_abi, fujiWallet)
    const baseSepoliaFactory = new ethers.Contract(BASE_SEPOLIA_FACTORY_ADDRESS, OFTFactory_abi, baseSepoliaWallet)

    // Deploy OFTs
    console.log('Deploying OFTs...')
    await fujiFactory.deployOFT('TokenA', 'TA', FUJI_EID)
    await baseSepoliaFactory.deployOFT('TokenB', 'TB', BASE_SEPOLIA_EID)

    // wait for the transactions to be mined
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const oftAAddress = await fujiFactory.getOFTAddress('TokenA', 'TA', FUJI_EID)
    const oftBAddress = await baseSepoliaFactory.getOFTAddress('TokenB', 'TB', BASE_SEPOLIA_EID)

    console.log('OFT A (Fuji) deployed at:', oftAAddress)
    console.log('OFT B (BaseSep) deployed at:', oftBAddress)

    const oftA = new ethers.Contract(oftAAddress, MyOFT_abi, fujiWallet)
    const oftB = new ethers.Contract(oftBAddress, MyOFT_abi, baseSepoliaWallet)

    // Transfer ownership and set peers
    console.log('Configuring OFTs...')
    await fujiFactory.transferOFTOwnership(oftAAddress, fujiWallet.address)
    await baseSepoliaFactory.transferOFTOwnership(oftBAddress, baseSepoliaWallet.address)

    await oftA.setPeer(BASE_SEPOLIA_EID, ethers.utils.zeroPad(oftBAddress, 32))
    await oftB.setPeer(FUJI_EID, ethers.utils.zeroPad(oftAAddress, 32))

    // Mint tokens
    const initialAmount = ethers.utils.parseEther('100')
    await oftA.mint(fujiWallet.address, initialAmount)

    console.log('Initial balance:', ethers.utils.formatEther(await oftA.balanceOf(fujiWallet.address)))

    // Prepare cross-chain transfer
    const tokensToSend = ethers.utils.parseEther('10')
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

    const sendParam = [
        BASE_SEPOLIA_EID,
        ethers.utils.zeroPad(baseSepoliaWallet.address, 32),
        tokensToSend,
        tokensToSend,
        options,
        '0x',
        '0x',
    ]

    // Quote and send
    const [nativeFee] = await oftA.quoteSend(sendParam, false)
    console.log('Native fee:', ethers.utils.formatEther(nativeFee))

    console.log('Sending tokens cross-chain...')
    const tx = await oftA.send(sendParam, [nativeFee, 0], fujiWallet.address, { value: nativeFee })

    // Log the transaction hash
    console.log('Transaction hash:', tx.hash)

    // Wait for the transaction to be mined
    const receipt = await tx.wait()
    console.log('Transaction mined. Block number:', receipt.blockNumber)

    // Check final balances
    const finalBalanceA = await oftA.balanceOf(fujiWallet.address)
    const finalBalanceB = await oftB.balanceOf(baseSepoliaWallet.address)

    console.log('Final balance on Fuji:', ethers.utils.formatEther(finalBalanceA))
    console.log('Final balance on Base Sepolia:', ethers.utils.formatEther(finalBalanceB))
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
