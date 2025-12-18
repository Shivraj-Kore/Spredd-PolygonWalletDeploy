import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { polygon } from "viem/chains";
import { RelayClient } from "@polymarket/builder-relayer-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";


const publicClient = createPublicClient({
    chain: polygon,
    transport: http(process.env.RPC_URL)
});


dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

//builder wallet 
const builderAccount = privateKeyToAccount(process.env.PRIVATE_KEY);
const builderWallet = createWalletClient({
    account: builderAccount,
    chain: polygon,
    transport: http(process.env.RPC_URL)
});

console.log("🔑 Builder Wallet:", builderAccount.address);

//builder config remote signing

const builderConfig = new BuilderConfig({
    remoteBuilderConfig: {
        url: process.env.REMOTE_SIGN_URL
    }
});


//create user EOA (secure EVM key) - DEPRECATED/REMOVED in favor of signature derivation
// app.post("/create-user", ... );

//deploy safe for user
import { keccak256 } from "viem";

app.post("/deploy-safe", async (req, res) => {
    try {
        const { signature } = req.body;

        if (!signature) {
            return res.status(400).json({ error: "Signature is required" });
        }

        // Deterministically derive private key from the signature
        const privateKey = keccak256(signature);
        const user = privateKeyToAccount(privateKey);

        console.log("\n🚀 Deploying Safe for Derived User:", user.address);

        // Create wallet client for THIS user
        const userWallet = createWalletClient({
            account: user,
            chain: polygon,
            transport: http(process.env.RPC_URL)
        });

        // Relay client for THIS user
        const userClient = new RelayClient(
            process.env.POLYMARKET_RELAYER_URL,
            137,
            userWallet,
            builderConfig
        );

        // Deploy safe
        let safeAddress;
        let txnHash;

        try {
            const resp = await userClient.deploy();
            console.log("🟡 SAFE DEPLOY TX SENT");

            const result = await resp.wait();
            if (!result) {
                console.log("❌ Safe deploy failed or timed out");
                return res.status(500).json({ error: "Timeout" });
            }
            console.log("✅ SAFE DEPLOYED:", result.proxyAddress);
            safeAddress = result.proxyAddress;
            txnHash = result.transactionHash;

        } catch (error) {
            if (error.message && error.message.toLowerCase().includes("safe already deployed")) {
                console.log("ℹ️ Safe already deployed, fetching address...");
                safeAddress = await userClient.getExpectedSafe();
                txnHash = "Already Deployed"; // No new tx hash
                console.log("✅ EXISTING SAFE FOUND:", safeAddress);
            } else {
                throw error;
            }
        }

        res.json({
            safeAddress,
            txnHash,
            derivedEOA: user.address,
            isExisting: txnHash === "Already Deployed"
        });

    } catch (e) {
        console.error("❌ Deploy Error:", e);
        res.status(500).json({ error: e.message });
    }
});

//get safe balance

app.get("/safe/:safeAddress/balance", async (req, res) => {
    try {
        const { safeAddress } = req.params;

        const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

        const USDC_ABI = [
            {
                constant: true,
                inputs: [{ name: "_owner", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "balance", type: "uint256" }],
                type: "function"
            }
        ];

        const balanceWei = await publicClient.readContract({
            address: USDC,
            abi: USDC_ABI,
            functionName: "balanceOf",
            args: [safeAddress]
        });

        const balanceUSDC = Number(balanceWei) / 1e6;

        res.json({
            safe: safeAddress,
            balanceUSDC,
            balanceWei: balanceWei.toString()
        });
    } catch (err) {
        console.error("❌ Safe Balance Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// ------------------------------
app.listen(9000, () => {
    console.log("\n🔥 Backend running on :9000\n");
});
