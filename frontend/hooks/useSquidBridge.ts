/**
 * React Hook for Squid Bridge Integration
 * Manages wallet connection, bridge state, and transaction flow
 */

'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import type { BridgeState, Route, TransactionStatus } from '@/lib/squid/types';
import {
  getRoute,
  checkAllowance,
  approveToken,
  executeBridge,
  monitorTransaction,
  getTokenBalance,
} from '@/lib/squid/squidService';
import { CHAIN_IDS, TOKENS, TOKEN_DECIMALS } from '@/lib/squid/config';

export function useSquidBridge() {
  const [state, setState] = useState<BridgeState>({
    isLoading: false,
    error: null,
    status: 'idle',
    txHash: null,
    route: null,
  });

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  /**
   * Connect wallet
   */
  const connectWallet = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const address = accounts[0];

      setWalletAddress(address);

      // Check network and switch if necessary
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();

      if (chainId !== CHAIN_IDS.BASE) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + Number(CHAIN_IDS.BASE).toString(16) }],
          });
          // Re-initialize provider after switch to ensure it picks up the new chain
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          const bal = await getTokenBalance(TOKENS.USDC_BASE, address, newProvider);
          setBalance(ethers.formatUnits(bal, TOKEN_DECIMALS.USDC));
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask.
          if (switchError.code === 4902) {
            throw new Error('Please add Base network to your wallet');
          }
          throw switchError;
        }
      } else {
        // Already on Base
        const bal = await getTokenBalance(TOKENS.USDC_BASE, address, provider);
        setBalance(ethers.formatUnits(bal, TOKEN_DECIMALS.USDC));
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return address;
    } catch (error: any) {
      const errorMessage = error.code === 4001
        ? 'Wallet connection rejected by user'
        : error.message || 'Failed to connect wallet';

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        status: 'error',
      }));
      throw error;
    }
  }, []);

  /**
   * Fetch route quote
   */
  const fetchRoute = useCallback(async (amount: string): Promise<Route> => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const amountInWei = ethers.parseUnits(amount, TOKEN_DECIMALS.USDC);

      const { route, requestId } = await getRoute({
        fromChain: CHAIN_IDS.BASE,
        toChain: CHAIN_IDS.POLYGON,
        fromToken: TOKENS.USDC_BASE,
        toToken: TOKENS.USDC_POLYGON,
        fromAmount: amountInWei.toString(),
        fromAddress: walletAddress,
        toAddress: walletAddress,
        slippage: 1, // 1% slippage
      });

      setState(prev => ({
        ...prev,
        route,
        isLoading: false,
      }));

      return route;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch route';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        status: 'error',
      }));
      throw error;
    }
  }, [walletAddress]);

  /**
   * Execute bridge transaction
   */
  const bridge = useCallback(async (amount: string) => {
    if (!walletAddress || !window.ethereum) {
      throw new Error('Wallet not connected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, status: 'idle' }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Step 1: Fetch route
      setState(prev => ({ ...prev, status: 'idle' }));
      const { route, requestId } = await getRoute({
        fromChain: CHAIN_IDS.BASE,
        toChain: CHAIN_IDS.POLYGON,
        fromToken: TOKENS.USDC_BASE,
        toToken: TOKENS.USDC_POLYGON,
        fromAmount: ethers.parseUnits(amount, TOKEN_DECIMALS.USDC).toString(),
        fromAddress: walletAddress,
        toAddress: walletAddress,
        slippage: 1,
      });

      setState(prev => ({ ...prev, route }));

      // Step 2: Check and approve token if needed
      setState(prev => ({ ...prev, status: 'approving' }));
      const allowance = await checkAllowance(
        TOKENS.USDC_BASE,
        walletAddress,
        route.transactionRequest.target,
        signer
      );

      const amountBigInt = BigInt(route.params.fromAmount);

      if (allowance < amountBigInt) {
        console.log('Requesting token approval...');
        await approveToken(
          TOKENS.USDC_BASE,
          route.transactionRequest.target,
          amountBigInt,
          signer
        );
        console.log('Token approved');
      }

      // Step 3: Execute bridge transaction
      setState(prev => ({ ...prev, status: 'bridging' }));
      const tx = await executeBridge(route, signer);
      console.log('Bridge transaction sent:', tx.hash);

      setState(prev => ({ ...prev, txHash: tx.hash }));

      // Wait for transaction confirmation
      await tx.wait();
      console.log('Transaction confirmed');

      // Step 4: Monitor cross-chain status
      setState(prev => ({ ...prev, status: 'monitoring' }));
      const finalStatus = await monitorTransaction(
        tx.hash,
        requestId,
        CHAIN_IDS.BASE,
        CHAIN_IDS.POLYGON,
        (status: TransactionStatus) => {
          console.log('Status update:', status.squidTransactionStatus);
        }
      );

      if (finalStatus.squidTransactionStatus === 'success') {
        setState(prev => ({
          ...prev,
          status: 'success',
          isLoading: false,
        }));
      } else {
        throw new Error(`Bridge failed with status: ${finalStatus.squidTransactionStatus}`);
      }

      return { tx, finalStatus };
    } catch (error: any) {
      let errorMessage = 'Bridge transaction failed';

      if (error.code === 4001) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for transaction';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        status: 'error',
      }));

      throw error;
    }
  }, [walletAddress]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      status: 'idle',
      txHash: null,
      route: null,
    });
  }, []);

  return {
    // State
    ...state,
    walletAddress,
    balance,

    // Actions
    connectWallet,
    fetchRoute,
    bridge,
    reset,
  };
}
