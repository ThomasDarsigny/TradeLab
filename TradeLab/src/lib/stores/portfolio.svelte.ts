export interface Position {
	symbol: string;
	name: string;
	quantity: number;
	averagePrice: number;
	currentPrice: number;
}

export interface Transaction {
	id: string;
	type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
	symbol?: string;
	quantity?: number;
	price?: number;
	amount: number;
	date: Date;
}

class PortfolioStore {
	cash = $state(100000);
	positions = $state<Position[]>([]);
	transactions = $state<Transaction[]>([]);

	get positionsValue() {
		return this.positions.reduce((total, pos) => {
			return total + pos.quantity * pos.currentPrice;
		}, 0);
	}

	get totalValue() {
		return this.cash + this.positionsValue;
	}

	get totalGainLoss() {
		return this.positions.reduce((total, pos) => {
			const invested = pos.quantity * pos.averagePrice;
			const current = pos.quantity * pos.currentPrice;
			return total + (current - invested);
		}, 0);
	}

	get totalGainLossPercent() {
		const invested = this.totalValue - this.totalGainLoss;
		return invested > 0 ? (this.totalGainLoss / invested) * 100 : 0;
	}

	/**
	 * Déposer de l'argent
	 */
	deposit(amount: number) {
		if (amount <= 0) {
			throw new Error('Le montant doit être positif');
		}

		this.cash += amount;
		this.transactions.push({
			id: crypto.randomUUID(),
			type: 'deposit',
			amount,
			date: new Date()
		});
	}

	/**
	 * Retirer de l'argent
	 */
	withdraw(amount: number) {
		if (amount <= 0) {
			throw new Error('Le montant doit être positif');
		}

		if (amount > this.cash) {
			throw new Error('Fonds insuffisants');
		}

		this.cash -= amount;
		this.transactions.push({
			id: crypto.randomUUID(),
			type: 'withdrawal',
			amount: -amount,
			date: new Date()
		});
	}

	/**
	 * Acheter une action
	 */
	buyStock(symbol: string, name: string, quantity: number, price: number) {
		if (quantity <= 0) {
			throw new Error('La quantité doit être positive');
		}

		const totalCost = quantity * price;
		
		if (totalCost > this.cash) {
			throw new Error('Fonds insuffisants pour cet achat');
		}

		const existingPosition = this.positions.find(p => p.symbol === symbol);

		if (existingPosition) {
			const totalQuantity = existingPosition.quantity + quantity;
			const totalInvested = (existingPosition.quantity * existingPosition.averagePrice) + totalCost;
			existingPosition.quantity = totalQuantity;
			existingPosition.averagePrice = totalInvested / totalQuantity;
			existingPosition.currentPrice = price;
		} else {
			this.positions.push({
				symbol,
				name,
				quantity,
				averagePrice: price,
				currentPrice: price
			});
		}

		this.cash -= totalCost;

		this.transactions.push({
			id: crypto.randomUUID(),
			type: 'buy',
			symbol,
			quantity,
			price,
			amount: -totalCost,
			date: new Date()
		});
	}

	/**
	 * Vendre une action
	 */
	sellStock(symbol: string, quantity: number, price: number) {
		if (quantity <= 0) {
			throw new Error('La quantité doit être positive');
		}

		const position = this.positions.find(p => p.symbol === symbol);

		if (!position) {
			throw new Error(`Aucun titre trouvé pour ${symbol}`);
		}

		if (quantity > position.quantity) {
			throw new Error(`Quantité insuffisante (vous avez ${position.quantity} actions)`);
		}

		const totalValue = quantity * price;

		if (quantity === position.quantity) {
			this.positions = this.positions.filter(p => p.symbol !== symbol);
		} else {
			position.quantity -= quantity;
			position.currentPrice = price;
		}

		this.cash += totalValue;

		this.transactions.push({
			id: crypto.randomUUID(),
			type: 'sell',
			symbol,
			quantity,
			price,
			amount: totalValue,
			date: new Date()
		});
	}

	/**
	 * MAJ le prix actuel d'une position
	 */
	updatePrice(symbol: string, price: number) {
		const position = this.positions.find(p => p.symbol === symbol);
		if (position) {
			position.currentPrice = price;
		}
	}

	/**
	 * MAJ les prix de toutes les positions
	 */
	updateAllPrices(prices: Record<string, number>) {
		this.positions.forEach(position => {
			if (prices[position.symbol]) {
				position.currentPrice = prices[position.symbol];
			}
		});
	}

	/**
	 * Obtenir une position spécifique
	 */
	getPosition(symbol: string): Position | undefined {
		return this.positions.find(p => p.symbol === symbol);
	}

	/**
	 * Réinitialiser le portefeuille
	 */
	reset() {
		this.cash = 100000;
		this.positions = [];
		this.transactions = [];
	}
}

export const portfolio = new PortfolioStore();
