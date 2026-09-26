export function collectShards(artifactsDir: string, adapter: string, shards: number): { found: string[]; missing: number[] };
export function mergeShardReports(paths: string[]): { testResults: unknown[]; numTotalTests: number; success: boolean; [key: string]: unknown };
