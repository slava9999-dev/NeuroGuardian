"""
NeuroAgent Core - Wildberries Tools
Инструменты для работы с WB API через LangChain
"""

import httpx
from typing import Optional
from datetime import datetime, timedelta
from langchain.tools import tool
from pydantic import BaseModel, Field


class WBSearchInput(BaseModel):
    """Входные данные для поиска товаров"""
    query: str = Field(description="Поисковый запрос (название товара)")
    brand: Optional[str] = Field(None, description="Фильтр по бренду")
    limit: int = Field(20, description="Максимум товаров в ответе")


class WBPriceUpdateInput(BaseModel):
    """Входные данные для обновления цен"""
    nm_ids: list[int] = Field(description="Список артикулов (nmId)")
    price_change: int = Field(description="Изменение цены в рублях (+/-)")


class WBSalesInput(BaseModel):
    """Входные данные для получения продаж"""
    date_from: str = Field(description="Дата начала (YYYY-MM-DD)")
    date_to: str = Field(description="Дата окончания (YYYY-MM-DD)")
    group_by: str = Field("day", description="Группировка: day/week/month")


class WildberriesTools:
    """
    Набор инструментов для работы с Wildberries Seller API.
    
    Использование:
    1. Создаём экземпляр с API ключом
    2. Получаем tools через get_tools()
    3. Передаём в LangChain агента
    """
    
    BASE_URL = "https://seller-api.wildberries.ru"
    CONTENT_URL = "https://content-api.wildberries.ru"
    STATISTICS_URL = "https://statistics-api.wildberries.ru"
    
    def __init__(self, api_key: str):
        """
        Инициализация с API ключом.
        
        Args:
            api_key: WB Seller API ключ
        """
        self.api_key = api_key
        self.headers = {"Authorization": api_key}
    
    async def _make_request(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> dict:
        """Выполнение HTTP запроса к WB API"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                url,
                headers=self.headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()
    
    # ========================================
    # TOOLS
    # ========================================
    
    def get_tools(self) -> list:
        """Возвращает список tools для LangChain"""
        
        @tool("wb_search_products")
        async def search_products(query: str, brand: str = None, limit: int = 20) -> dict:
            """
            Поиск товаров продавца на Wildberries.
            
            Используй для команд типа:
            - "найди все кроссовки"
            - "покажи мои товары Nike"
            - "список товаров в категории обувь"
            
            Args:
                query: Поисковый запрос (название товара)
                brand: Фильтр по бренду (опционально)
                limit: Максимум товаров в ответе
            """
            try:
                data = await self._make_request(
                    "POST",
                    f"{self.CONTENT_URL}/content/v2/get/cards/list",
                    json={
                        "settings": {
                            "cursor": {"limit": limit},
                            "filter": {"textSearch": query}
                        }
                    }
                )
                
                cards = data.get("cards", [])
                
                # Фильтрация по бренду
                if brand:
                    cards = [
                        c for c in cards 
                        if brand.lower() in c.get("brand", "").lower()
                    ]
                
                return {
                    "found_count": len(cards),
                    "products": [
                        {
                            "nm_id": c.get("nmID"),
                            "name": c.get("title", "Без названия"),
                            "brand": c.get("brand", ""),
                            "vendor_code": c.get("vendorCode", ""),
                        }
                        for c in cards[:limit]
                    ]
                }
            except Exception as e:
                return {"error": str(e), "found_count": 0, "products": []}
        
        @tool("wb_get_sales")
        async def get_sales(date_from: str, date_to: str) -> dict:
            """
            Получить статистику продаж за период.
            
            Используй для команд типа:
            - "продажи за сегодня"
            - "сколько продал за неделю"
            - "выручка за декабрь"
            
            Args:
                date_from: Дата начала (YYYY-MM-DD)
                date_to: Дата окончания (YYYY-MM-DD)
            """
            try:
                data = await self._make_request(
                    "GET",
                    f"{self.STATISTICS_URL}/api/v1/supplier/sales",
                    params={"dateFrom": date_from, "dateTo": date_to}
                )
                
                if not data:
                    return {
                        "period": f"{date_from} — {date_to}",
                        "total_orders": 0,
                        "total_revenue": 0,
                        "message": "Нет продаж за этот период"
                    }
                
                total_revenue = sum(s.get("finishedPrice", 0) for s in data)
                total_orders = len(data)
                
                # Топ товаров
                from collections import Counter
                product_counts = Counter(s.get("nmId") for s in data)
                top_products = product_counts.most_common(5)
                
                return {
                    "period": f"{date_from} — {date_to}",
                    "total_orders": total_orders,
                    "total_revenue": total_revenue,
                    "average_order": round(total_revenue / total_orders, 2) if total_orders else 0,
                    "top_products": [{"nm_id": p[0], "orders": p[1]} for p in top_products]
                }
            except Exception as e:
                return {"error": str(e)}
        
        @tool("wb_get_stocks")
        async def get_stocks() -> dict:
            """
            Получить остатки товаров на складах WB.
            
            Используй для команд типа:
            - "покажи остатки"
            - "какие товары заканчиваются"
            - "сколько на складе"
            """
            try:
                data = await self._make_request(
                    "GET",
                    f"{self.STATISTICS_URL}/api/v1/supplier/stocks",
                    params={"dateFrom": datetime.now().strftime("%Y-%m-%d")}
                )
                
                if not data:
                    return {"total_items": 0, "stocks": []}
                
                # Группировка по товарам
                from collections import defaultdict
                by_product = defaultdict(int)
                for item in data:
                    by_product[item.get("nmId")] += item.get("quantity", 0)
                
                total = sum(by_product.values())
                low_stock = [(k, v) for k, v in by_product.items() if v < 10]
                
                return {
                    "total_items": total,
                    "products_count": len(by_product),
                    "low_stock_count": len(low_stock),
                    "low_stock": [{"nm_id": k, "quantity": v} for k, v in low_stock[:10]],
                }
            except Exception as e:
                return {"error": str(e)}
        
        @tool("wb_update_prices")
        async def update_prices(nm_ids: list, price_change: int) -> dict:
            """
            Изменить цены на товары.
            
            ⚠️ ВАЖНО: Эта операция требует подтверждения пользователя!
            Не выполняй напрямую — верни запрос на подтверждение.
            
            Args:
                nm_ids: Список артикулов (nmId)
                price_change: Изменение цены в рублях (+ повысить, - понизить)
            """
            # Эта функция НЕ выполняет изменения напрямую!
            # Она возвращает план для подтверждения
            return {
                "action": "REQUIRES_CONFIRMATION",
                "operation": "price_update",
                "details": {
                    "products_count": len(nm_ids),
                    "nm_ids": nm_ids[:10],  # Показываем первые 10
                    "price_change": price_change,
                },
                "confirmation_message": (
                    f"⚠️ Изменить цену на {price_change:+d} ₽ "
                    f"для {len(nm_ids)} товаров?\n\n"
                    "Напишите 'да' для подтверждения или 'нет' для отмены."
                )
            }
        
        return [
            search_products,
            get_sales,
            get_stocks,
            update_prices,
        ]


# Фабрика для создания tools
def create_wb_tools(api_key: str) -> list:
    """
    Создать набор WB tools с указанным API ключом.
    
    Args:
        api_key: Wildberries Seller API ключ
        
    Returns:
        Список LangChain tools
    """
    wb = WildberriesTools(api_key)
    return wb.get_tools()
