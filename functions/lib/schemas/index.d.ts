import { z } from 'zod';
export declare const MarketplaceSchema: z.ZodEnum<["WB", "Ozon"]>;
export type Marketplace = z.infer<typeof MarketplaceSchema>;
export declare const ProductStatusSchema: z.ZodEnum<["active", "protected", "triggered", "disabled"]>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export declare const DefenseModeSchema: z.ZodEnum<["zero_stock", "price_correction"]>;
export type DefenseMode = z.infer<typeof DefenseModeSchema>;
export declare const LogTypeSchema: z.ZodEnum<["price_drop", "defense_triggered", "sync", "error", "info"]>;
export type LogType = z.infer<typeof LogTypeSchema>;
export declare const WBCardSchema: z.ZodObject<{
    nmID: z.ZodNumber;
    vendorCode: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        big: z.ZodOptional<z.ZodString>;
        c246x328: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        big?: string | undefined;
        c246x328?: string | undefined;
    }, {
        big?: string | undefined;
        c246x328?: string | undefined;
    }>, "many">>;
    sizes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        techSize: z.ZodString;
        skus: z.ZodArray<z.ZodString, "many">;
        price: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        techSize: string;
        skus: string[];
        price?: number | undefined;
    }, {
        techSize: string;
        skus: string[];
        price?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    nmID: number;
    vendorCode: string;
    brand?: string | undefined;
    title?: string | undefined;
    photos?: {
        big?: string | undefined;
        c246x328?: string | undefined;
    }[] | undefined;
    sizes?: {
        techSize: string;
        skus: string[];
        price?: number | undefined;
    }[] | undefined;
}, {
    nmID: number;
    vendorCode: string;
    brand?: string | undefined;
    title?: string | undefined;
    photos?: {
        big?: string | undefined;
        c246x328?: string | undefined;
    }[] | undefined;
    sizes?: {
        techSize: string;
        skus: string[];
        price?: number | undefined;
    }[] | undefined;
}>;
export type WBCard = z.infer<typeof WBCardSchema>;
export declare const WBCardsListResponseSchema: z.ZodObject<{
    cards: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        nmID: z.ZodNumber;
        vendorCode: z.ZodString;
        brand: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        photos: z.ZodOptional<z.ZodArray<z.ZodObject<{
            big: z.ZodOptional<z.ZodString>;
            c246x328: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            big?: string | undefined;
            c246x328?: string | undefined;
        }, {
            big?: string | undefined;
            c246x328?: string | undefined;
        }>, "many">>;
        sizes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            techSize: z.ZodString;
            skus: z.ZodArray<z.ZodString, "many">;
            price: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            techSize: string;
            skus: string[];
            price?: number | undefined;
        }, {
            techSize: string;
            skus: string[];
            price?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        nmID: number;
        vendorCode: string;
        brand?: string | undefined;
        title?: string | undefined;
        photos?: {
            big?: string | undefined;
            c246x328?: string | undefined;
        }[] | undefined;
        sizes?: {
            techSize: string;
            skus: string[];
            price?: number | undefined;
        }[] | undefined;
    }, {
        nmID: number;
        vendorCode: string;
        brand?: string | undefined;
        title?: string | undefined;
        photos?: {
            big?: string | undefined;
            c246x328?: string | undefined;
        }[] | undefined;
        sizes?: {
            techSize: string;
            skus: string[];
            price?: number | undefined;
        }[] | undefined;
    }>, "many">>>;
    cursor: z.ZodOptional<z.ZodObject<{
        updatedAt: z.ZodOptional<z.ZodString>;
        nmID: z.ZodOptional<z.ZodNumber>;
        total: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        nmID?: number | undefined;
        updatedAt?: string | undefined;
        total?: number | undefined;
    }, {
        nmID?: number | undefined;
        updatedAt?: string | undefined;
        total?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    cards: {
        nmID: number;
        vendorCode: string;
        brand?: string | undefined;
        title?: string | undefined;
        photos?: {
            big?: string | undefined;
            c246x328?: string | undefined;
        }[] | undefined;
        sizes?: {
            techSize: string;
            skus: string[];
            price?: number | undefined;
        }[] | undefined;
    }[];
    cursor?: {
        nmID?: number | undefined;
        updatedAt?: string | undefined;
        total?: number | undefined;
    } | undefined;
}, {
    cards?: {
        nmID: number;
        vendorCode: string;
        brand?: string | undefined;
        title?: string | undefined;
        photos?: {
            big?: string | undefined;
            c246x328?: string | undefined;
        }[] | undefined;
        sizes?: {
            techSize: string;
            skus: string[];
            price?: number | undefined;
        }[] | undefined;
    }[] | undefined;
    cursor?: {
        nmID?: number | undefined;
        updatedAt?: string | undefined;
        total?: number | undefined;
    } | undefined;
}>;
export declare const WBPriceInfoSchema: z.ZodObject<{
    nmId: z.ZodNumber;
    price: z.ZodNumber;
    discount: z.ZodOptional<z.ZodNumber>;
    promoCode: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    price: number;
    nmId: number;
    discount?: number | undefined;
    promoCode?: number | undefined;
}, {
    price: number;
    nmId: number;
    discount?: number | undefined;
    promoCode?: number | undefined;
}>;
export declare const WBPricesResponseSchema: z.ZodArray<z.ZodObject<{
    nmId: z.ZodNumber;
    price: z.ZodNumber;
    discount: z.ZodOptional<z.ZodNumber>;
    promoCode: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    price: number;
    nmId: number;
    discount?: number | undefined;
    promoCode?: number | undefined;
}, {
    price: number;
    nmId: number;
    discount?: number | undefined;
    promoCode?: number | undefined;
}>, "many">;
export declare const WBStockSchema: z.ZodObject<{
    sku: z.ZodString;
    amount: z.ZodNumber;
    warehouseId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sku: string;
    amount: number;
    warehouseId: number;
}, {
    sku: string;
    amount: number;
    warehouseId: number;
}>;
export declare const WBStocksResponseSchema: z.ZodObject<{
    stocks: z.ZodArray<z.ZodObject<{
        sku: z.ZodString;
        amount: z.ZodNumber;
        warehouseId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sku: string;
        amount: number;
        warehouseId: number;
    }, {
        sku: string;
        amount: number;
        warehouseId: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stocks: {
        sku: string;
        amount: number;
        warehouseId: number;
    }[];
}, {
    stocks: {
        sku: string;
        amount: number;
        warehouseId: number;
    }[];
}>;
export declare const WBUpdateStockRequestSchema: z.ZodObject<{
    stocks: z.ZodArray<z.ZodObject<{
        sku: z.ZodString;
        warehouseId: z.ZodNumber;
        amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sku: string;
        amount: number;
        warehouseId: number;
    }, {
        sku: string;
        amount: number;
        warehouseId: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stocks: {
        sku: string;
        amount: number;
        warehouseId: number;
    }[];
}, {
    stocks: {
        sku: string;
        amount: number;
        warehouseId: number;
    }[];
}>;
export declare const OzonProductItemSchema: z.ZodObject<{
    product_id: z.ZodNumber;
    offer_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    product_id: number;
    offer_id: string;
    name?: string | undefined;
    barcode?: string | undefined;
}, {
    product_id: number;
    offer_id: string;
    name?: string | undefined;
    barcode?: string | undefined;
}>;
export declare const OzonProductListResponseSchema: z.ZodObject<{
    result: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            product_id: z.ZodNumber;
            offer_id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            barcode: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            product_id: number;
            offer_id: string;
            name?: string | undefined;
            barcode?: string | undefined;
        }, {
            product_id: number;
            offer_id: string;
            name?: string | undefined;
            barcode?: string | undefined;
        }>, "many">;
        total: z.ZodNumber;
        last_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        total: number;
        items: {
            product_id: number;
            offer_id: string;
            name?: string | undefined;
            barcode?: string | undefined;
        }[];
        last_id?: string | undefined;
    }, {
        total: number;
        items: {
            product_id: number;
            offer_id: string;
            name?: string | undefined;
            barcode?: string | undefined;
        }[];
        last_id?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    result: {
        total: number;
        items: {
            product_id: number;
            offer_id: string;
            name?: string | undefined;
            barcode?: string | undefined;
        }[];
        last_id?: string | undefined;
    };
}, {
    result: {
        total: number;
        items: {
            product_id: number;
            offer_id: string;
            name?: string | undefined;
            barcode?: string | undefined;
        }[];
        last_id?: string | undefined;
    };
}>;
export declare const OzonProductInfoItemSchema: z.ZodObject<{
    id: z.ZodNumber;
    offer_id: z.ZodString;
    name: z.ZodString;
    barcode: z.ZodOptional<z.ZodString>;
    primary_image: z.ZodOptional<z.ZodString>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    marketing_price: z.ZodOptional<z.ZodString>;
    min_price: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodString>;
    stocks: z.ZodOptional<z.ZodObject<{
        present: z.ZodNumber;
        reserved: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        present: number;
        reserved: number;
    }, {
        present: number;
        reserved: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    offer_id: string;
    name: string;
    id: number;
    price?: string | undefined;
    stocks?: {
        present: number;
        reserved: number;
    } | undefined;
    barcode?: string | undefined;
    primary_image?: string | undefined;
    images?: string[] | undefined;
    marketing_price?: string | undefined;
    min_price?: string | undefined;
}, {
    offer_id: string;
    name: string;
    id: number;
    price?: string | undefined;
    stocks?: {
        present: number;
        reserved: number;
    } | undefined;
    barcode?: string | undefined;
    primary_image?: string | undefined;
    images?: string[] | undefined;
    marketing_price?: string | undefined;
    min_price?: string | undefined;
}>;
export declare const OzonProductInfoResponseSchema: z.ZodObject<{
    result: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            offer_id: z.ZodString;
            name: z.ZodString;
            barcode: z.ZodOptional<z.ZodString>;
            primary_image: z.ZodOptional<z.ZodString>;
            images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            marketing_price: z.ZodOptional<z.ZodString>;
            min_price: z.ZodOptional<z.ZodString>;
            price: z.ZodOptional<z.ZodString>;
            stocks: z.ZodOptional<z.ZodObject<{
                present: z.ZodNumber;
                reserved: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                present: number;
                reserved: number;
            }, {
                present: number;
                reserved: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            offer_id: string;
            name: string;
            id: number;
            price?: string | undefined;
            stocks?: {
                present: number;
                reserved: number;
            } | undefined;
            barcode?: string | undefined;
            primary_image?: string | undefined;
            images?: string[] | undefined;
            marketing_price?: string | undefined;
            min_price?: string | undefined;
        }, {
            offer_id: string;
            name: string;
            id: number;
            price?: string | undefined;
            stocks?: {
                present: number;
                reserved: number;
            } | undefined;
            barcode?: string | undefined;
            primary_image?: string | undefined;
            images?: string[] | undefined;
            marketing_price?: string | undefined;
            min_price?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        items: {
            offer_id: string;
            name: string;
            id: number;
            price?: string | undefined;
            stocks?: {
                present: number;
                reserved: number;
            } | undefined;
            barcode?: string | undefined;
            primary_image?: string | undefined;
            images?: string[] | undefined;
            marketing_price?: string | undefined;
            min_price?: string | undefined;
        }[];
    }, {
        items: {
            offer_id: string;
            name: string;
            id: number;
            price?: string | undefined;
            stocks?: {
                present: number;
                reserved: number;
            } | undefined;
            barcode?: string | undefined;
            primary_image?: string | undefined;
            images?: string[] | undefined;
            marketing_price?: string | undefined;
            min_price?: string | undefined;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    result: {
        items: {
            offer_id: string;
            name: string;
            id: number;
            price?: string | undefined;
            stocks?: {
                present: number;
                reserved: number;
            } | undefined;
            barcode?: string | undefined;
            primary_image?: string | undefined;
            images?: string[] | undefined;
            marketing_price?: string | undefined;
            min_price?: string | undefined;
        }[];
    };
}, {
    result: {
        items: {
            offer_id: string;
            name: string;
            id: number;
            price?: string | undefined;
            stocks?: {
                present: number;
                reserved: number;
            } | undefined;
            barcode?: string | undefined;
            primary_image?: string | undefined;
            images?: string[] | undefined;
            marketing_price?: string | undefined;
            min_price?: string | undefined;
        }[];
    };
}>;
export declare const OzonPriceItemSchema: z.ZodObject<{
    product_id: z.ZodNumber;
    offer_id: z.ZodString;
    price: z.ZodObject<{
        price: z.ZodString;
        old_price: z.ZodOptional<z.ZodString>;
        marketing_price: z.ZodOptional<z.ZodString>;
        min_price: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        price: string;
        marketing_price?: string | undefined;
        min_price?: string | undefined;
        old_price?: string | undefined;
    }, {
        price: string;
        marketing_price?: string | undefined;
        min_price?: string | undefined;
        old_price?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    price: {
        price: string;
        marketing_price?: string | undefined;
        min_price?: string | undefined;
        old_price?: string | undefined;
    };
    product_id: number;
    offer_id: string;
}, {
    price: {
        price: string;
        marketing_price?: string | undefined;
        min_price?: string | undefined;
        old_price?: string | undefined;
    };
    product_id: number;
    offer_id: string;
}>;
export declare const OzonPricesResponseSchema: z.ZodObject<{
    result: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            product_id: z.ZodNumber;
            offer_id: z.ZodString;
            price: z.ZodObject<{
                price: z.ZodString;
                old_price: z.ZodOptional<z.ZodString>;
                marketing_price: z.ZodOptional<z.ZodString>;
                min_price: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            }, {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            price: {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            };
            product_id: number;
            offer_id: string;
        }, {
            price: {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            };
            product_id: number;
            offer_id: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        items: {
            price: {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            };
            product_id: number;
            offer_id: string;
        }[];
    }, {
        items: {
            price: {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            };
            product_id: number;
            offer_id: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    result: {
        items: {
            price: {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            };
            product_id: number;
            offer_id: string;
        }[];
    };
}, {
    result: {
        items: {
            price: {
                price: string;
                marketing_price?: string | undefined;
                min_price?: string | undefined;
                old_price?: string | undefined;
            };
            product_id: number;
            offer_id: string;
        }[];
    };
}>;
export declare const OzonUpdateStockRequestSchema: z.ZodObject<{
    stocks: z.ZodArray<z.ZodObject<{
        offer_id: z.ZodString;
        product_id: z.ZodNumber;
        stock: z.ZodNumber;
        warehouse_id: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        product_id: number;
        offer_id: string;
        stock: number;
        warehouse_id: number;
    }, {
        product_id: number;
        offer_id: string;
        stock: number;
        warehouse_id: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stocks: {
        product_id: number;
        offer_id: string;
        stock: number;
        warehouse_id: number;
    }[];
}, {
    stocks: {
        product_id: number;
        offer_id: string;
        stock: number;
        warehouse_id: number;
    }[];
}>;
export declare const UserDocSchema: z.ZodObject<{
    telegramId: z.ZodNumber;
    username: z.ZodNullable<z.ZodString>;
    firstName: z.ZodString;
    lastName: z.ZodNullable<z.ZodString>;
    photoUrl: z.ZodNullable<z.ZodString>;
    subscriptionActive: z.ZodBoolean;
    subscriptionExpiresAt: z.ZodNullable<z.ZodDate>;
    subscriptionPlan: z.ZodNullable<z.ZodEnum<["trial", "basic", "pro"]>>;
    protectionEnabled: z.ZodBoolean;
    defenseMode: z.ZodEnum<["zero_stock", "price_correction"]>;
    wbKeyRef: z.ZodNullable<z.ZodString>;
    ozonKeyRef: z.ZodNullable<z.ZodString>;
    totalProducts: z.ZodNumber;
    triggeredToday: z.ZodNumber;
    savedAmount: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastActiveAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    updatedAt: Date;
    telegramId: number;
    username: string | null;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    subscriptionActive: boolean;
    subscriptionExpiresAt: Date | null;
    subscriptionPlan: "trial" | "basic" | "pro" | null;
    protectionEnabled: boolean;
    defenseMode: "zero_stock" | "price_correction";
    wbKeyRef: string | null;
    ozonKeyRef: string | null;
    totalProducts: number;
    triggeredToday: number;
    savedAmount: number;
    createdAt: Date;
    lastActiveAt: Date;
}, {
    updatedAt: Date;
    telegramId: number;
    username: string | null;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    subscriptionActive: boolean;
    subscriptionExpiresAt: Date | null;
    subscriptionPlan: "trial" | "basic" | "pro" | null;
    protectionEnabled: boolean;
    defenseMode: "zero_stock" | "price_correction";
    wbKeyRef: string | null;
    ozonKeyRef: string | null;
    totalProducts: number;
    triggeredToday: number;
    savedAmount: number;
    createdAt: Date;
    lastActiveAt: Date;
}>;
export type UserDoc = z.infer<typeof UserDocSchema>;
export declare const ProductDocSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodNumber;
    productId: z.ZodString;
    nmId: z.ZodOptional<z.ZodNumber>;
    offerId: z.ZodOptional<z.ZodString>;
    vendorCode: z.ZodString;
    barcode: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    imageUrl: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    currentPrice: z.ZodNumber;
    minPrice: z.ZodNumber;
    originalPrice: z.ZodOptional<z.ZodNumber>;
    stock: z.ZodNumber;
    marketplace: z.ZodEnum<["WB", "Ozon"]>;
    status: z.ZodEnum<["active", "protected", "triggered", "disabled"]>;
    isMonitored: z.ZodBoolean;
    lastCheckedAt: z.ZodDate;
    lastTriggeredAt: z.ZodNullable<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    status: "active" | "protected" | "triggered" | "disabled";
    vendorCode: string;
    title: string;
    updatedAt: Date;
    id: string;
    stock: number;
    createdAt: Date;
    userId: number;
    productId: string;
    imageUrl: string;
    currentPrice: number;
    minPrice: number;
    marketplace: "WB" | "Ozon";
    isMonitored: boolean;
    lastCheckedAt: Date;
    lastTriggeredAt: Date | null;
    brand?: string | undefined;
    nmId?: number | undefined;
    barcode?: string | undefined;
    offerId?: string | undefined;
    category?: string | undefined;
    originalPrice?: number | undefined;
}, {
    status: "active" | "protected" | "triggered" | "disabled";
    vendorCode: string;
    title: string;
    updatedAt: Date;
    id: string;
    stock: number;
    createdAt: Date;
    userId: number;
    productId: string;
    imageUrl: string;
    currentPrice: number;
    minPrice: number;
    marketplace: "WB" | "Ozon";
    isMonitored: boolean;
    lastCheckedAt: Date;
    lastTriggeredAt: Date | null;
    brand?: string | undefined;
    nmId?: number | undefined;
    barcode?: string | undefined;
    offerId?: string | undefined;
    category?: string | undefined;
    originalPrice?: number | undefined;
}>;
export type ProductDoc = z.infer<typeof ProductDocSchema>;
export declare const LogEntryDocSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodNumber;
    type: z.ZodEnum<["price_drop", "defense_triggered", "sync", "error", "info"]>;
    productId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    message: z.ZodString;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    isRead: z.ZodBoolean;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "price_drop" | "defense_triggered" | "sync" | "error" | "info";
    title: string;
    id: string;
    createdAt: Date;
    userId: number;
    metadata: Record<string, unknown>;
    isRead: boolean;
    productId?: string | undefined;
}, {
    message: string;
    type: "price_drop" | "defense_triggered" | "sync" | "error" | "info";
    title: string;
    id: string;
    createdAt: Date;
    userId: number;
    metadata: Record<string, unknown>;
    isRead: boolean;
    productId?: string | undefined;
}>;
export type LogEntryDoc = z.infer<typeof LogEntryDocSchema>;
export declare const TelegramInitDataSchema: z.ZodObject<{
    query_id: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodNumber;
        first_name: z.ZodString;
        last_name: z.ZodOptional<z.ZodString>;
        username: z.ZodOptional<z.ZodString>;
        language_code: z.ZodOptional<z.ZodString>;
        is_premium: z.ZodOptional<z.ZodBoolean>;
        photo_url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        first_name: string;
        username?: string | undefined;
        last_name?: string | undefined;
        language_code?: string | undefined;
        is_premium?: boolean | undefined;
        photo_url?: string | undefined;
    }, {
        id: number;
        first_name: string;
        username?: string | undefined;
        last_name?: string | undefined;
        language_code?: string | undefined;
        is_premium?: boolean | undefined;
        photo_url?: string | undefined;
    }>>;
    auth_date: z.ZodNumber;
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    auth_date: number;
    hash: string;
    query_id?: string | undefined;
    user?: {
        id: number;
        first_name: string;
        username?: string | undefined;
        last_name?: string | undefined;
        language_code?: string | undefined;
        is_premium?: boolean | undefined;
        photo_url?: string | undefined;
    } | undefined;
}, {
    auth_date: number;
    hash: string;
    query_id?: string | undefined;
    user?: {
        id: number;
        first_name: string;
        username?: string | undefined;
        last_name?: string | undefined;
        language_code?: string | undefined;
        is_premium?: boolean | undefined;
        photo_url?: string | undefined;
    } | undefined;
}>;
export type TelegramInitData = z.infer<typeof TelegramInitDataSchema>;
export declare const WorkerTaskPayloadSchema: z.ZodObject<{
    userId: z.ZodNumber;
    marketplace: z.ZodOptional<z.ZodEnum<["WB", "Ozon"]>>;
    productIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    priority: z.ZodDefault<z.ZodEnum<["normal", "high"]>>;
}, "strip", z.ZodTypeAny, {
    userId: number;
    priority: "normal" | "high";
    marketplace?: "WB" | "Ozon" | undefined;
    productIds?: string[] | undefined;
}, {
    userId: number;
    marketplace?: "WB" | "Ozon" | undefined;
    productIds?: string[] | undefined;
    priority?: "normal" | "high" | undefined;
}>;
export type WorkerTaskPayload = z.infer<typeof WorkerTaskPayloadSchema>;
export declare const ApiKeyInputSchema: z.ZodObject<{
    marketplace: z.ZodEnum<["WB", "Ozon"]>;
    apiKey: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    marketplace: "WB" | "Ozon";
    apiKey: string;
    clientId?: string | undefined;
}, {
    marketplace: "WB" | "Ozon";
    apiKey: string;
    clientId?: string | undefined;
}>;
export type ApiKeyInput = z.infer<typeof ApiKeyInputSchema>;
export declare const DefenseActionResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    action: z.ZodEnum<["zero_stock", "price_correction", "none"]>;
    productId: z.ZodString;
    marketplace: z.ZodEnum<["WB", "Ozon"]>;
    oldPrice: z.ZodNumber;
    newPrice: z.ZodOptional<z.ZodNumber>;
    oldStock: z.ZodOptional<z.ZodNumber>;
    newStock: z.ZodOptional<z.ZodNumber>;
    message: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    productId: string;
    marketplace: "WB" | "Ozon";
    success: boolean;
    action: "zero_stock" | "price_correction" | "none";
    oldPrice: number;
    error?: string | undefined;
    newPrice?: number | undefined;
    oldStock?: number | undefined;
    newStock?: number | undefined;
}, {
    message: string;
    productId: string;
    marketplace: "WB" | "Ozon";
    success: boolean;
    action: "zero_stock" | "price_correction" | "none";
    oldPrice: number;
    error?: string | undefined;
    newPrice?: number | undefined;
    oldStock?: number | undefined;
    newStock?: number | undefined;
}>;
export type DefenseActionResult = z.infer<typeof DefenseActionResultSchema>;
//# sourceMappingURL=index.d.ts.map