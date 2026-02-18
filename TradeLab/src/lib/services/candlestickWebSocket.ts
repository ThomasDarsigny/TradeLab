export interface CandlestickUpdate {
	symbol: string;
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	timestamp: string;
}

export class CandlestickWebSocket {
	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private subscribers: Map<string, Set<(data: CandlestickUpdate) => void>> = new Map();
	private connectionListeners: Set<(connected: boolean) => void> = new Set();
	private url: string;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;

	constructor(url?: string) {
		if (url) {
			this.url = url;
		} else {
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const host = window.location.hostname;
			const port = '8001';
			this.url = `${protocol}//${host}:${port}/ws/candlesticks`;
		}
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.url);

				this.ws.onopen = () => {
					this.reconnectAttempts = 0;
					
					const symbols = Array.from(this.subscribers.keys());
					if (symbols.length > 0) {
						this.send({ action: 'subscribe', symbols });
					}
					
					this.connectionListeners.forEach(listener => listener(true));
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						this.handleMessage(data);
					} catch (error) {
						console.error('Error parsing WebSocket message:', error);
					}
				};

				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					reject(error);
				};

				this.ws.onclose = () => {
					this.connectionListeners.forEach(listener => listener(false));
					this.handleReconnect();
				};
			} catch (error) {
				reject(error);
			}
		});
	}

	private handleMessage(data: any) {
		if (data.type === 'candlestick_update' && data.symbol) {
			const callbacks = this.subscribers.get(data.symbol);
			if (callbacks) {
				const update: CandlestickUpdate = {
					symbol: data.symbol,
					time: data.time,
					open: data.open,
					high: data.high,
					low: data.low,
					close: data.close,
					volume: data.volume || 0,
					timestamp: data.timestamp
				};
				callbacks.forEach((callback) => callback(update));
			}
		}
	}

	private handleReconnect() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
			
			this.reconnectTimer = setTimeout(() => {
				this.connect().catch(() => undefined);
			}, delay);
		}
	}

	private send(data: any) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		}
	}

	subscribe(symbol: string, callback: (data: CandlestickUpdate) => void) {
		if (!this.subscribers.has(symbol)) {
			this.subscribers.set(symbol, new Set());
		}
		this.subscribers.get(symbol)?.add(callback);

		if (this.ws?.readyState === WebSocket.OPEN) {
			this.send({ action: 'subscribe', symbols: [symbol] });
		}
	}

	unsubscribe(symbol: string, callback?: (data: CandlestickUpdate) => void) {
		if (callback) {
			this.subscribers.get(symbol)?.delete(callback);
		} else {
			this.subscribers.delete(symbol);
		}

		if (this.ws?.readyState === WebSocket.OPEN) {
			this.send({ action: 'unsubscribe', symbols: [symbol] });
		}
	}

	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.subscribers.clear();
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	onConnectionChange(listener: (connected: boolean) => void) {
		this.connectionListeners.add(listener);
		listener(this.isConnected());
	}

	offConnectionChange(listener: (connected: boolean) => void) {
		this.connectionListeners.delete(listener);
	}

	private static instance: CandlestickWebSocket | null = null;
	
	static getInstance(): CandlestickWebSocket {
		if (!CandlestickWebSocket.instance) {
			CandlestickWebSocket.instance = new CandlestickWebSocket();
		}
		return CandlestickWebSocket.instance;
	}
}

export function getCandlestickWebSocket(): CandlestickWebSocket {
	return CandlestickWebSocket.getInstance();
}
