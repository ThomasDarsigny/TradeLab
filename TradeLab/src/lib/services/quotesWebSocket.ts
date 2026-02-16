export class QuotesWebSocket {
	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private subscribers: Map<string, Set<(data: any) => void>> = new Map();
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
			const port = '8000';
			this.url = `${protocol}//${host}:${port}/ws/quotes`;
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
						this.send({ symbols });
					} else {
						this.send({ symbols: [] });
					}
					
					this.connectionListeners.forEach(listener => listener(true));
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						this.handleMessage(data);
					} catch (error) {
					}
				};

				this.ws.onerror = (error) => {
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
		if (data.type === 'quote_update' && data.symbol) {
			const callbacks = this.subscribers.get(data.symbol);
			if (callbacks) {
				callbacks.forEach((callback) => callback(data));
			}
		} else if (data.type === 'subscribed' || data.type === 'unsubscribed') {
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

	subscribe(symbol: string, callback: (data: any) => void) {
		if (!this.subscribers.has(symbol)) {
			this.subscribers.set(symbol, new Set());
		}
		this.subscribers.get(symbol)?.add(callback);

		if (this.ws?.readyState === WebSocket.OPEN) {
			const allSymbols = Array.from(this.subscribers.keys());
			this.send({ symbols: allSymbols });
		}
	}

	unsubscribe(symbol: string, callback?: (data: any) => void) {
		if (callback) {
			this.subscribers.get(symbol)?.delete(callback);
		} else {
			this.subscribers.delete(symbol);
		}

		if (this.ws?.readyState === WebSocket.OPEN) {
			const allSymbols = Array.from(this.subscribers.keys());
			if (allSymbols.length > 0) {
				this.send({ symbols: allSymbols });
			}
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

	private static instance: QuotesWebSocket | null = null;
	
	static getInstance(): QuotesWebSocket {
		if (!QuotesWebSocket.instance) {
			QuotesWebSocket.instance = new QuotesWebSocket();
		}
		return QuotesWebSocket.instance;
	}
}

export function getQuotesWebSocket(): QuotesWebSocket {
	return QuotesWebSocket.getInstance();
}
