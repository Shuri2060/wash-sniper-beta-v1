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
                spotMetaAndAssetCtxs({ }) {
                    return { type: 'spotMetaAndAssetCtxs' }
                },
                spotClearinghouseState({ user }) {
                    return { type: 'spotClearinghouseState', user }
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
            PHANTOM_DOMAIN: {
                name: 'Exchange',
                version: '1',
                chainId: 1337,
                verifyingContract: '0x0000000000000000000000000000000000000000',
            },
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
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
            async signAsync({ signer, domain = Hyperliquid.signing.PHANTOM_DOMAIN, types = Hyperliquid.signing.AGENT_TYPES, message }) {
                const { r, s, v } = ethers.Signature.from(await signer.signTypedData(domain, types, message))
                return { r, s, v }
            },
            async signL1ActionAsync({ isMainnet, signer, activePool, action, nonce }) {
                return await Hyperliquid.signing.signAsync({
                    signer,
                    message: {
                        source: isMainnet ? 'a' : 'b',
                        connectionId: Hyperliquid.signing.actionHash({ activePool, action, nonce }),
                    },
                })
            },
            async signWalletL1ActionAsync({ isMainnet, signer, action }) {
                const { r, s, v } = ethers.Signature.from(await window.ethereum.request({
                    method: 'eth_signTypedData_v4',
                    params: [
                        signer.address,
                        JSON.stringify({
                            types: {
                                EIP712Domain: Hyperliquid.signing.EIP712Domain,
                                'HyperliquidTransaction:ApproveAgent': [
                                    {
                                        name: 'hyperliquidChain',
                                        type: 'string',
                                    },
                                    {
                                        name: 'agentAddress',
                                        type: 'address',
                                    },
                                    {
                                        name: 'agentName',
                                        type: 'string',
                                    },
                                    {
                                        name: 'nonce',
                                        type: 'uint64',
                                    }
                                ]
                            },
                            domain: {
                                name: 'HyperliquidSignTransaction',
                                version: '1',
                                chainId: CHAIN_IDS[isMainnet],
                                verifyingContract: '0x0000000000000000000000000000000000000000',
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
            async payloadExchangeAsync({ isMainnet, signer, subaccount, action, nonce }) {
                const signature = await Hyperliquid.signing.signL1ActionAsync({ isMainnet, signer, activePool: subaccount, action, nonce })
                return { action, nonce, signature, vaultAddress: subaccount }
            },
            async payloadExchangeWalletAsync({ isMainnet, signer, action, nonce }) {
                const signature = await Hyperliquid.signing.signWalletL1ActionAsync({ isMainnet, signer, action })
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

    var IS_MAINNET = false

    var idCounter = 0

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

    function burnAddress(char = '0') {
        return '0x' + char.repeat(40)
    }

    const nullAddress = burnAddress()
    const bAddress = burnAddress('b')

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

    function disableButtons(disable = true) {
        elements.tools.button.connect.element.disabled = disable
        elements.tools.button.disconnect.element.disabled = disable
        elements.tools.button.approveFees.element.disabled = disable
    }

    function frontendSize(sz) {
        function d(e) {
            let t = zn(e)
            return t.endsWith(".0") && (t = t.slice(0, -2)), t
        }
        function zn(e) {
            let t = e.toFixed(8)
            for (; t.endsWith("0") && !t.endsWith(".0");) t = t.slice(0, -1)
            return "-0.0" === t && (t = "0.0"), t
        }
        return d(sz)
    }

    let exchangeData = undefined
    let agentWallet = undefined
    let feePayload = undefined

    window.ethereum.on('accountsChanged', accounts => {
        agentWallet = undefined
        feePayload = undefined
        elements.tools.button.buyAll.element.disabled = true

        elements.tools.other.resultDisplay.element.value = 'Account changed: Disconnected. Reconnect again'
    })

    const elements = {
        tools: {
            button: {
                connect: {
                    async click(e) {
                        disableButtons(true)
                        try {
                            elements.tools.other.resultDisplay.element.value = 'Connecting...'
                            const address = (await walletConnect(CHAIN_IDS[IS_MAINNET]))[0]

                            const signer = ethers.Wallet.createRandom()
                            const agentAddress = signer.address.toLowerCase()

                            const agentName = `Wash Tools (${IS_MAINNET ? 'M' : 'T'})`
                            const nonce = Date.now()
                            const expiry = Date.now() + 6 * 60 * 60 * 1000
                            const resp = await Hyperliquid.requests.postExchangeAsync({
                                url: URLS[IS_MAINNET],
                                payload: await Hyperliquid.requests.payloadExchangeWalletAsync({
                                    isMainnet: IS_MAINNET,
                                    signer: { address },
                                    action: Hyperliquid.actions.actionApproveAgent({
                                        agentAddress,
                                        agentName: `${agentName} valid_until ${expiry}`,
                                        nonce,
                                    }),
                                    nonce,
                                }),
                            })
                            let respMsg = ''
                            switch (resp.status) {
                                case 'ok':
                                    respMsg = `Success: Connected with API wallet\n\nMain Address: ${address}\n\nAPI Name: ${agentName}\nAPI Address: ${signer.address}\nAPI Expiry: ${new Date(expiry).toISOString()}`
                                    agentWallet = signer
                                    break
                                case 'err':
                                    respMsg = `Error: Failed to add API wallet. Connection failed.\n\n${resp.response}`
                                    break
                                case 'default':
                                    respMsg = 'Unknown Error: Failed to add API wallet. Connection failed'
                            }
                            elements.tools.other.resultDisplay.element.value = respMsg
                        } catch (e) {
                            elements.tools.other.resultDisplay.element.value = 'Unknown Error: Connection failed'
                        } finally {
                            disableButtons(false)
                        }
                    },
                },
                disconnect: {
                    async click(e) {
                        disableButtons(true)
                        try {
                            elements.tools.other.resultDisplay.element.value = 'Connecting...'
                            const address = (await walletConnect(CHAIN_IDS[IS_MAINNET]))[0]

                            const agentName = `Wash Tools (${IS_MAINNET ? 'M' : 'T'})`
                            const nonce = Date.now()
                            const resp = await Hyperliquid.requests.postExchangeAsync({
                                url: URLS[IS_MAINNET],
                                payload: await Hyperliquid.requests.payloadExchangeWalletAsync({
                                    isMainnet: IS_MAINNET,
                                    signer: { address },
                                    action: Hyperliquid.actions.actionApproveAgent({
                                        agentAddress: nullAddress,
                                        agentName,
                                        nonce,
                                    }),
                                    nonce,
                                }),
                            })
                            let respMsg = ''
                            switch (resp.status) {
                                case 'ok':
                                    respMsg = `Success: Disconnected API wallet\n\nMain Address: ${address}\n\nAPI Name: ${agentName}`
                                    break
                                case 'err':
                                    respMsg = `Error: Failed to remove API wallet. Disconnect failed.\n\n${resp.response}`
                                    break
                                case 'default':
                                    respMsg = 'Unknown Error: Failed to remove API wallet. Disconnect failed'
                            }
                            elements.tools.other.resultDisplay.element.value = respMsg
                        } catch (e) {
                            elements.tools.other.resultDisplay.element.value = 'Unknown Error: Disconnect failed'
                        } finally {
                            disableButtons(false)
                        }
                    },
                },
                approveFees: {
                    async click(e) {
                        disableButtons(true)
                        try {
                            elements.tools.other.resultDisplay.element.value = 'Approving Burn Fee...'
                            const chainId = CHAIN_IDS[IS_MAINNET]
                            await switchChain(chainId)
                            const signer = await new ethers.BrowserProvider(window.ethereum).getSigner()
                            const nonce = Date.now()
                            const action = {
                                type: 'spotSend',
                                hyperliquidChain: IS_MAINNET ? 'Mainnet' : 'Testnet',
                                signatureChainId: chainIdHex(chainId),
                                destination: bAddress,
                                token: IS_MAINNET ? 'BIGBEN:0x231f2a687770b13fe12adb1f339ff722' : 'PURR:0xc4bf3f870c0e9465323c0b6ed28096c2',
                                amount: IS_MAINNET ? '420' : '1',
                                time: nonce,
                            }
                            const signature = await Hyperliquid.signing.signAsync({
                                signer,
                                domain: {
                                    name: 'HyperliquidSignTransaction',
                                    version: '1',
                                    chainId,
                                    verifyingContract: nullAddress,
                                },
                                types: {
                                    'HyperliquidTransaction:SpotSend': [
                                        { name: 'hyperliquidChain', type: 'string' },
                                        { name: 'destination', type: 'string' },
                                        { name: 'token', type: 'string' },
                                        { name: 'amount', type: 'string' },
                                        { name: 'time', type: 'uint64' },
                                    ]
                                },
                                message: action,
                            })
                            feePayload = { action, nonce, signature }
                            elements.tools.other.resultDisplay.element.value = '420 $BIGBEN Burn Fee  ️‍🔥 Approved'

                            await loading
                            elements.tools.button.buyAll.element.disabled = false
                            elements.tools.button.approveFees.element.disabled = true
                        } catch (e) {
                            elements.tools.other.resultDisplay.element.value = `Unknown Error: Failed to approve 420 $BIGBEN Burn Fee  ️‍🔥`
                            console.error(e)
                        } finally {
                            disableButtons(false)
                        }
                    }
                },
                buyAll: {
                    async click(e) {
                        this.disabled = true
                        disableButtons(true)
                        try {
                            elements.tools.other.resultDisplay.element.value = 'Placing Order...'
                            await load()

                            const notional = parseFloat(elements.tools.input.amountUsd.element.value)
                            const notionalLimit = 12
                            if (!(notionalLimit <= notional)) {
                                elements.tools.other.resultDisplay.element.value = `notional per token needs to be greater than $${notionalLimit}`
                                return
                            }
                            const orders = Object.values(exchangeData.spots).flatMap(data => {
                                const szDecimals = data.token.szDecimals
                                const mark = parseFloat(data.ctx.markPx) * 1.15
                                const sz = notional / mark
                                const price = Hyperliquid.math.priceToOrderString(mark, szDecimals)
                                const size = Hyperliquid.math.sizeToOrderString(sz, szDecimals)
                                const weird = frontendSize(parseFloat(size)) === size
                                if (!weird) console.error(size, frontendSize(parseFloat(size)))
                                return 0 < mark && 0 < sz && price !== '0' && size !== '0' && 2 * sz < parseFloat(data.ctx.circulatingSupply) && weird ? [Hyperliquid.actions.orderLimit({
                                    asset: 10000 + data.spot.index,
                                    isBid: true,
                                    price,
                                    size,
                                    isReduce: false,
                                    tif: 'Ioc',
                                })] : []
                            }) // data.ctx.markPx, data.token.name)

                            const action = Hyperliquid.actions.actionOrder({ orders })
                            const payload = await Hyperliquid.requests.payloadExchangeAsync({ isMainnet: IS_MAINNET, signer: agentWallet, action, nonce: Date.now() })
                            console.log(payload)
                            let resp = await Hyperliquid.requests.postExchangeAsync({ url: URLS[IS_MAINNET], payload })
                            console.log(resp)
                            elements.tools.input.amountUsd.element.value = ''

                            let respMsg = ''
                            switch (resp.status) {
                                case 'ok':
                                    const statuses = resp.response.data.statuses
                                    console.log(statuses)
                                    const results = { error: {}, filled: {} }
                                    if (statuses.length > 1) {
                                        for (const [i, status] of statuses.entries()) {
                                            if (status.filled) {
                                                results.filled[orders[i].a] = status.filled
                                            } else if (status.error) {
                                                const [, error, asset] = status.error.match(/^([\w\W]+) asset=(\d+)$/)
                                                    ; (results.error[error] ||= []).push(asset)
                                            } else {
                                                console.error(`Unknown order result: ${status}`)
                                            }
                                        }
                                    }
                                    respMsg = `Success: Placed order\n\nFilled Spots: ${Object.keys(results.filled).length}\n\nErrors:\n${Object.entries(results.error).reduce((a, c) => a + `${c[0]} Pairs: ${c[1]}\n`, '')}`
                                    break
                                case 'err':
                                    respMsg = `Error: Failed to place order.\n\n${resp.response}`
                                    break
                                case 'default':
                                    respMsg = 'Unknown Error: Failed to place order'
                            }

                            elements.tools.other.resultDisplay.element.value = respMsg
                            resp = await Hyperliquid.requests.postExchangeAsync({ url: URLS[IS_MAINNET], payload: feePayload })
                            feePayload = undefined

                            respMsg = ''
                            switch (resp.status) {
                                case 'ok':
                                    respMsg = `Success: Fees  ️‍🔥 burnt to ${bAddress}`
                                    break
                                case 'err':
                                    respMsg = `Error: Failed to burn fees 💀 (please report to @Shuri2060). Error: ${resp.response}`
                                    break
                                case 'default':
                                    respMsg = 'Unknown Error: Failed to burn fees 💀 (please report to @Shuri2060).'
                            }
                            elements.tools.other.resultDisplay.element.value = respMsg + '\n\n' + elements.tools.other.resultDisplay.element.value
                        } catch (e) {
                            elements.tools.other.resultDisplay.element.value = `Unknown Error: Failed to buy`
                            console.error(e)
                        } finally {
                            disableButtons(false)
                            this.disabled = false
                        }
                    }
                },
                referFetch: {
                    async click(e) {
                        this.disabled = true
                        try {
                            const address = elements.tools.input.referAddress.element.value
                            if (address.length !== 42 || !address.match(/^0x[0-9a-f]+$/i)) throw 'Error: Invalid address'

                            const payload = Hyperliquid.actions.info.referral({ user: address })
                            const resp = await Hyperliquid.requests.postInfoAsync({ url: URLS[IS_MAINNET], payload })
                            const referred = resp.referrerState.data?.referralStates?.reduce((s, user) => s + `${user.user} | ${new Date(user.timeJoined).toISOString()} | ${String(user.cumVlm).padStart(15)} | ${String(user.cumRewardedFeesSinceReferred).padStart(15)} | ${String(user.cumFeesRewardedToReferrer).padStart(15)}\n`, '') || '\n'
                            elements.tools.other.infoDisplay.element.value = `Address:\t\t${address}
Cumulative Volume:\t${resp.cumVlm}
Referred By:\t\t${resp.referredBy?.referrer || 'none'} (code ${resp.referredBy?.code || 'N/A'})

Referral Code:\t\t${resp.referrerState.data?.code || ''}
${'Referred'.padEnd(42)} | ${'Joined'.padEnd(24)} | ${'Volume'.padEnd(15)} | ${'Fees Paid'.padEnd(15)} | ${'Rewards'.padEnd(15)}
${'='.repeat(42 + 24 + 15 * 3 + 3 * 4)}
${referred}
Unclaimed Rewards:\t${resp.unclaimedRewards}
Claimed Rewards:\t${resp.claimedRewards}
Builder Rewards:\t${resp.builderRewards}`
                        } catch (e) {
                            elements.tools.other.infoDisplay.element.value = `${e}`
                        } finally {
                            this.disabled = false
                        }
                    }
                },
                rateLimitFetch: {
                    async click(e) {
                        try {
                            this.disabled = true
                            const address = elements.tools.input.referAddress.element.value
                            if (address.length !== 42 || !address.match(/^0x[0-9a-f]+$/i)) throw 'Error: Invalid address'

                            const payload = Hyperliquid.actions.info.userRateLimit({ user: address })
                            const resp = await Hyperliquid.requests.postInfoAsync({ url: URLS[IS_MAINNET], payload })
                            elements.tools.other.infoDisplay.element.value = `Address:\t\t${address}
Cumulative Volume:\t${resp.cumVlm}

Requests Used:\t${resp.nRequestsUsed}
Requests Cap:\t${resp.nRequestsCap}
Requests Left:\t${resp.nRequestsCap - resp.nRequestsUsed}`
                        } catch (e) {
                            elements.tools.other.infoDisplay.element.value = `${e}`
                        }
                        this.disabled = false
                    }
                },
                deployFetch: {
                    async click(e) {
                        try {
                            this.disabled = true
                            const address = elements.tools.input.referAddress.element.value
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
                            elements.tools.other.infoDisplay.element.value = `Address:\t\t${address}

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
                            elements.tools.other.infoDisplay.element.value = `${e}`
                        } finally {
                            this.disabled = false
                        }
                    }
                }
            },
            input: {
                amountUsd: {},
                referAddress: {},
            },
            other: {
                tokenTable: {},
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

    function processSpotMetaAndAssetCtxs(spotMetaAndAssetCtxs) {
        console.log(spotMetaAndAssetCtxs)
        const tokens = Object.fromEntries(spotMetaAndAssetCtxs[0].tokens.map(token => [token.index, { token, spot: undefined, ctx: undefined }]))
        const spots = {}
        spotMetaAndAssetCtxs[0].universe.forEach(spot => {
            const token = tokens[spot.tokens[0]]
            if (spot.tokens[1] === 0) token.spot = spot
            spots[spot.name] = token
        })
        spotMetaAndAssetCtxs[1].forEach(ctx => spots[ctx.coin] && (spots[ctx.coin].ctx = ctx))
        return { tokens, spots }
    }
    async function load() {
        const payload = Hyperliquid.actions.info.spotMetaAndAssetCtxs({})
        const resp = await Hyperliquid.requests.postInfoAsync({ url: URLS[IS_MAINNET], payload })
        exchangeData = processSpotMetaAndAssetCtxs(resp)
        console.log(exchangeData)
    }
    const loading = load()
})()
