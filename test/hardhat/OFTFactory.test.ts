import { log } from 'console'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('OFTFactory and MyOFT Test', function () {
    const eidA = 1 //40245 // Base Sepolia
    const eidB = 2 //40106 // Avalanche Fuji

    let OFTFactory: ContractFactory
    let MyOFT: ContractFactory
    let EndpointV2Mock: ContractFactory
    let owner: SignerWithAddress
    let userA: SignerWithAddress
    let userB: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let factoryA: Contract
    let factoryB: Contract
    let myOFTA: Contract
    let myOFTB: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract

    before(async function () {
        OFTFactory = await ethers.getContractFactory('OFTFactory')
        MyOFT = await ethers.getContractFactory('MyOFT')

        const signers = await ethers.getSigners()
        owner = signers[0]
        userA = signers[1]
        userB = signers[2]
        endpointOwner = signers[3]

        const EndpointV2MockArtifact = await deployments.getArtifact('EndpointV2Mock')
        EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, endpointOwner)
    })

    beforeEach(async function () {
        // Deploy mock LZEndpoints
        mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
        mockEndpointV2B = await EndpointV2Mock.deploy(eidB)

        // Deploy OFTFactories
        factoryA = await OFTFactory.deploy(mockEndpointV2A.address)
        factoryB = await OFTFactory.deploy(mockEndpointV2B.address)

        // Deploy MyOFT contracts using the factories
        await factoryA.deployOFT('TokenA', 'TA', eidA)
        await factoryB.deployOFT('TokenB', 'TB', eidB)

        const oftAAddress = await factoryA.getOFTAddress('TokenA', 'TA', eidA)
        const oftBAddress = await factoryB.getOFTAddress('TokenB', 'TB', eidB)

        // Attach to the deployed OFTs
        myOFTA = await MyOFT.attach(oftAAddress)
        myOFTB = await MyOFT.attach(oftBAddress)

        // Set peers for both OFTs through the factories
        await factoryA.transferOFTOwnership(oftAAddress, owner.address)
        await factoryB.transferOFTOwnership(oftBAddress, owner.address)

        await myOFTA.connect(owner).setPeer(eidB, ethers.utils.zeroPad(oftBAddress, 32))
        await myOFTB.connect(owner).setPeer(eidA, ethers.utils.zeroPad(oftAAddress, 32))

        // Optionally, verify the peers are set correctly
        const peerAtoB = await myOFTA.peers(eidB)
        const peerBtoA = await myOFTB.peers(eidA)
        log('Peer for myOFTA:', peerAtoB)
        log('Peer for myOFTB:', peerBtoA)

        // Set up mock endpoints
        await mockEndpointV2A.setDestLzEndpoint(myOFTB.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(myOFTA.address, mockEndpointV2A.address)
    })

    it('should deploy OFTs through factories and transfer tokens cross-chain', async function () {
        const initialAmount = ethers.utils.parseEther('100')
        await myOFTA.mint(userA.address, initialAmount)

        const initialBalanceA = await myOFTA.balanceOf(userA.address)
        log('Initial balance user A after minting:', ethers.utils.formatEther(initialBalanceA))
        expect(initialBalanceA).eql(initialAmount, 'Initial balance mismatch')

        const tokensToSend = ethers.utils.parseEther('10')

        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

        const sendParam = [
            eidB,
            ethers.utils.zeroPad(userB.address, 32),
            tokensToSend,
            tokensToSend,
            options,
            '0x',
            '0x',
        ]

        const [nativeFee, zroFee] = await myOFTA.quoteSend(sendParam, false)
        log('Native fee:', ethers.utils.formatEther(nativeFee))
        log('ZRO fee:', ethers.utils.formatEther(zroFee))

        const tx = await myOFTA.connect(userA).send(sendParam, [nativeFee, 0], userA.address, { value: nativeFee })
        const receipt = await tx.wait()
        log('Transfer transaction status:', receipt.status)
        expect(receipt.status).eql(1, 'Transfer transaction failed')

        // await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay

        const finalBalanceA = await myOFTA.balanceOf(userA.address)
        const finalBalanceB = await myOFTB.balanceOf(userB.address)

        log('Initial amount:', ethers.utils.formatEther(initialAmount))
        log('Tokens sent:', ethers.utils.formatEther(tokensToSend))
        log('Final balance user A:', ethers.utils.formatEther(finalBalanceA))
        log('Final balance user B:', ethers.utils.formatEther(finalBalanceB))

        expect(finalBalanceA).eql(initialAmount.sub(tokensToSend), 'Balance A mismatch')
        expect(finalBalanceB).eql(tokensToSend, 'Balance B mismatch')
    })
})
