import { log } from 'console'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('RuneTokenFactory and RuneCrossChainToken Test', function () {
    const eidA = 1 //40245 // Base Sepolia
    const eidB = 2 //40106 // Avalanche Fuji

    let RuneTokenFactory: ContractFactory
    let RuneCrossChainToken: ContractFactory
    let EndpointV2Mock: ContractFactory
    let owner: SignerWithAddress
    let userA: SignerWithAddress
    let userB: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let factoryA: Contract
    let factoryB: Contract
    let runeTokenA: Contract
    let runeTokenB: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract

    before(async function () {
        RuneTokenFactory = await ethers.getContractFactory('RuneTokenFactory')
        RuneCrossChainToken = await ethers.getContractFactory('RuneCrossChainToken')

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

        // Deploy RuneTokenFactories
        factoryA = await RuneTokenFactory.deploy(mockEndpointV2A.address)
        factoryB = await RuneTokenFactory.deploy(mockEndpointV2B.address)

        // Deploy RuneCrossChainToken contracts using the factories
        const runeMetadataA = {
            runeId: ethers.utils.formatBytes32String('RuneA'),
            runeOwner: 'TaprootAddressA',
            bagAmount: ethers.utils.parseEther('100'),
        }
        const runeMetadataB = {
            runeId: ethers.utils.formatBytes32String('RuneB'),
            runeOwner: 'TaprootAddressB',
            bagAmount: ethers.utils.parseEther('100'),
        }

        await factoryA.deployRuneToken(
            'TokenA',
            'TA',
            eidA,
            runeMetadataA.runeId,
            runeMetadataA.runeOwner,
            runeMetadataA.bagAmount
        )
        await factoryB.deployRuneToken(
            'TokenB',
            'TB',
            eidB,
            runeMetadataB.runeId,
            runeMetadataB.runeOwner,
            runeMetadataB.bagAmount
        )

        const runeTokenAAddress = await factoryA.getOFTAddress('TokenA', 'TA', eidA)
        const runeTokenBAddress = await factoryB.getOFTAddress('TokenB', 'TB', eidB)

        // Attach to the deployed RuneCrossChainTokens
        runeTokenA = await RuneCrossChainToken.attach(runeTokenAAddress)
        runeTokenB = await RuneCrossChainToken.attach(runeTokenBAddress)

        // Transfer ownership of the RuneCrossChainTokens to the owner account
        await factoryA.transferOFTOwnership(runeTokenAAddress, owner.address)
        await factoryB.transferOFTOwnership(runeTokenBAddress, owner.address)

        // Set peers for both RuneCrossChainTokens
        await runeTokenA.connect(owner).setPeer(eidB, ethers.utils.zeroPad(runeTokenBAddress, 32))
        await runeTokenB.connect(owner).setPeer(eidA, ethers.utils.zeroPad(runeTokenAAddress, 32))

        // Optionally, verify the peers are set correctly
        const peerAtoB = await runeTokenA.peers(eidB)
        const peerBtoA = await runeTokenB.peers(eidA)
        log('Peer for runeTokenA:', peerAtoB)
        log('Peer for runeTokenB:', peerBtoA)

        // Set up mock endpoints
        await mockEndpointV2A.setDestLzEndpoint(runeTokenB.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(runeTokenA.address, mockEndpointV2A.address)
    })

    it('should deploy RuneCrossChainTokens through factories and transfer tokens cross-chain', async function () {
        const initialAmount = ethers.utils.parseEther('100')
        await runeTokenA.mint(userA.address, initialAmount)

        const initialBalanceA = await runeTokenA.balanceOf(userA.address)
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

        const [nativeFee, zroFee] = await runeTokenA.quoteSend(sendParam, false)
        log('Native fee:', ethers.utils.formatEther(nativeFee))
        log('ZRO fee:', ethers.utils.formatEther(zroFee))

        const tx = await runeTokenA.connect(userA).send(sendParam, [nativeFee, 0], userA.address, { value: nativeFee })
        const receipt = await tx.wait()
        log('Transfer transaction status:', receipt.status)
        expect(receipt.status).eql(1, 'Transfer transaction failed')

        const finalBalanceA = await runeTokenA.balanceOf(userA.address)
        const finalBalanceB = await runeTokenB.balanceOf(userB.address)

        log('Initial amount:', ethers.utils.formatEther(initialAmount))
        log('Tokens sent:', ethers.utils.formatEther(tokensToSend))
        log('Final balance user A:', ethers.utils.formatEther(finalBalanceA))
        log('Final balance user B:', ethers.utils.formatEther(finalBalanceB))

        expect(finalBalanceA).eql(initialAmount.sub(tokensToSend), 'Balance A mismatch')
        expect(finalBalanceB).eql(tokensToSend, 'Balance B mismatch')
    })

    it('should correctly store and retrieve Rune metadata', async function () {
        const metadataA = await runeTokenA.getRuneMetadata()
        const metadataB = await runeTokenB.getRuneMetadata()

        expect(ethers.utils.parseBytes32String(metadataA.runeId)).eql('RuneA', 'Rune ID A mismatch')
        expect(metadataA.runeOwner).eql('TaprootAddressA', 'Rune owner A mismatch')
        expect(metadataA.bagAmount).eql(ethers.utils.parseEther('100'), 'Bag amount A mismatch')

        expect(ethers.utils.parseBytes32String(metadataB.runeId)).eql('RuneB', 'Rune ID B mismatch')
        expect(metadataB.runeOwner).eql('TaprootAddressB', 'Rune owner B mismatch')
        expect(metadataB.bagAmount).eql(ethers.utils.parseEther('100'), 'Bag amount B mismatch')
    })
})
