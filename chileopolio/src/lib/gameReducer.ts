import type { GameState, Player, GameCard, PropertyState } from './gameTypes';
import {
  BOARD_SQUARES, COLOR_GROUPS, RAILROAD_IDS, UTILITY_IDS,
  COMMUNITY_CHEST_CARDS, CHANCE_CARDS,
  PLAYER_TOKENS, PLAYER_COLORS,
  GO_SALARY, JAIL_POSITION, STARTING_MONEY,
} from './boardData';

export type GameAction =
  | { type: 'START_GAME'; playerCount: number; names: string[] }
  | { type: 'ROLL_DICE' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'DECLINE_PROPERTY' }
  | { type: 'ACKNOWLEDGE_CARD' }
  | { type: 'ACKNOWLEDGE_RENT' }
  | { type: 'END_TURN' }
  | { type: 'BUILD_HOUSE'; squareId: number }
  | { type: 'SELL_HOUSE'; squareId: number }
  | { type: 'MORTGAGE'; squareId: number }
  | { type: 'UNMORTGAGE'; squareId: number }
  | { type: 'PAY_BAIL' }
  | { type: 'ROLL_FOR_BAIL' }
  | { type: 'USE_JAIL_CARD' };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function initProperties(): PropertyState[] {
  return BOARD_SQUARES
    .filter(s => s.type === 'property' || s.type === 'railroad' || s.type === 'utility')
    .map(s => ({ squareId: s.id, ownerId: null, houses: 0, mortgaged: false }));
}

function getProp(state: GameState, squareId: number): PropertyState | undefined {
  return state.properties.find(p => p.squareId === squareId);
}

function ownsFullColorGroup(state: GameState, playerId: number, color: string): boolean {
  const group = COLOR_GROUPS[color] ?? [];
  return group.every(id => {
    const p = getProp(state, id);
    return p?.ownerId === playerId && !p.mortgaged;
  });
}

function countRailroadsOwned(state: GameState, playerId: number): number {
  return RAILROAD_IDS.filter(id => getProp(state, id)?.ownerId === playerId).length;
}

function countUtilitiesOwned(state: GameState, playerId: number): number {
  return UTILITY_IDS.filter(id => getProp(state, id)?.ownerId === playerId).length;
}

function calculateRent(state: GameState, squareId: number, diceTotal: number, landingPlayerId: number): number {
  const sq = BOARD_SQUARES[squareId];
  const prop = getProp(state, squareId);
  if (!prop || prop.ownerId === null || prop.ownerId === landingPlayerId || prop.mortgaged) return 0;

  if (sq.type === 'railroad') {
    const count = countRailroadsOwned(state, prop.ownerId);
    return (sq.rent ?? [25, 50, 100, 200])[count - 1];
  }
  if (sq.type === 'utility') {
    const count = countUtilitiesOwned(state, prop.ownerId);
    return diceTotal * ((sq.rent ?? [4, 10])[count - 1]);
  }
  if (sq.type === 'property' && sq.rent) {
    const rentIndex = prop.houses;
    let base = sq.rent[rentIndex];
    if (prop.houses === 0 && sq.color && ownsFullColorGroup(state, prop.ownerId, sq.color)) {
      base = base * 2;
    }
    return base;
  }
  return 0;
}

function log(state: GameState, msg: string): GameState {
  return { ...state, log: [msg, ...state.log].slice(0, 30) };
}

function nextPlayerIndex(state: GameState): number {
  const total = state.players.length;
  let next = (state.currentPlayerIndex + 1) % total;
  let tries = 0;
  while (state.players[next].bankrupt && tries < total) {
    next = (next + 1) % total;
    tries++;
  }
  return next;
}

function activePlayers(state: GameState): Player[] {
  return state.players.filter(p => !p.bankrupt);
}

function checkWinner(state: GameState): Player | null {
  const alive = activePlayers(state);
  if (alive.length === 1) return alive[0];
  return null;
}

function payFromPlayer(
  state: GameState,
  fromId: number,
  toId: number | 'bank' | 'parking',
  amount: number
): GameState {
  const players = state.players.map(p => {
    if (p.id === fromId) return { ...p, money: p.money - amount };
    if (toId !== 'bank' && toId !== 'parking' && p.id === toId) return { ...p, money: p.money + amount };
    return p;
  });
  let freeParking = state.freeParking;
  if (toId === 'parking') freeParking += amount;
  return { ...state, players, freeParking };
}

function moveTo(state: GameState, playerId: number, newPos: number, collectGo: boolean): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const oldPos = player.position;
  let newState = state;
  if (collectGo && newPos <= oldPos && newPos !== oldPos) {
    newState = payFromPlayer(newState, -1, playerId, GO_SALARY);
    newState = log(newState, `${player.name} pasa por ¡Pal Carrete! y cobra M$${GO_SALARY}`);
  }
  const players = newState.players.map(p =>
    p.id === playerId ? { ...p, position: newPos } : p
  );
  return { ...newState, players };
}

function processLanding(state: GameState): GameState {
  const player = state.players[state.currentPlayerIndex];
  const sq = BOARD_SQUARES[player.position];
  let s = state;

  switch (sq.type) {
    case 'go':
      s = payFromPlayer(s, -1, player.id, GO_SALARY);
      s = log(s, `${player.name} cae en ¡Pal Carrete! Cobra M$${GO_SALARY}`);
      return { ...s, phase: 'pre_roll' };

    case 'free_parking': {
      const amount = s.freeParking;
      if (amount > 0) {
        s = payFromPlayer(s, -1, player.id, amount);
        s = { ...s, freeParking: 0 };
        s = log(s, `${player.name} descansa la pera y recoge M$${amount} del pozo`);
      } else {
        s = log(s, `${player.name} descansa la pera. ¡No hay nada pa' cobrar!`);
      }
      return { ...s, phase: 'pre_roll' };
    }

    case 'jail':
      s = log(s, `${player.name} está de visita al talego, tranquilo...`);
      return { ...s, phase: 'pre_roll' };

    case 'go_to_jail': {
      const players = s.players.map(p =>
        p.id === player.id ? { ...p, position: JAIL_POSITION, inJail: true, jailTurns: 0 } : p
      );
      s = { ...s, players };
      s = log(s, `¡${player.name} va al talego! No pases por ¡Pal Carrete!`);
      return { ...s, phase: 'pre_roll' };
    }

    case 'tax': {
      const amount = sq.taxAmount ?? 0;
      s = payFromPlayer(s, player.id, 'parking', amount);
      s = log(s, `${player.name} paga M$${amount} de impuestos. ¡El SII nunca falla!`);
      const bankruptPlayer = s.players.find(p => p.id === player.id);
      if (bankruptPlayer && bankruptPlayer.money < 0) {
        const ps = s.players.map(p => p.id === player.id ? { ...p, bankrupt: true, money: 0 } : p);
        s = log({ ...s, players: ps }, `${player.name} quedó pato y quiebra. ¡Qué cuático!`);
        return { ...s, phase: checkWinner(s) ? 'game_over' : 'pre_roll', winner: checkWinner(s) };
      }
      return { ...s, phase: 'pre_roll' };
    }

    case 'chance': {
      const deck = shuffle(CHANCE_CARDS);
      const card = deck[s.chanceCardIndex % CHANCE_CARDS.length];
      s = log(s, `${player.name} saca carta de A la Buena de Dios...`);
      return { ...s, pendingCard: card, phase: 'card_shown', chanceCardIndex: s.chanceCardIndex + 1 };
    }

    case 'community_chest': {
      const card = COMMUNITY_CHEST_CARDS[s.communityCardIndex % COMMUNITY_CHEST_CARDS.length];
      s = log(s, `${player.name} saca carta de Caja Vecinal...`);
      return { ...s, pendingCard: card, phase: 'card_shown', communityCardIndex: s.communityCardIndex + 1 };
    }

    case 'property':
    case 'railroad':
    case 'utility': {
      const prop = getProp(s, sq.id);
      if (!prop || prop.ownerId === null) {
        s = log(s, `${player.name} cayó en ${sq.name}. ¿Comprar por M$${sq.price}?`);
        return { ...s, phase: 'buy_offer', pendingBuySquareId: sq.id };
      }
      if (prop.ownerId === player.id) {
        s = log(s, `${player.name} está en su propiedad ${sq.name}. ¡La raja!`);
        return { ...s, phase: 'pre_roll' };
      }
      if (prop.mortgaged) {
        s = log(s, `${sq.name} está hipotecada, no se paga arriendo`);
        return { ...s, phase: 'pre_roll' };
      }
      const rent = calculateRent(s, sq.id, s.lastDiceRoll, player.id);
      const owner = s.players.find(p => p.id === prop.ownerId)!;
      s = log(s, `${player.name} debe pagar arriendo M$${rent} a ${owner.name} por ${sq.name}`);
      return {
        ...s,
        phase: 'pay_rent',
        pendingRent: { amount: rent, toPlayerId: prop.ownerId, squareName: sq.name },
      };
    }

    default:
      return { ...s, phase: 'pre_roll' };
  }
}

function applyCardEffect(state: GameState, card: GameCard): GameState {
  const player = state.players[state.currentPlayerIndex];
  let s = state;

  switch (card.effect.type) {
    case 'collect':
      s = payFromPlayer(s, -1, player.id, card.effect.amount);
      s = log(s, `${player.name} cobra M$${card.effect.amount}`);
      break;

    case 'pay':
      s = payFromPlayer(s, player.id, 'parking', card.effect.amount);
      s = log(s, `${player.name} paga M$${card.effect.amount}`);
      break;

    case 'collect_from_each': {
      const amount = card.effect.amount;
      s.players.filter(p => !p.bankrupt && p.id !== player.id).forEach(payer => {
        s = payFromPlayer(s, payer.id, player.id, amount);
      });
      s = log(s, `${player.name} cobra M$${amount} de cada jugador`);
      break;
    }

    case 'pay_each': {
      const amount = card.effect.amount;
      s.players.filter(p => !p.bankrupt && p.id !== player.id).forEach(receiver => {
        s = payFromPlayer(s, player.id, receiver.id, amount);
      });
      s = log(s, `${player.name} paga M$${amount} a cada jugador`);
      break;
    }

    case 'move_to': {
      const newPos = card.effect.position;
      const collectGo = card.effect.collectGo && newPos < player.position;
      s = moveTo(s, player.id, newPos, collectGo);
      s = log(s, `${player.name} avanza a posición ${BOARD_SQUARES[newPos].name}`);
      s = processLanding(s);
      break;
    }

    case 'move_back': {
      const newPos = (player.position - card.effect.spaces + 40) % 40;
      const players = s.players.map(p => p.id === player.id ? { ...p, position: newPos } : p);
      s = { ...s, players };
      s = log(s, `${player.name} retrocede ${card.effect.spaces} casillas`);
      s = processLanding(s);
      break;
    }

    case 'go_to_jail': {
      const players = s.players.map(p =>
        p.id === player.id ? { ...p, position: JAIL_POSITION, inJail: true, jailTurns: 0 } : p
      );
      s = { ...s, players };
      s = log(s, `¡${player.name} va al talego directo!`);
      break;
    }

    case 'get_out_of_jail_card': {
      const players = s.players.map(p =>
        p.id === player.id ? { ...p, getOutOfJailCards: p.getOutOfJailCards + 1 } : p
      );
      s = { ...s, players };
      s = log(s, `${player.name} tiene tarjeta libre del talego`);
      break;
    }

    case 'pay_per_building': {
      const { houseRate, hotelRate } = card.effect;
      let total = 0;
      s.properties.filter(p => p.ownerId === player.id).forEach(p => {
        if (p.houses === 5) total += hotelRate;
        else total += p.houses * houseRate;
      });
      s = payFromPlayer(s, player.id, 'parking', total);
      s = log(s, `${player.name} paga M$${total} por reparaciones`);
      break;
    }
  }

  return s;
}

export const initialState: GameState = {
  phase: 'setup',
  players: [],
  currentPlayerIndex: 0,
  dice: [1, 1],
  doublesCount: 0,
  properties: [],
  chanceCardIndex: 0,
  communityCardIndex: 0,
  log: [],
  winner: null,
  freeParking: 0,
  pendingCard: null,
  pendingRent: null,
  pendingBuySquareId: null,
  lastDiceRoll: 0,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const players: Player[] = Array.from({ length: action.playerCount }, (_, i) => ({
        id: i,
        name: action.names[i] || `Jugador ${i + 1}`,
        token: PLAYER_TOKENS[i],
        color: PLAYER_COLORS[i],
        position: 0,
        money: STARTING_MONEY,
        ownedSquares: [],
        inJail: false,
        jailTurns: 0,
        getOutOfJailCards: 0,
        bankrupt: false,
      }));
      return {
        ...initialState,
        phase: 'pre_roll',
        players,
        properties: initProperties(),
        log: ['¡Chileopolio comenzó! ¡A jugar, cabros!'],
      };
    }

    case 'ROLL_DICE': {
      const d1 = rollDie();
      const d2 = rollDie();
      const total = d1 + d2;
      const isDoubles = d1 === d2;
      const player = state.players[state.currentPlayerIndex];

      if (player.inJail) {
        if (isDoubles) {
          const players = state.players.map(p =>
            p.id === player.id ? { ...p, inJail: false, jailTurns: 0 } : p
          );
          let s: GameState = { ...state, players, dice: [d1, d2], doublesCount: 0, lastDiceRoll: total };
          s = log(s, `${player.name} saca dobles (${d1}+${d2}) y sale del talego`);
          const newPos = (player.position + total) % 40;
          s = moveTo(s, player.id, newPos, newPos < player.position);
          return processLanding(s);
        } else {
          const jailTurns = player.jailTurns + 1;
          if (jailTurns >= 3) {
            const players = state.players.map(p =>
              p.id === player.id ? { ...p, inJail: false, jailTurns: 0, money: p.money - 50 } : p
            );
            let s: GameState = { ...state, players, dice: [d1, d2], doublesCount: 0, lastDiceRoll: total };
            s = log(s, `${player.name} paga M$50 obligado y sale del talego`);
            const newPos = (player.position + total) % 40;
            s = moveTo(s, player.id, newPos, newPos < player.position);
            return processLanding(s);
          }
          const players = state.players.map(p =>
            p.id === player.id ? { ...p, jailTurns } : p
          );
          let s: GameState = { ...state, players, dice: [d1, d2], lastDiceRoll: total };
          s = log(s, `${player.name} tira (${d1}+${d2}) y sigue en el talego. Turno ${jailTurns}/3`);
          return { ...s, phase: 'pre_roll' };
        }
      }

      let doublesCount = isDoubles ? state.doublesCount + 1 : 0;

      if (doublesCount >= 3) {
        const players = state.players.map(p =>
          p.id === player.id ? { ...p, position: JAIL_POSITION, inJail: true, jailTurns: 0 } : p
        );
        let s: GameState = { ...state, players, dice: [d1, d2], doublesCount: 0, lastDiceRoll: total };
        s = log(s, `${player.name} saca 3 dobles seguidos. ¡Al talego weon!`);
        return { ...s, phase: 'pre_roll' };
      }

      const newPos = (player.position + total) % 40;
      const collectGo = newPos < player.position;

      let s: GameState = { ...state, dice: [d1, d2], doublesCount, lastDiceRoll: total };
      s = log(s, `${player.name} tira ${d1}+${d2}=${total}${isDoubles ? ' ¡Dobles!' : ''}`);
      s = moveTo(s, player.id, newPos, collectGo);
      s = processLanding(s);

      if (isDoubles && s.phase === 'pre_roll') {
        return log(s, `${player.name} saca dobles, ¡tira de nuevo!`);
      }
      return s;
    }

    case 'BUY_PROPERTY': {
      const player = state.players[state.currentPlayerIndex];
      const sqId = state.pendingBuySquareId!;
      const sq = BOARD_SQUARES[sqId];
      const price = sq.price ?? 0;
      if (player.money < price) return log(state, `${player.name} no tiene plata pa' comprar. ¡Qué pato!`);
      const players = state.players.map(p =>
        p.id === player.id
          ? { ...p, money: p.money - price, ownedSquares: [...p.ownedSquares, sqId] }
          : p
      );
      const properties = state.properties.map(p =>
        p.squareId === sqId ? { ...p, ownerId: player.id } : p
      );
      let s: GameState = { ...state, players, properties, phase: 'pre_roll', pendingBuySquareId: null };
      s = log(s, `${player.name} compra ${sq.name} por M$${price}. ¡La raja!`);
      return s;
    }

    case 'DECLINE_PROPERTY': {
      const sq = BOARD_SQUARES[state.pendingBuySquareId!];
      let s = log(state, `${state.players[state.currentPlayerIndex].name} no compra ${sq.name}`);
      return { ...s, phase: 'pre_roll', pendingBuySquareId: null };
    }

    case 'ACKNOWLEDGE_CARD': {
      if (!state.pendingCard) return { ...state, phase: 'pre_roll' };
      const card = state.pendingCard;
      let s: GameState = { ...state, pendingCard: null };
      s = applyCardEffect(s, card);
      const winner = checkWinner(s);
      if (winner) return { ...s, phase: 'game_over', winner };
      if (s.phase === 'pay_rent' || s.phase === 'buy_offer') return s;
      return { ...s, phase: 'pre_roll' };
    }

    case 'ACKNOWLEDGE_RENT': {
      if (!state.pendingRent) return { ...state, phase: 'pre_roll' };
      const { amount, toPlayerId } = state.pendingRent;
      const player = state.players[state.currentPlayerIndex];
      let s: GameState = { ...state, pendingRent: null };

      if (player.money < amount) {
        const players = s.players.map(p =>
          p.id === player.id ? { ...p, bankrupt: true, money: 0, ownedSquares: [] } : p
        );
        const properties = s.properties.map(p =>
          p.ownerId === player.id ? { ...p, ownerId: null, houses: 0, mortgaged: false } : p
        );
        s = { ...s, players, properties };
        s = log(s, `${player.name} no puede pagar y quiebra. ¡Quedó pato!`);
        const winner = checkWinner(s);
        if (winner) return { ...s, phase: 'game_over', winner };
        return { ...s, phase: 'pre_roll' };
      }
      s = payFromPlayer(s, player.id, toPlayerId, amount);
      s = log(s, `${player.name} paga M$${amount} de arriendo`);
      return { ...s, phase: 'pre_roll' };
    }

    case 'END_TURN': {
      const s = { ...state, doublesCount: 0 };
      const next = nextPlayerIndex(s);
      const nextPlayer = s.players[next];
      const nextPhase = nextPlayer.inJail ? 'in_jail' : 'pre_roll';
      let ns = log(s, `Turno de ${nextPlayer.name}`);
      return { ...ns, currentPlayerIndex: next, phase: nextPhase };
    }

    case 'BUILD_HOUSE': {
      const player = state.players[state.currentPlayerIndex];
      const sq = BOARD_SQUARES[action.squareId];
      if (!sq.color || !sq.houseCost) return state;
      if (!ownsFullColorGroup(state, player.id, sq.color)) {
        return log(state, 'Necesitas todas las propiedades del color para construir');
      }
      const prop = getProp(state, action.squareId);
      if (!prop || prop.mortgaged || prop.houses >= 5) return state;
      const cost = prop.houses === 4 ? sq.houseCost * 5 : sq.houseCost;
      if (player.money < cost) return log(state, `No tienes plata pa' construir. ¡Qué pato!`);
      const buildName = prop.houses === 4 ? 'quinta' : 'ruca';
      const players = state.players.map(p =>
        p.id === player.id ? { ...p, money: p.money - cost } : p
      );
      const properties = state.properties.map(p =>
        p.squareId === action.squareId ? { ...p, houses: p.houses + 1 } : p
      );
      let s: GameState = { ...state, players, properties };
      return log(s, `${player.name} construye una ${buildName} en ${sq.name} por M$${cost}`);
    }

    case 'SELL_HOUSE': {
      const player = state.players[state.currentPlayerIndex];
      const sq = BOARD_SQUARES[action.squareId];
      const prop = getProp(state, action.squareId);
      if (!prop || prop.houses === 0) return state;
      const sellPrice = Math.floor((sq.houseCost ?? 100) / 2);
      const sellName = prop.houses === 5 ? 'quinta' : 'ruca';
      const players = state.players.map(p =>
        p.id === player.id ? { ...p, money: p.money + sellPrice } : p
      );
      const properties = state.properties.map(p =>
        p.squareId === action.squareId ? { ...p, houses: p.houses - 1 } : p
      );
      let s: GameState = { ...state, players, properties };
      return log(s, `${player.name} vende una ${sellName} en ${sq.name} por M$${sellPrice}`);
    }

    case 'MORTGAGE': {
      const player = state.players[state.currentPlayerIndex];
      const sq = BOARD_SQUARES[action.squareId];
      const prop = getProp(state, action.squareId);
      if (!prop || prop.ownerId !== player.id || prop.mortgaged || prop.houses > 0) return state;
      const value = sq.mortgage ?? 0;
      const players = state.players.map(p =>
        p.id === player.id ? { ...p, money: p.money + value } : p
      );
      const properties = state.properties.map(p =>
        p.squareId === action.squareId ? { ...p, mortgaged: true } : p
      );
      let s: GameState = { ...state, players, properties };
      return log(s, `${player.name} hipoteca ${sq.name} por M$${value}`);
    }

    case 'UNMORTGAGE': {
      const player = state.players[state.currentPlayerIndex];
      const sq = BOARD_SQUARES[action.squareId];
      const prop = getProp(state, action.squareId);
      if (!prop || prop.ownerId !== player.id || !prop.mortgaged) return state;
      const cost = Math.floor((sq.mortgage ?? 0) * 1.1);
      if (player.money < cost) return log(state, `No tienes plata pa' levantar la hipoteca`);
      const players = state.players.map(p =>
        p.id === player.id ? { ...p, money: p.money - cost } : p
      );
      const properties = state.properties.map(p =>
        p.squareId === action.squareId ? { ...p, mortgaged: false } : p
      );
      let s: GameState = { ...state, players, properties };
      return log(s, `${player.name} levanta hipoteca de ${sq.name} por M$${cost}`);
    }

    case 'PAY_BAIL': {
      const player = state.players[state.currentPlayerIndex];
      if (player.money < 50) return log(state, `No tienes 50 lucas pa' salir del talego. ¡Qué pato!`);
      const players = state.players.map(p =>
        p.id === player.id ? { ...p, money: p.money - 50, inJail: false, jailTurns: 0 } : p
      );
      let s: GameState = { ...state, players, phase: 'pre_roll' };
      return log(s, `${player.name} paga M$50 y sale del talego`);
    }

    case 'USE_JAIL_CARD': {
      const player = state.players[state.currentPlayerIndex];
      if (player.getOutOfJailCards <= 0) return state;
      const players = state.players.map(p =>
        p.id === player.id
          ? { ...p, getOutOfJailCards: p.getOutOfJailCards - 1, inJail: false, jailTurns: 0 }
          : p
      );
      let s: GameState = { ...state, players, phase: 'pre_roll' };
      return log(s, `${player.name} usa su tarjeta libre del talego`);
    }

    case 'ROLL_FOR_BAIL':
      return gameReducer(state, { type: 'ROLL_DICE' });

    default:
      return state;
  }
}
