/**
 * Squid Router Type Definitions
 * For frontend integration with wallet signatures
 */

export interface SquidConfig {
  integratorId: string;
  feeRecipientAddress: string;
  apiBaseUrl: string;
}

export interface RouteParams {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  slippage: number;
  collectFees?: {
    integratorAddress: string;
    fee: number; // basis points (e.g., 200 = 2%, 0 = 0%)
  };
}

export interface TransactionRequest {
  target: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface Route {
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    sendAmount: string;
    exchangeRate: string;
    estimatedRouteDuration: number;
    aggregatePriceImpact: string;
    feeCosts: Array<{
      name: string;
      amount: string;
      token: {
        address: string;
        symbol: string;
        decimals: number;
      };
    }>;
    gasCosts: Array<{
      type: string;
      amount: string;
      gasPrice: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
      token: {
        address: string;
        symbol: string;
        decimals: number;
      };
    }>;
  };
  transactionRequest: TransactionRequest;
  params: RouteParams;
}

export interface RouteResponse {
  route: Route;
  requestId: string;
}

export interface TransactionStatus {
  id: string;
  status: string;
  gasStatus: string;
  isGMPTransaction: boolean;
  axelarTransactionUrl: string;
  fromChain: {
    chainId: string;
    transactionId: string;
    blockNumber: number;
    callEventStatus: string;
    callEventLog: any[];
  };
  toChain?: {
    chainId: string;
    transactionId: string;
    blockNumber: number;
  };
  timeSpent: Record<string, number>;
  squidTransactionStatus: 'success' | 'partial_success' | 'needs_gas' | 'ongoing' | 'failed';
  error?: any;
}

export interface BridgeState {
  isLoading: boolean;
  error: string | null;
  status: 'idle' | 'approving' | 'bridging' | 'monitoring' | 'success' | 'error';
  txHash: string | null;
  route: Route | null;
}
