import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

// https://docs.layerzero.network/v2/developers/evm/create-lz-oapp/project-config

const sepoliaContract: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'MyOFT',
}

const fujiContract: OmniPointHardhat = {
    eid: EndpointId.AVALANCHE_V2_TESTNET,
    contractName: 'MyOFT',
}

const basesepContract: OmniPointHardhat = {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: 'MyOFT',
}

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: fujiContract,
        },
        {
            contract: sepoliaContract,
        },
        {
            contract: basesepContract,
        },
    ],
    connections: [
        {
            from: fujiContract,
            to: sepoliaContract,
        },
        {
            from: fujiContract,
            to: basesepContract,
        },
        {
            from: sepoliaContract,
            to: fujiContract,
        },
        {
            from: sepoliaContract,
            to: basesepContract,
        },
        {
            from: basesepContract,
            to: sepoliaContract,
        },
        {
            from: basesepContract,
            to: fujiContract,
        },
    ],
}

export default config
