export interface AlbionDataClientHistoricalMarketData {
	item_count: number;
	avg_price: number;
	timestamp: string;
}

export interface AlbionDataClientHistoricalMarket {
	location: string;
	item_id: string;
	quality: number;
	data: AlbionDataClientHistoricalMarketData[];
}

export type AlbionDataClientHistoricalReponse = AlbionDataClientHistoricalMarket[];

export interface AlbionDataClientCurrentMarketData {
	item_id: string;
	city: string;
	quality: number;
	sell_price_min: number;
	sell_price_min_date: string;
	sell_price_max: number;
	sell_price_max_date: string;
	buy_price_min: number;
	buy_price_min_date: string;
	buy_price_max: number;
	buy_price_max_date: string;
}

export type AlbionDataClientCurrentResponse = AlbionDataClientCurrentMarketData[];

export enum AlbionItemCategory {
	MAIN_ONE_HANDED = '_MAIN_',
	MAIN_TWO_HANDED = '_2H_',
	HELMET = '_HEAD_',
	ARMOR = '_ARMOR_',
	SHOES = '_SHOES_',
	OFFHAND = '_OFF_'
}
