'use client';

import { useReducer, useState, useRef, useEffect } from 'react';
import { gameReducer, initialState } from '@/lib/gameReducer';
import type { GameAction } from '@/lib/gameReducer';
import { BOARD_SQUARES, PLAYER_NAMES_DEFAULT, PLAYER_TOKENS, PLAYER_COLORS } from '@/lib/boardData';
import type { GameState } from '@/lib/gameTypes';

/* ── helpers ─────────────────────────────────────────── */
function cellToSquare(row: number, col: number): number {
  if (row === 10) return 10 - col;
  if (row === 0)  return 20 + col;
  if (col === 0)  return 20 - row;
  if (col === 10) return 30 + row;
  return -1;
}
const fmt = (n: number) => `M$${n.toLocaleString('es-CL')}`;

/* ── dice faces ──────────────────────────────────────── */
const PIPS: Record<number, [number, number][]> = {
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]],
  5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
};

function Dice({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`relative w-12 h-12 bg-white rounded-xl shadow-lg border-2 border-gray-200 ${rolling ? 'animate-spin' : ''}`}
    >
      {PIPS[value]?.map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 rounded-full bg-gray-800"
          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
        />
      ))}
    </div>
  );
}

/* ── board cell ──────────────────────────────────────── */
function BoardCell({ squareId, state, onClick }: { squareId: number; state: GameState; onClick: () => void }) {
  const sq = BOARD_SQUARES[squareId];
  const prop = state.properties.find(p => p.squareId === squareId);
  const players = state.players.filter(p => !p.bankrupt && p.position === squareId);
  const owner = prop?.ownerId != null ? state.players[prop.ownerId] : null;

  const bgMap: Record<string, string> = {
    go: '#FEF3C7', jail: '#E2E8F0', free_parking: '#DCFCE7',
    go_to_jail: '#FEE2E2', chance: '#FEF9C3', community_chest: '#E0F2FE',
    tax: '#FEE2E2', railroad: '#F3F4F6', utility: '#F0FDF4', property: '#FFFFFF',
  };
  const iconMap: Record<string, string> = {
    go: '🎉', jail: '🏛️', free_parking: '🅿️', go_to_jail: '🚓',
    chance: '?', community_chest: '📦', tax: '💸',
  };

  return (
    <div
      className="relative border border-gray-400/60 cursor-pointer overflow-hidden flex items-center justify-center"
      style={{ aspectRatio: '1', backgroundColor: bgMap[sq.type] ?? '#fff' }}
      onClick={onClick}
      title={sq.name}
    >
      {sq.type === 'property' && sq.color && (
        <div className="absolute inset-x-0 top-0 h-[32%]" style={{ backgroundColor: prop?.mortgaged ? '#9CA3AF' : sq.color }} />
      )}
      {owner && (
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundColor: owner.color }} />
      )}
      {(prop?.houses ?? 0) > 0 && (
        <div className="absolute bottom-0 right-0 text-[5px] font-black bg-green-600 text-white px-[1px] leading-none z-10">
          {prop!.houses === 5 ? 'H' : prop!.houses}
        </div>
      )}
      {iconMap[sq.type] && (
        <span className="text-[8px] leading-none font-bold text-gray-500 z-10">
          {iconMap[sq.type]}
        </span>
      )}
      {players.length > 0 && (
        <div className="absolute inset-0 flex flex-wrap items-end justify-start p-[1px] gap-[1px] z-20">
          {players.map(p => (
            <div
              key={p.id}
              className="w-3 h-3 rounded-full border border-white flex items-center justify-center text-[6px] leading-none shadow"
              style={{ backgroundColor: p.color }}
            >
              {p.token}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── board center ───────────────────────────────────── */
function BoardCenter({ state }: { state: GameState }) {
  const cur = state.players[state.currentPlayerIndex];
  return (
    <div
      className="col-span-9 row-span-9 flex flex-col items-center justify-center bg-green-800 gap-1.5 p-1"
      style={{ gridColumn: '2 / span 9', gridRow: '2 / span 9' }}
    >
      <div className="text-white font-black text-center leading-none" style={{ fontSize: '8px' }}>
        🇨🇱 CHILEOPOLIO 🇨🇱
      </div>
      <div className="flex gap-1.5 items-center">
        <Dice value={state.dice[0]} rolling={false} />
        <Dice value={state.dice[1]} rolling={false} />
      </div>
      {state.freeParking > 0 && (
        <div className="text-yellow-300 font-bold text-center" style={{ fontSize: '6px' }}>
          🅿 {fmt(state.freeParking)}
        </div>
      )}
      {cur && !cur.bankrupt && (
        <div className="text-center leading-none" style={{ fontSize: '6px', color: cur.color === '#EAB308' ? '#fde047' : cur.color }}>
          {cur.token} {cur.name}
        </div>
      )}
    </div>
  );
}

/* ── board ──────────────────────────────────────────── */
function Board({ state, onCellClick }: { state: GameState; onCellClick: (id: number) => void }) {
  const cells: React.ReactNode[] = [];
  let centerPlaced = false;

  for (let row = 0; row <= 10; row++) {
    for (let col = 0; col <= 10; col++) {
      const sqId = cellToSquare(row, col);
      if (sqId >= 0) {
        cells.push(
          <BoardCell key={`${row}-${col}`} squareId={sqId} state={state} onClick={() => onCellClick(sqId)} />
        );
      } else if (!centerPlaced) {
        centerPlaced = true;
        cells.push(<BoardCenter key="center" state={state} />);
      }
    }
  }

  return (
    <div
      className="w-full border-2 border-gray-700 bg-green-800 mx-auto"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(11, 1fr)',
        gridTemplateRows: 'repeat(11, 1fr)',
        maxWidth: '360px',
        aspectRatio: '1',
      }}
    >
      {cells}
    </div>
  );
}

/* ── property info panel ─────────────────────────────── */
function PropertyInfo({ squareId, state, dispatch, onClose }: {
  squareId: number; state: GameState; dispatch: React.Dispatch<GameAction>; onClose: () => void;
}) {
  const sq = BOARD_SQUARES[squareId];
  const prop = state.properties.find(p => p.squareId === squareId);
  const cur = state.players[state.currentPlayerIndex];
  const owner = prop?.ownerId != null ? state.players[prop.ownerId] : null;
  const isOwner = prop?.ownerId === cur.id;
  const canManage = state.phase === 'pre_roll' || state.phase === 'manage';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {sq.color && <div className="h-3 rounded-full mb-3" style={{ backgroundColor: sq.color }} />}
        <h2 className="text-xl font-black text-gray-900 mb-0.5">{sq.name}</h2>
        <p className="text-sm text-gray-400 italic mb-3">{sq.description}</p>
        {sq.price && <p className="text-sm font-semibold text-gray-700 mb-1">Precio: <span className="text-green-700">{fmt(sq.price)}</span></p>}
        {owner && (
          <p className="text-sm mb-1">Dueño: <span style={{ color: owner.color }} className="font-bold">{owner.token} {owner.name}</span></p>
        )}
        {prop?.mortgaged && <p className="text-xs text-red-500 font-semibold mb-2">⚠️ Hipotecada — no cobra arriendo</p>}

        {sq.rent && sq.type === 'property' && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3 text-xs text-gray-700 space-y-1">
            <p className="font-black text-gray-900 mb-2">Arriendos:</p>
            {['Sin mejora','1 ruca','2 rucas','3 rucas','4 rucas','Quinta (hotel)'].map((label, i) => (
              <div key={i} className={`flex justify-between ${(prop?.houses ?? 0) === i ? 'font-black text-green-700' : ''}`}>
                <span>{label}</span><span>{fmt(sq.rent![i])}</span>
              </div>
            ))}
            {sq.houseCost && (
              <p className="mt-2 text-gray-400 pt-2 border-t border-gray-200">Costo ruca: {fmt(sq.houseCost)}</p>
            )}
          </div>
        )}

        {sq.rent && sq.type === 'railroad' && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3 text-xs text-gray-700 space-y-1">
            <p className="font-black text-gray-900 mb-2">Arriendo:</p>
            {['1 bus','2 buses','3 buses','4 buses'].map((label, i) => (
              <div key={i} className="flex justify-between"><span>{label}</span><span>{fmt(sq.rent![i])}</span></div>
            ))}
          </div>
        )}

        {isOwner && canManage && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sq.type === 'property' && sq.color && !prop?.mortgaged && (
              <>
                <button onClick={() => { dispatch({ type: 'BUILD_HOUSE', squareId }); onClose(); }}
                  className="px-3 py-2 bg-green-600 text-white text-xs rounded-xl font-bold">
                  + Ruca {fmt(sq.houseCost ?? 0)}
                </button>
                {(prop?.houses ?? 0) > 0 && (
                  <button onClick={() => { dispatch({ type: 'SELL_HOUSE', squareId }); onClose(); }}
                    className="px-3 py-2 bg-orange-500 text-white text-xs rounded-xl font-bold">
                    − Vender ruca
                  </button>
                )}
              </>
            )}
            {!prop?.mortgaged && (prop?.houses ?? 0) === 0 && (
              <button onClick={() => { dispatch({ type: 'MORTGAGE', squareId }); onClose(); }}
                className="px-3 py-2 bg-red-600 text-white text-xs rounded-xl font-bold">
                Hipotecar +{fmt(sq.mortgage ?? 0)}
              </button>
            )}
            {prop?.mortgaged && (
              <button onClick={() => { dispatch({ type: 'UNMORTGAGE', squareId }); onClose(); }}
                className="px-3 py-2 bg-blue-600 text-white text-xs rounded-xl font-bold">
                Levantar hipoteca
              </button>
            )}
          </div>
        )}
        <button onClick={onClose} className="mt-4 w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold">
          Cerrar
        </button>
      </div>
    </div>
  );
}

/* ── buy modal ──────────────────────────────────────── */
function BuyModal({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  if (state.phase !== 'buy_offer' || state.pendingBuySquareId == null) return null;
  const sq = BOARD_SQUARES[state.pendingBuySquareId];
  const cur = state.players[state.currentPlayerIndex];
  const canAfford = cur.money >= (sq.price ?? 0);
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {sq.color && <div className="h-3 rounded-full mb-4" style={{ backgroundColor: sq.color }} />}
        <h2 className="text-2xl font-black text-gray-900 mb-1">{sq.name}</h2>
        <p className="text-sm text-gray-400 italic mb-4">{sq.description}</p>
        <p className="text-4xl font-black text-green-700 mb-1">{fmt(sq.price ?? 0)}</p>
        <p className="text-sm text-gray-500 mb-6">Tienes: <span className="font-bold text-gray-700">{fmt(cur.money)}</span></p>
        {sq.rent && sq.type === 'property' && (
          <p className="text-xs text-gray-400 mb-4">Arriendo base: {fmt(sq.rent[0])}</p>
        )}
        <div className="flex gap-3">
          <button onClick={() => dispatch({ type: 'BUY_PROPERTY' })} disabled={!canAfford}
            className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl disabled:opacity-40 text-sm">
            {canAfford ? '¡Comprar! 💰' : 'Sin lucas 😢'}
          </button>
          <button onClick={() => dispatch({ type: 'DECLINE_PROPERTY' })}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm">
            No gracias
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── card modal ─────────────────────────────────────── */
function CardModal({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  if (state.phase !== 'card_shown' || !state.pendingCard) return null;
  const card = state.pendingCard;
  const isChance = card.type === 'chance';
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-4 ${isChance ? 'border-yellow-400' : 'border-sky-400'}`}>
        <div className="text-center text-4xl mb-2">{isChance ? '🎴' : '📦'}</div>
        <div className={`text-center text-xs font-black uppercase tracking-widest mb-3 ${isChance ? 'text-yellow-600' : 'text-sky-600'}`}>
          {isChance ? 'A la Buena de Dios' : 'Caja Vecinal'}
        </div>
        <p className="text-gray-900 text-center font-semibold text-base leading-relaxed mb-6">{card.text}</p>
        <button onClick={() => dispatch({ type: 'ACKNOWLEDGE_CARD' })}
          className={`w-full py-3 font-black rounded-xl text-white ${isChance ? 'bg-yellow-500' : 'bg-sky-500'}`}>
          ¡Cachaí! ✓
        </button>
      </div>
    </div>
  );
}

/* ── rent modal ─────────────────────────────────────── */
function RentModal({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  if (state.phase !== 'pay_rent' || !state.pendingRent) return null;
  const { amount, toPlayerId, squareName } = state.pendingRent;
  const cur = state.players[state.currentPlayerIndex];
  const owner = state.players[toPlayerId];
  const canPay = cur.money >= amount;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-4 border-red-400">
        <div className="text-center text-4xl mb-2">💸</div>
        <h2 className="text-center font-black text-gray-900 text-xl mb-1">¡Arriendo!</h2>
        <p className="text-center text-gray-500 text-sm mb-4">Caíste en {squareName}</p>
        <div className="bg-red-50 rounded-xl p-4 mb-4 text-center">
          <p className="text-3xl font-black text-red-600">{fmt(amount)}</p>
          <p className="text-sm text-gray-500 mt-1">
            a <span style={{ color: owner.color }} className="font-bold">{owner.token} {owner.name}</span>
          </p>
        </div>
        <p className="text-center text-xs text-gray-400 mb-4">
          {canPay ? `Te quedan ${fmt(cur.money - amount)}` : '¡No tienes plata! Quiebras 💀'}
        </p>
        <button onClick={() => dispatch({ type: 'ACKNOWLEDGE_RENT' })}
          className="w-full py-3 bg-red-500 text-white font-black rounded-xl">
          {canPay ? 'Pagar 😤' : 'Quebrar 💀'}
        </button>
      </div>
    </div>
  );
}

/* ── game over modal ────────────────────────────────── */
function GameOverModal({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  if (state.phase !== 'game_over' || !state.winner) return null;
  const w = state.winner;
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
        <div className="text-7xl mb-4">{w.token}</div>
        <div className="text-4xl font-black mb-2" style={{ color: w.color }}>{w.name}</div>
        <p className="text-gray-500 text-sm mb-2">¡Ganó el Chileopolio!</p>
        <p className="text-3xl font-black text-green-700 mb-4">{fmt(w.money)}</p>
        <p className="text-base font-semibold text-gray-700 mb-6">🇨🇱 ¡La raja, weon! ¡Eres el más bacán del tablero! 🇨🇱</p>
        <button onClick={onRestart} className="w-full py-4 bg-red-600 text-white font-black rounded-xl text-lg">
          Jugar de nuevo 🎲
        </button>
      </div>
    </div>
  );
}

/* ── jail panel ─────────────────────────────────────── */
function JailPanel({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  const cur = state.players[state.currentPlayerIndex];
  return (
    <div className="bg-gray-800 rounded-2xl p-4 text-white">
      <h3 className="font-black text-center text-base mb-1">🏛️ {cur.name} está en El Talego</h3>
      <p className="text-xs text-gray-400 text-center mb-4">Turno {cur.jailTurns + 1}/3 — saca dobles para salir</p>
      <div className="flex flex-col gap-2">
        <button onClick={() => dispatch({ type: 'PAY_BAIL' })} disabled={cur.money < 50}
          className="py-2.5 bg-yellow-500 text-black font-bold rounded-xl text-sm disabled:opacity-40">
          💰 Pagar fianza M$50
        </button>
        {cur.getOutOfJailCards > 0 && (
          <button onClick={() => dispatch({ type: 'USE_JAIL_CARD' })}
            className="py-2.5 bg-blue-500 text-white font-bold rounded-xl text-sm">
            🎴 Usar tarjeta libre ({cur.getOutOfJailCards})
          </button>
        )}
        <button onClick={() => dispatch({ type: 'ROLL_FOR_BAIL' })}
          className="py-2.5 bg-green-600 text-white font-bold rounded-xl text-sm">
          🎲 Tirar pa&apos; salir (necesitas dobles)
        </button>
      </div>
    </div>
  );
}

/* ── action panel ───────────────────────────────────── */
function ActionPanel({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  const cur = state.players[state.currentPlayerIndex];
  const phase = state.phase;
  const [rolling, setRolling] = useState(false);

  const handleRoll = () => {
    setRolling(true);
    setTimeout(() => { setRolling(false); dispatch({ type: 'ROLL_DICE' }); }, 500);
  };

  if (phase === 'game_over') return null;
  if (phase === 'in_jail') return <JailPanel state={state} dispatch={dispatch} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <div className={rolling ? 'animate-bounce' : ''}><Dice value={state.dice[0]} rolling={rolling} /></div>
        <span className="text-gray-400 font-bold text-xl">+</span>
        <div className={rolling ? 'animate-bounce delay-75' : ''}><Dice value={state.dice[1]} rolling={rolling} /></div>
        <span className="text-gray-700 font-black text-xl">= {state.dice[0] + state.dice[1]}</span>
      </div>
      {phase === 'pre_roll' ? (
        <button onClick={handleRoll} disabled={rolling}
          className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-xl rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-60">
          🎲 {rolling ? '¡Tirando...!' : '¡Tirar Dados!'}
        </button>
      ) : (
        <div className="py-3 bg-gray-100 rounded-2xl text-center text-sm text-gray-500 font-semibold animate-pulse">
          Procesando...
        </div>
      )}
      <button onClick={() => dispatch({ type: 'END_TURN' })} disabled={phase !== 'pre_roll'}
        className="w-full py-2.5 bg-gray-800 text-white font-semibold rounded-xl text-sm disabled:opacity-30 active:scale-95 transition-transform">
        Terminar turno de {cur.name} →
      </button>
    </div>
  );
}

/* ── players bar ─────────────────────────────────────── */
function PlayersBar({ state }: { state: GameState }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {state.players.map((p, i) => {
        const isCurrent = i === state.currentPlayerIndex;
        return (
          <div key={p.id}
            className={`flex-shrink-0 rounded-xl px-3 py-2 text-xs border-2 transition-all ${
              p.bankrupt ? 'opacity-40 border-gray-200 bg-gray-50'
              : isCurrent ? 'bg-white shadow-md' : 'bg-white/80 border-transparent'
            }`}
            style={isCurrent && !p.bankrupt ? { borderColor: p.color } : {}}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-base leading-none">{p.token}</span>
              <span className="font-black text-gray-900 truncate max-w-[56px]" title={p.name}>{p.name}</span>
              {p.bankrupt && <span className="text-red-500">💀</span>}
              {p.inJail && !p.bankrupt && <span title="En el talego">🏛️</span>}
            </div>
            <div className="font-bold text-[11px]" style={{ color: p.bankrupt ? '#9CA3AF' : p.color }}>
              {fmt(p.money)}
            </div>
            <div className="text-gray-400 text-[10px] mt-0.5 truncate max-w-[80px]">
              {BOARD_SQUARES[p.position]?.name.substring(0, 11)}
            </div>
            {p.ownedSquares.length > 0 && (
              <div className="flex gap-[2px] mt-1 flex-wrap">
                {p.ownedSquares.slice(0, 6).map(sid => {
                  const sq = BOARD_SQUARES[sid];
                  return (
                    <div key={sid} className="w-2 h-2 rounded-sm border border-gray-200"
                      style={{ backgroundColor: sq.color ?? (sq.type === 'railroad' ? '#6B7280' : '#14B8A6') }}
                      title={sq.name} />
                  );
                })}
                {p.ownedSquares.length > 6 && <span className="text-[8px] text-gray-400">+{p.ownedSquares.length - 6}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── game log ───────────────────────────────────────── */
function GameLog({ log }: { log: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [log]);
  return (
    <div ref={ref} className="bg-gray-900 rounded-2xl p-3 h-32 overflow-y-auto">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">📋 Historial</p>
      {log.map((entry, i) => (
        <p key={i} className={`text-xs leading-relaxed ${i === 0 ? 'text-white' : 'text-gray-500'}`}>
          {i === 0 ? '▶ ' : '  '}{entry}
        </p>
      ))}
    </div>
  );
}

/* ── setup screen ───────────────────────────────────── */
function SetupScreen({ onStart }: { onStart: (count: number, names: string[]) => void }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState([...PLAYER_NAMES_DEFAULT]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #dc2626 50%, #7f1d1d 100%)' }}>
      <div className="text-center mb-8">
        <div className="text-8xl mb-4 drop-shadow-lg">🇨🇱</div>
        <h1 className="text-5xl font-black text-white tracking-tight drop-shadow-xl">¡Chileopolio!</h1>
        <p className="text-red-200 text-sm mt-2 italic">El monopolio más bacán del país, po</p>
      </div>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="font-black text-gray-900 text-lg mb-4 text-center">¿Cuántos jugadores?</h2>
        <div className="flex gap-3 mb-5 justify-center">
          {[2, 3, 4].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`w-14 h-14 rounded-2xl font-black text-2xl transition-all ${
                count === n ? 'bg-red-600 text-white shadow-lg scale-110' : 'bg-gray-100 text-gray-600'
              }`}>
              {n}
            </button>
          ))}
        </div>
        <div className="space-y-3 mb-6">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="text-2xl w-8 text-center">{PLAYER_TOKENS[i]}</div>
              <input
                type="text" value={names[i]} maxLength={14}
                onChange={e => { const n = [...names]; n[i] = e.target.value; setNames(n); }}
                placeholder={PLAYER_NAMES_DEFAULT[i]}
                className="flex-1 border-2 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2"
                style={{ borderColor: PLAYER_COLORS[i], focusBorderColor: PLAYER_COLORS[i] } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
        <button onClick={() => onStart(count, names)}
          className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-xl rounded-2xl shadow-lg active:scale-95 transition-transform">
          🎲 ¡A jugar, cabros!
        </button>
        <div className="mt-4 bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1.5">
          <p className="font-black text-gray-700 mb-1">Reglas rápidas:</p>
          <p>🎉 <strong>¡Pal Carrete!</strong> = cobra M$200 al pasar</p>
          <p>🏛️ <strong>El Talego</strong> = Cárcel</p>
          <p>🏠 <strong>Ruca</strong> = Casa | <strong>Quinta</strong> = Hotel</p>
          <p>📍 Toca una casilla para ver detalles y construir</p>
          <p>💀 Sin plata = quiebras. ¡El último en pie gana!</p>
        </div>
      </div>
    </div>
  );
}

/* ── game screen ─────────────────────────────────────── */
function GameScreen({ state, dispatch, onRestart }: {
  state: GameState; dispatch: React.Dispatch<GameAction>; onRestart: () => void;
}) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const cur = state.players[state.currentPlayerIndex];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col" style={{ maxWidth: '480px', margin: '0 auto' }}>
      {/* header */}
      <div className="px-4 pt-3 pb-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(to right, #1e3a8a, #dc2626)' }}>
        <h1 className="text-white font-black text-lg tracking-tight">🇨🇱 Chileopolio</h1>
        {cur && !cur.bankrupt && (
          <div className="text-xs bg-white/20 text-white rounded-lg px-2.5 py-1.5 font-semibold">
            <span style={{ color: cur.color === '#EAB308' ? '#fde047' : cur.color }}>{cur.token}</span> {cur.name}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3 pb-6">
        <PlayersBar state={state} />
        <Board state={state} onCellClick={setSelectedCell} />
        <ActionPanel state={state} dispatch={dispatch} />
        <GameLog log={state.log} />
      </div>

      <BuyModal state={state} dispatch={dispatch} />
      <CardModal state={state} dispatch={dispatch} />
      <RentModal state={state} dispatch={dispatch} />
      <GameOverModal state={state} onRestart={onRestart} />

      {selectedCell != null && (
        <PropertyInfo squareId={selectedCell} state={state} dispatch={dispatch} onClose={() => setSelectedCell(null)} />
      )}
    </div>
  );
}

/* ── root ────────────────────────────────────────────── */
export default function Home() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const handleStart = (count: number, names: string[]) => {
    dispatch({ type: 'START_GAME', playerCount: count, names });
  };

  const handleRestart = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  if (state.phase === 'setup') return <SetupScreen onStart={handleStart} />;
  return <GameScreen state={state} dispatch={dispatch} onRestart={handleRestart} />;
}
