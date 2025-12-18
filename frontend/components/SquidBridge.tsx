/**
 * Squid Bridge Component
 * UI for cross-chain USDC bridging from Base to Polygon
 */

'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useSquidBridge } from '@/hooks/useSquidBridge';
import { CHAIN_NAMES, BLOCK_EXPLORERS, TOKEN_DECIMALS, FEE_BASIS_POINTS } from '@/lib/squid/config';

export default function SquidBridge() {
  const {
    walletAddress,
    balance,
    isLoading,
    error,
    status,
    txHash,
    route,
    connectWallet,
    fetchRoute,
    bridge,
    reset,
  } = useSquidBridge();

  const [amount, setAmount] = useState('');
  const [showQuote, setShowQuote] = useState(false);

  /**
   * Handle amount input change
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimals
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setShowQuote(false);
    }
  };

  /**
   * Get quote for amount
   */
  const handleGetQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    try {
      await fetchRoute(amount);
      setShowQuote(true);
    } catch (error) {
      console.error('Failed to get quote:', error);
    }
  };

  /**
   * Execute bridge
   */
  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    try {
      await bridge(amount);
    } catch (error) {
      console.error('Bridge failed:', error);
    }
  };

  /**
   * Reset and start over
   */
  const handleReset = () => {
    setAmount('');
    setShowQuote(false);
    reset();
  };

  /**
   * Format amount for display
   */
  const formatAmount = (value: string, decimals: number = TOKEN_DECIMALS.USDC) => {
    try {
      return parseFloat(ethers.formatUnits(value, decimals)).toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  /**
   * Get status message
   */
  const getStatusMessage = () => {
    switch (status) {
      case 'approving':
        return 'Approving USDC...';
      case 'bridging':
        return 'Executing bridge transaction...';
      case 'monitoring':
        return 'Monitoring cross-chain transfer...';
      case 'success':
        return 'Bridge completed successfully!';
      default:
        return '';
    }
  };

  /**
   * Calculate fee amount
   */
  const calculateFee = () => {
    if (!route || FEE_BASIS_POINTS === 0) return '0';
    const fromAmount = parseFloat(ethers.formatUnits(route.estimate.fromAmount, TOKEN_DECIMALS.USDC));
    const feeAmount = fromAmount * (FEE_BASIS_POINTS / 10000);
    return feeAmount.toFixed(4);
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Cross-Chain Bridge
        </h3>
        <div className="flex space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Base → Polygon
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            USDC
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 space-y-4">
        {/* Error Display */}
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

        {/* Success Display */}
        {status === 'success' && txHash && (
          <div className="rounded-md bg-green-50 p-4 border border-green-200">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-green-800">
                ✅ Bridge Completed Successfully!
              </h3>
              <div>
                <label className="block text-xs font-medium text-green-700 uppercase tracking-wider mb-1">
                  Transaction Hash
                </label>
                <a
                  href={`${BLOCK_EXPLORERS['8453']}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full px-3 py-2 rounded-md border border-green-300 bg-white text-sm text-blue-600 hover:text-blue-500 underline font-mono truncate"
                >
                  {txHash}
                </a>
              </div>
              <button
                onClick={handleReset}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-green-600 shadow-sm text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                Bridge Again
              </button>
            </div>
          </div>
        )}

        {/* Wallet Connection */}
        {!walletAddress ? (
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <>
            {/* Wallet Info */}
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-gray-700 truncate">{walletAddress}</p>
              </div>
              {balance && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-1">USDC Balance (Base)</p>
                  <p className="text-lg font-bold text-blue-900">{parseFloat(balance).toFixed(2)} USDC</p>
                </div>
              )}
            </div>

            {/* Amount Input */}
            {status !== 'success' && (
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Bridge (USDC)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="amount"
                    value={amount}
                    onChange={handleAmountChange}
                    disabled={isLoading}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0.00"
                  />
                  {balance && (
                    <button
                      onClick={() => setAmount(balance)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      MAX
                    </button>
                  )}
                </div>
                {amount && parseFloat(amount) > 0 && !showQuote && (
                  <button
                    onClick={handleGetQuote}
                    disabled={isLoading}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Get Quote
                  </button>
                )}
              </div>
            )}

            {/* Quote Display */}
            {showQuote && route && status !== 'success' && (
              <div className="bg-purple-50 rounded-md p-4 space-y-3 border border-purple-200">
                <h4 className="text-sm font-medium text-purple-900">Route Quote</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From (Base):</span>
                    <span className="font-mono font-medium">{formatAmount(route.estimate.fromAmount)} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To (Polygon):</span>
                    <span className="font-mono font-medium">{formatAmount(route.estimate.toAmount)} USDC</span>
                  </div>
                  {FEE_BASIS_POINTS > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fee ({FEE_BASIS_POINTS / 100}%):</span>
                      <span className="font-mono font-medium">{calculateFee()} USDC</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Time:</span>
                    <span className="font-medium">
                      ~{Math.ceil(route.estimate.estimatedRouteDuration / 60)} min
                    </span>
                  </div>
                  {route.estimate.gasCosts.length > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Est. Gas:</span>
                      <span className="font-mono">
                        {formatAmount(route.estimate.gasCosts[0].amount, 18)} ETH
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Display */}
            {status !== 'idle' && status !== 'success' && (
              <div className="bg-yellow-50 rounded-md p-4 border border-yellow-200">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-700"></div>
                  <span className="text-sm font-medium text-yellow-800">{getStatusMessage()}</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            {status !== 'success' && (
              <button
                onClick={handleBridge}
                disabled={!amount || parseFloat(amount) <= 0 || isLoading || !walletAddress}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? getStatusMessage() || 'Processing...' : 'Bridge USDC'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
