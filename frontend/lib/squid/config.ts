/**
 * Squid Router Configuration
 * Chain IDs, token addresses, and constants
 */

import { SquidConfig } from './types';

// Chain IDs - MAINNETS ONLY (Squid doesn't support testnets)
export const CHAIN_IDS = {
  BASE: '8453',
  POLYGON: '137',
} as const;

// USDC Token Addresses on Mainnets
export const TOKENS = {
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDC_POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
} as const;

// Token decimals
export const TOKEN_DECIMALS = {
  USDC: 6,
} as const;

// Squid Configuration
export const SQUID_CONFIG: SquidConfig = {
  integratorId: 'spredd-markets-14cb973b-2ec8-4c26-bffb-998b6a6a84d9',
  feeRecipientAddress: '0xA42004A36aE97dfA691D7DF74db8FA9951dA2ed4',
  apiBaseUrl: 'https://v2.api.squidrouter.com',
};

// Fee configuration (in basis points: 100 = 1%, 0 = 0%)
export const FEE_BASIS_POINTS = 0; // Currently set to 0%, can be changed to 200 for 2%

// ERC20 ABI fragments for token operations
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

// Block explorer URLs
export const BLOCK_EXPLORERS = {
  [CHAIN_IDS.BASE]: 'https://basescan.org',
  [CHAIN_IDS.POLYGON]: 'https://polygonscan.com',
} as const;

// Chain names for display
export const CHAIN_NAMES = {
  [CHAIN_IDS.BASE]: 'Base',
  [CHAIN_IDS.POLYGON]: 'Polygon',
} as const;

// RPC URLs (fallback, wallet's provider is preferred)
export const RPC_URLS = {
  [CHAIN_IDS.BASE]: 'https://mainnet.base.org',
  [CHAIN_IDS.POLYGON]: 'https://polygon-rpc.com',
} as const;
