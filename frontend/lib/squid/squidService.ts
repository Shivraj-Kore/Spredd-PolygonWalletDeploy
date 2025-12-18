/**
 * Squid Router Service
 * Core functions for cross-chain bridging using wallet signatures
 */

import { ethers } from 'ethers';
import type { RouteParams, RouteResponse, TransactionStatus, Route } from './types';
import { SQUID_CONFIG, ERC20_ABI, FEE_BASIS_POINTS } from './config';

/**
 * Retry wrapper with exponential backoff for handling rate limits
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429) or network error
      const isRateLimit = error?.status === 429;
      const isRetryable = isRateLimit || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT';

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Rate limited or network error. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Fetch route from Squid API
 */
export async function getRoute(params: RouteParams): Promise<RouteResponse> {
  const requestParams = {
    ...params,
    // Only include collectFees if fee is greater than 0
    ...(FEE_BASIS_POINTS > 0 && {
      collectFees: {
        integratorAddress: SQUID_CONFIG.feeRecipientAddress,
        fee: FEE_BASIS_POINTS,
      },
    }),
  };

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${SQUID_CONFIG.apiBaseUrl}/v2/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-integrator-id': SQUID_CONFIG.integratorId,
      },
      body: JSON.stringify(requestParams),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API Error: ${res.status}`);
    }

    return res.json();
  });

  console.log('Squid API response:', response);

  // Ensure we have the required fields
  if (!response.route) {
    throw new Error('Invalid API response: missing route');
  }

  return {
    route: response.route,
    requestId: response.route.quoteId || '', // Use quoteId from the route
  };
}

/**
 * Check token allowance
 */
export async function checkAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  signer: ethers.Signer
): Promise<bigint> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
  return allowance;
}

/**
 * Approve token spending
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  signer: ethers.Signer
): Promise<ethers.TransactionReceipt> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // Approve only the specific amount needed for this transaction
  const tx = await tokenContract.approve(spenderAddress, amount);
  const receipt = await tx.wait();

  return receipt;
}

/**
 * Execute bridge transaction
 */
export async function executeBridge(
  route: Route,
  signer: ethers.Signer
): Promise<ethers.TransactionResponse> {
  const txRequest = route.transactionRequest;

  const tx = await signer.sendTransaction({
    to: txRequest.target,
    data: txRequest.data,
    value: txRequest.value,
    gasLimit: txRequest.gasLimit,
    ...(txRequest.maxFeePerGas && { maxFeePerGas: txRequest.maxFeePerGas }),
    ...(txRequest.maxPriorityFeePerGas && { maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas }),
  });

  return tx;
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  txHash: string,
  requestId: string,
  fromChainId: string,
  toChainId: string
): Promise<TransactionStatus> {
  const params = new URLSearchParams({
    transactionId: txHash,
    requestId: requestId,
    fromChainId: fromChainId,
    toChainId: toChainId,
  });

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${SQUID_CONFIG.apiBaseUrl}/v2/status?${params}`, {
      headers: {
        'x-integrator-id': SQUID_CONFIG.integratorId,
      },
    });

    // 404 means transaction not indexed yet - return pending status
    if (res.status === 404) {
      return {
        squidTransactionStatus: 'ongoing',
        id: txHash,
        status: 'pending',
      };
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Status API Error: ${res.status}`);
    }

    return res.json();
  });

  return response;
}

/**
 * Monitor transaction until completion
 */
export async function monitorTransaction(
  txHash: string,
  requestId: string,
  fromChainId: string,
  toChainId: string,
  onStatusUpdate?: (status: TransactionStatus) => void,
  pollInterval: number = 5000
): Promise<TransactionStatus> {
  // Wait a bit before first check to give Squid time to index the transaction
  await new Promise(resolve => setTimeout(resolve, 3000));

  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)

  while (attempts < maxAttempts) {
    try {
      const status = await getTransactionStatus(txHash, requestId, fromChainId, toChainId);

      if (onStatusUpdate) {
        onStatusUpdate(status);
      }

      // Check if transaction is complete
      if (['success', 'partial_success', 'needs_gas', 'failed'].includes(status.squidTransactionStatus)) {
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error: any) {
      console.error('Status check error:', error);
      // Continue polling even on errors (might be temporary)
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }
  }

  // Timeout after max attempts
  throw new Error('Transaction monitoring timeout - please check block explorer');
}

/**
 * Get token balance
 */
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  provider: ethers.Provider
): Promise<bigint> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await tokenContract.balanceOf(walletAddress);
  return balance;
}

/**
 * Get token info (symbol, decimals)
 */
export async function getTokenInfo(
  tokenAddress: string,
  provider: ethers.Provider
): Promise<{ symbol: string; decimals: number }> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([
    tokenContract.symbol(),
    tokenContract.decimals(),
  ]);

  return { symbol, decimals };
}
