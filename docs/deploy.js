/** @import {} from "../global.d.ts" */
import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.2/ethers.min.js' // https://docs.ethers.org/v6/getting-started
    ;
(() => {
    // HL lib
    const Hyperliquid = {
        math: {
            floatToWeiBig(num, weiDecimals) {
                return BigInt(Math.floor(num * 10 ** weiDecimals))
            },
            roundWeiDecimals(weiBig, weiDiffBig) {
                const pow = 10n ** weiDiffBig
                return (weiBig / pow) * pow
            },
            roundWeiSigfig(weiBig, sigFig) {
                // breaks with negatives
                const weiStr = weiBig.toString()
                const weiStrRounded = weiStr.slice(0, sigFig) + '0'.repeat(Math.max(0, weiStr.length - sigFig))
                return BigInt(weiStrRounded)
            },
            weiBigToString(weiBig, weiDecimals) {
                // weiDecimals == 0 ? intString : floatString
                const weiStr = weiBig.toString()
                if (weiDecimals === 0) return weiStr
                let floatStr
                if (weiStr.length > weiDecimals) {
                    const dp = weiStr.length - weiDecimals
                    floatStr = weiStr.slice(0, dp) + '.' + weiStr.slice(dp)
                } else {
                    floatStr = '0.' + weiStr.padStart(weiDecimals, '0')
                }
                floatStr = floatStr.replace(/0+$/, '')
                if (floatStr.slice(-1) == '.') floatStr = floatStr.slice(0, -1)
                return floatStr
            },
            priceToOrderString(price, szDecimals) { // https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
                // sigFig = 5
                // wei = 8
                // decimals = MAX_DECIMALS - szDecimals // spot = 8, perps = 6

                const weiDecimals = 8  // spot only
                let weiBig = Hyperliquid.math.floatToWeiBig(price, weiDecimals)
                weiBig = Hyperliquid.math.roundWeiDecimals(weiBig, BigInt(szDecimals))
                weiBig = Hyperliquid.math.roundWeiSigfig(weiBig, 5)
                return Hyperliquid.math.weiBigToString(weiBig, weiDecimals)
            },
            sizeToOrderString(size, szDecimals) {
                // sigFig = inf
                // wei = weiDecimals // 5 6 7 8
                // decimals = szDecimals // 0 1 2

                const weiBig = Hyperliquid.math.floatToWeiBig(size, szDecimals)
                return Hyperliquid.math.weiBigToString(weiBig, szDecimals)
            },
        },
        actions: {
            orderLimit({ asset, isBid, price, size, isReduce, tif }) { // , cloid
                return {
                    a: asset,
                    b: isBid,
                    p: price,
                    s: size,
                    r: isReduce,
                    t: { limit: { tif } },
                    // ...(cloid !== undefined && { c: cloid }),
                }
            },
            actionOrder({ orders }) {
                return { type: 'order', orders, grouping: 'na' }
            },
            cancelCloid({ asset, cloid }) {
                return { asset, cloid }
            },
            actionCancelCloid({ cancels }) {
                return { type: 'cancelByCloid', cancels }
            },
            actionSetReferrer({ code }) { // Enter Code
                return { type: 'setReferrer', code }
            },
            actionSpotClearinghouseState({ user }) {
                return { type: 'spotClearinghouseState', user }
            },
            actionApproveAgent({ agentAddress, agentName, nonce }) {
                return {
                    type: 'approveAgent',
                    hyperliquidChain: IS_MAINNET ? 'Mainnet' : 'Testnet',
                    signatureChainId: chainIdHexHL(IS_MAINNET),
                    agentAddress,
                    agentName,
                    nonce,
                }
            },
            info: {
                spotMeta({ }) {
                    return { type: 'spotMeta' }
                },
                spotClearinghouseState({ user }) {
                    return { type: 'spotClearinghouseState', user }
                },
                historicalOrders({ user }) {
                    return {
                        type: 'historicalOrders',
                        user,
                    }
                },
                referral({ user }) {
                    return {
                        type: 'referral',
                        user,
                    }
                },
                userRateLimit({ user }) {
                    return {
                        type: 'userRateLimit',
                        user,
                    }
                },
                spotDeployState({ user }) {
                    return {
                        type: 'spotDeployState',
                        user,
                    }
                },
            },
            spotDeploy: {
                registerToken({ name, szDecimals, weiDecimals, maxGasE6, fullName }) {
                    const registerToken2 = {
                        spec: {
                            name,
                            szDecimals,
                            weiDecimals,
                        },
                        maxGas: maxGasE6,
                    }
                    if (fullName !== undefined) registerToken2['fullName'] = fullName
                    return {
                        type: 'spotDeploy',
                        registerToken2,
                    }
                },
                userGenesisAction({ token, user, anchor }) {
                    return {
                        type: 'spotDeploy',
                        userGenesis: {
                            token,
                            userAndWei: user,
                            existingTokenAndWei: anchor,
                        },
                    }
                },
                registerSpotAction({ baseToken, quoteToken }) {
                    return {
                        type: 'spotDeploy',
                        registerSpot: {
                            tokens: [
                                baseToken,
                                quoteToken,
                            ],
                        },
                    }
                },
                genesisAction({ token, maxSupply }) {
                    return {
                        type: 'spotDeploy',
                        genesis: {
                            token,
                            maxSupply,
                        },
                    }
                },
                registerHyperliquidityAction({ spot, startPx, orderSz, nOrders, nSeededLevels }) {
                    const registerHyperliquidity = {
                        spot,
                        startPx,
                        orderSz,
                        nOrders,
                    }
                    if (nSeededLevels !== undefined) registerHyperliquidity['nSeededLevels'] = nSeededLevels
                    return {
                        type: 'spotDeploy',
                        registerHyperliquidity,
                    }
                },
            },
        },
        signing: {
            phantomDomain(chainId) {
                return {
                    name: 'Exchange',
                    version: '1',
                    chainId,
                    verifyingContract: '0x0000000000000000000000000000000000000000',
                }
            },
            AGENT_TYPES: {
                Agent: [
                    { name: 'source', type: 'string' },
                    { name: 'connectionId', type: 'bytes32' },
                ],
            },
            actionHash({ activePool, action, nonce }) {
                const msgPackBytes = MessagePack.encode(action)
                const data = new Uint8Array(msgPackBytes.length + (activePool === undefined ? 9 : 29))
                data.set(msgPackBytes)

                const view = new DataView(data.buffer)
                view.setBigUint64(msgPackBytes.length, BigInt(nonce), false)

                if (activePool === undefined) {
                    view.setUint8(msgPackBytes.length + 8, 0)
                } else {
                    view.setUint8(msgPackBytes.length + 8, 1)
                    data.set(ethers.getBytes(activePool), msgPackBytes.length + 9)
                }
                return ethers.keccak256(data)
            },
            async signInnerAsync({ wallet, message, chainId }) {
                const { r, s, v } = ethers.Signature.from(await wallet.signTypedData(
                    Hyperliquid.signing.phantomDomain(chainId),
                    Hyperliquid.signing.AGENT_TYPES,
                    message,
                ))
                return { r, s, v }
            },
            async signL1ActionAsync({ isMainnet, wallet, activePool, action, nonce, chainId = 1337 }) {
                return await Hyperliquid.signing.signInnerAsync({
                    wallet,
                    message: {
                        source: isMainnet ? 'a' : 'b',
                        connectionId: Hyperliquid.signing.actionHash({ activePool, action, nonce }),
                    },
                    chainId,
                })
            },
            async signWalletL1ActionAsync({ isMainnet, wallet, action }) {
                const { r, s, v } = ethers.Signature.from(await window.ethereum.request({
                    method: 'eth_signTypedData_v4',
                    params: [
                        wallet.address,
                        JSON.stringify({
                            types: {
                                "EIP712Domain": [
                                    {
                                        "name": "name",
                                        "type": "string"
                                    },
                                    {
                                        "name": "version",
                                        "type": "string"
                                    },
                                    {
                                        "name": "chainId",
                                        "type": "uint256"
                                    },
                                    {
                                        "name": "verifyingContract",
                                        "type": "address"
                                    }
                                ],
                                "HyperliquidTransaction:ApproveAgent": [
                                    {
                                        "name": "hyperliquidChain",
                                        "type": "string"
                                    },
                                    {
                                        "name": "agentAddress",
                                        "type": "address"
                                    },
                                    {
                                        "name": "agentName",
                                        "type": "string"
                                    },
                                    {
                                        "name": "nonce",
                                        "type": "uint64"
                                    }
                                ]
                            },
                            domain: {
                                "name": "HyperliquidSignTransaction",
                                "version": "1",
                                chainId: CHAIN_IDS[IS_MAINNET],
                                "verifyingContract": "0x0000000000000000000000000000000000000000"
                            },
                            primaryType: 'HyperliquidTransaction:ApproveAgent',
                            message: action,
                        })
                    ],
                }))
                return { r, s, v }
            },
        },
        requests: {
            async payloadExchangeAsync({ isMainnet, wallet, subaccount, action, nonce, chainId = 1337 }) {
                const signature = await Hyperliquid.signing.signL1ActionAsync({ isMainnet, wallet, activePool: subaccount, action, nonce, chainId })
                return { action, nonce, signature, vaultAddress: subaccount }
            },
            async payloadExchangeWalletAsync({ isMainnet, wallet, action, nonce }) {
                const signature = await Hyperliquid.signing.signWalletL1ActionAsync({ isMainnet, wallet, action })
                return { action, nonce, signature }
            },
            wsMsg({ id, type, payload }) {
                return JSON.stringify({ method: 'post', id, request: { type, payload } })
            },
            async postAsync({ url, endpoint, payload }) {
                return await fetch(url + endpoint, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }).then(response => {
                    if (response.ok) {
                        return response.json()
                    } else {
                        throw new Error("HTTP error")
                    }
                })
            },
            async postInfoAsync({ url, payload }) {
                return await Hyperliquid.requests.postAsync({ url, endpoint: '/info', payload })
            },
            async postExchangeAsync({ url, payload }) {
                return await Hyperliquid.requests.postAsync({ url, endpoint: '/exchange', payload })
            },
        }
    }
    // connect buttons and elements
    // global var
    var IS_MAINNET = false

    const tokenId = IS_MAINNET ? 48 : 999
    const tokenCZ = IS_MAINNET ? 17 : 2
    const tokenFUN = IS_MAINNET ? 21 : 4

    const URLS = {
        false: 'https://api.hyperliquid-testnet.xyz',
        true: 'https://api.hyperliquid.xyz',
    }
    const URIS = {
        false: 'wss://api.hyperliquid-testnet.xyz/ws',
        true: 'wss://api.hyperliquid.xyz/ws',
    }

    const CHAIN_IDS = {
        false: 421614,
        true: 42161,
    }

    function chainIdHex(chainId) { return `0x${chainId.toString(16)}` }
    function chainIdHexHL(isMainnet) { return chainIdHex(CHAIN_IDS[IS_MAINNET]) }

    async function walletConnect(chainId) {
        const addresses = await window.ethereum.request({ method: 'eth_requestAccounts' })
        if (window.ethereum.networkVersion !== chainId) await switchChain(chainId)
        return addresses
    }

    async function switchChain(chainId) {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex(chainId) }],
        })
    }

    let agentWallet = undefined

    async function getDeploy(address) {
        try {
            if (address.length !== 42 || !address.match(/^0x[0-9a-f]+$/i)) throw 'Error: Invalid address'

            const payload = Hyperliquid.actions.info.spotDeployState({ user: address })
            const resp = await Hyperliquid.requests.postInfoAsync({ url: URLS[IS_MAINNET], payload })
            let deployState = ''
            let state = resp.states[0]
            if (state) {
                deployState = `Name:\t\t\t${state.spec.name}
Full Name:\t\t${state.fullName}
Index:\t\t\t${state.token}
Size Decimals:\t\t${state.spec.szDecimals}
Wei Decimals:\t\t${state.spec.weiDecimals}

User Genesis:
${state.userGenesisBalances.reduce((s, c) => s + `${c[0]}: ${c[1]}\n`, '')}
Token Genesis:
${state.existingTokenGenesisBalances.reduce((s, c) => s + `${c[0]}: ${c[1]}\n`, '')}
Total Genesis Wei:\t${state.totalGenesisBalanceWei}

Spots:\t\t\t${state.spots}
HIP2:\t\t\t${state.hyperliquidityGenesisBalance}
Max Supply:\t\t${state.maxSupply}
`
            }
            elements.test.other.infoDisplay.element.value = `Address:\t\t${address}

Deployment
${deployState}

Auction Info
Start Time:\t${new Date(resp.gasAuction.startTimeSeconds * 1000).toISOString()}
Hours:\t\t${resp.gasAuction.durationSeconds / 3600}
Start Gas:\t${resp.gasAuction.startGas}
Current Gas:\t${resp.gasAuction.currentGas}
End Gas:\t${resp.gasAuction.endGas}
`
        } catch (e) {
            elements.test.other.infoDisplay.element.value = `${e}`
        }
    }

    const elements = {
        test: {
            button: {
                connect: {
                    async click(e) {
                        this.disabled = true
                        elements.test.other.infoDisplay.element.disabled = true
                        try {
                            elements.test.other.resultDisplay.element.value = 'Connecting...'
                            const address = (await walletConnect(CHAIN_IDS[IS_MAINNET]))[0]

                            getDeploy(address)

                            agentWallet = ethers.Wallet.createRandom()
                            const agentAddress = agentWallet.address.toLowerCase()

                            const nonce = Date.now()
                            const resp = await Hyperliquid.requests.postExchangeAsync({
                                url: URLS[IS_MAINNET],
                                payload: await Hyperliquid.requests.payloadExchangeWalletAsync({
                                    isMainnet: IS_MAINNET,
                                    wallet: { address },
                                    action: Hyperliquid.actions.actionApproveAgent({
                                        agentAddress,
                                        agentName: `Wash Deploy valid_until ${Date.now() + 24 * 60 * 60 * 1000}`,
                                        nonce,
                                    }),
                                    nonce,
                                }),
                            })
                            elements.test.other.resultDisplay.element.value = JSON.stringify(resp, null, 2)
                        } catch (e) {
                            elements.test.other.resultDisplay.element.value = 'Failed to connect'
                        }
                        elements.test.other.infoDisplay.element.disabled = false
                        this.disabled = false
                    },
                },
                testButton1: {
                    async click(e) {
                        this.disabled = true
                        elements.test.other.infoDisplay.element.disabled = true
                        try {
                            elements.test.other.resultDisplay.element.value = 'Executing...'
                            if (agentWallet === undefined) {
                                elements.test.other.resultDisplay.element.value = 'Connection not established'
                                return
                            }
                            const wei = elements.test.input.testInput1.element.value

                            const address = (await walletConnect(CHAIN_IDS[IS_MAINNET]))[0]

                            const resp = await Hyperliquid.requests.postExchangeAsync({
                                url: URLS[IS_MAINNET],
                                payload: await Hyperliquid.requests.payloadExchangeAsync({
                                    isMainnet: IS_MAINNET,
                                    wallet: agentWallet,
                                    action: Hyperliquid.actions.spotDeploy.userGenesisAction({ token: tokenId, user: [], anchor: [[tokenCZ, wei]] }),
                                    nonce: Date.now(),
                                }),
                            })
                            console.log(resp)
                            elements.test.other.resultDisplay.element.value = JSON.stringify(resp, null, 2)

                            getDeploy(address)
                        } catch (e) {
                            elements.test.other.resultDisplay.element.value = 'Failed to set'
                        }
                        elements.test.other.infoDisplay.element.disabled = false
                        this.disabled = false
                    }
                },
                testButton2: {
                    async click(e) {
                        this.disabled = true
                        elements.test.other.infoDisplay.element.disabled = true
                        try {
                            elements.test.other.resultDisplay.element.value = 'Executing...'
                            if (agentWallet === undefined) {
                                elements.test.other.resultDisplay.element.value = 'Connection not established'
                                return
                            }
                            const wei = elements.test.input.testInput1.element.value

                            const address = (await walletConnect(CHAIN_IDS[IS_MAINNET]))[0]

                            const resp = await Hyperliquid.requests.postExchangeAsync({
                                url: URLS[IS_MAINNET],
                                payload: await Hyperliquid.requests.payloadExchangeAsync({
                                    isMainnet: IS_MAINNET,
                                    wallet: agentWallet,
                                    action: Hyperliquid.actions.spotDeploy.userGenesisAction({ token: tokenId, user: [], anchor: [[tokenFUN, wei]] }),
                                    nonce: Date.now(),
                                }),
                            })
                            console.log(resp)
                            elements.test.other.resultDisplay.element.value = JSON.stringify(resp, null, 2)

                            getDeploy(address)
                        } catch (e) {
                            elements.test.other.resultDisplay.element.value = 'Failed to set'
                        }
                        elements.test.other.infoDisplay.element.disabled = false
                        this.disabled = false
                    }
                },
                testButton3: {
                }
            },
            input: {
                testInput1: {}
            },
            other: {
                resultDisplay: {},
                infoDisplay: {},
            },
        },
    }

    for (let step in elements) {
        for (let tag in elements[step]) {
            for (let id in elements[step][tag]) {
                const o = elements[step][tag][id]
                o.element = document.getElementById(id)
                if (tag === 'button') o.element.addEventListener('click', o.click)
            }
        }
    }
})()
