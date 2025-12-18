"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<{
    safeAddress: string;
    txnHash: string;
    derivedEOA: string;
  } | null>(null);

  const [balanceAddress, setBalanceAddress] = useState("");
  const [balance, setBalance] = useState<{
    safe: string;
    balanceUSDC: number;
    balanceWei: string;
  } | null>(null);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    setLoading("connect");
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setWalletAddress(accounts[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const signAndDeploy = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first");
      return;
    }
    setLoading("deploy");
    setError(null);

    try {
      // 1. Request Signature
      const message = "Sign this message to access your Polymarket Safe account.";
      const sig = await window.ethereum.request({
        method: "personal_sign",
        params: [message, walletAddress],
      });
      setSignature(sig);

      console.log("Signature:", sig);

      // 2. Send Signature to Backend
      const res = await fetch("http://localhost:9000/deploy-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: sig }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to deploy safe");
      }

      const data = await res.json();
      setDeploymentStatus(data);
      setBalanceAddress(data.safeAddress); // Auto-fill for convenience
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(null);
    }
  };

  const checkBalance = async () => {
    if (!balanceAddress) {
      setError("Safe address is required");
      return;
    }
    setLoading("balance");
    setError(null);
    try {
      const res = await fetch(
        `http://localhost:9000/safe/${balanceAddress}/balance`
      );
      if (!res.ok) throw new Error("Failed to fetch balance");
      const data = await res.json();
      setBalance(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-2">
            Polymarket Safe Deployer
          </h1>
          <p className="text-lg text-gray-600">
            Connect using MetaMask, Sign to Derive Key, and Deploy Safe.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Connect & Deploy Section */}
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Step 1 & 2: Connect & Deploy
            </h3>
            <div className="flex space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                MetaMask
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Smart Account
              </span>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">

            <div className="flex flex-col space-y-3">
              {!walletAddress ? (
                <button
                  onClick={connectWallet}
                  disabled={loading === "connect"}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading === "connect" ? "Connecting..." : "Connect MetaMask"}
                </button>
              ) : (
                <div className="p-3 bg-gray-50 rounded border border-gray-200 text-sm break-all font-mono text-gray-600">
                  Connected: {walletAddress}
                </div>
              )}

              <button
                onClick={signAndDeploy}
                disabled={!walletAddress || loading === "deploy"}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === "deploy" ? "Signing & Deploying..." : "Sign & Deploy Safe"}
              </button>
            </div>

            {deploymentStatus && (
              <div className="mt-4 bg-green-50 rounded-md p-4 space-y-3 border border-green-200">
                <div>
                  <label className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    Derived Private Key Owner (Hidden)
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={deploymentStatus.derivedEOA}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border-green-300 bg-white text-sm text-gray-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    Deployed Safe Address
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={deploymentStatus.safeAddress}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border-green-300 bg-white text-sm focus:ring-green-500 focus:border-green-500 font-mono text-gray-800 shadow-[0_0_10px_rgba(74,222,128,0.5)] transition-shadow duration-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-green-800 uppercase tracking-wider">
                    Transaction Hash
                  </label>
                  <a
                    href={`https://polygonscan.com/tx/${deploymentStatus.txnHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-green-300 bg-white text-sm text-blue-600 hover:text-blue-500 underline font-mono truncate"
                  >
                    {deploymentStatus.txnHash}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Check Balance Section */}
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Step 3: Check Balance
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              USDC
            </span>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label
                htmlFor="safeAddress"
                className="block text-sm font-medium text-gray-700"
              >
                Safe Address
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="safeAddress"
                  id="safeAddress"
                  value={balanceAddress}
                  onChange={(e) => setBalanceAddress(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border font-mono"
                  placeholder="0x..."
                />
              </div>
            </div>

            <button
              onClick={checkBalance}
              disabled={loading === "balance" || !balanceAddress}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === "balance" ? "Checking..." : "Check Balance"}
            </button>

            {balance && (
              <div className="mt-4 bg-purple-50 rounded-md p-4 border border-purple-200 flex flex-col items-center justify-center space-y-2">
                <div className="text-3xl font-bold text-gray-900">
                  ${balance.balanceUSDC.toFixed(2)} <span className="text-lg text-gray-500 font-normal">USDC</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  Wei: {balance.balanceWei}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

