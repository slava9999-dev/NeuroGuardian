import { ProductDoc, DefenseActionResult, DefenseMode } from '../../schemas';
interface DefenseContext {
    userId: number;
    product: ProductDoc;
    currentPrice: number;
    minPrice: number;
    defenseMode: DefenseMode;
    wbApiKey?: string;
    ozonApiKey?: string;
    ozonClientId?: string;
}
/**
 * Execute defense protocol for a single product
 */
export declare function executeDefense(ctx: DefenseContext): Promise<DefenseActionResult>;
/**
 * Check if defense should trigger for a product
 */
export declare function shouldTriggerDefense(currentPrice: number, minPrice: number): boolean;
/**
 * Calculate potential savings
 */
export declare function calculateSavings(currentPrice: number, minPrice: number, stock: number): number;
export {};
//# sourceMappingURL=defenseProtocol.d.ts.map