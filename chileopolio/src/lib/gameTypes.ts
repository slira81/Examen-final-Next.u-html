export interface Player {
  id: number;
  name: string;
  token: string;
  color: string;
  position: number;
  money: number;
  ownedSquares: number[];
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
}

export type SquareType =
  | 'go' | 'property' | 'railroad' | 'utility'
  | 'tax' | 'chance' | 'community_chest'
  | 'jail' | 'free_parking' | 'go_to_jail';

export interface BoardSquare {
  id: number;
  name: string;
  type: SquareType;
  price?: number;
  color?: string;
  rent?: number[];
  houseCost?: number;
  mortgage?: number;
  taxAmount?: number;
  description: string;
}

export interface PropertyState {
  squareId: number;
  ownerId: number | null;
  houses: number;
  mortgaged: boolean;
}

export type CardEffect =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'collect_from_each'; amount: number }
  | { type: 'pay_each'; amount: number }
  | { type: 'move_to'; position: number; collectGo: boolean }
  | { type: 'move_back'; spaces: number }
  | { type: 'go_to_jail' }
  | { type: 'get_out_of_jail_card' }
  | { type: 'pay_per_building'; houseRate: number; hotelRate: number };

export interface GameCard {
  id: number;
  type: 'chance' | 'community_chest';
  text: string;
  effect: CardEffect;
}

export type GamePhase =
  | 'setup'
  | 'pre_roll'
  | 'in_jail'
  | 'buy_offer'
  | 'card_shown'
  | 'pay_rent'
  | 'manage'
  | 'game_over';

export interface PendingRent {
  amount: number;
  toPlayerId: number;
  squareName: string;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  dice: [number, number];
  doublesCount: number;
  properties: PropertyState[];
  chanceCardIndex: number;
  communityCardIndex: number;
  log: string[];
  winner: Player | null;
  freeParking: number;
  pendingCard: GameCard | null;
  pendingRent: PendingRent | null;
  pendingBuySquareId: number | null;
  lastDiceRoll: number;
}
