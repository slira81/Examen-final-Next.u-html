import type { BoardSquare, GameCard } from './gameTypes';

export const BOARD_SQUARES: BoardSquare[] = [
  { id: 0,  name: '¡Pal Carrete!',       type: 'go',              description: 'Pasa acá y cobra 200 lucas ¡al tiro!' },
  { id: 1,  name: 'La Pintana',           type: 'property', color: '#7B3F00', price: 60,  rent: [2,10,30,90,160,250],   houseCost: 50,  mortgage: 30,  description: '¡La Pinta, weon!' },
  { id: 2,  name: 'Caja Vecinal',         type: 'community_chest',               description: 'A ver qué te toca, po...' },
  { id: 3,  name: 'El Bosque',            type: 'property', color: '#7B3F00', price: 60,  rent: [4,20,60,180,320,450],  houseCost: 50,  mortgage: 30,  description: 'El Bosque de siempre, bacán' },
  { id: 4,  name: 'Impuesto SII',         type: 'tax',             taxAmount: 200,          description: 'El SII te pescó. Paga 200 lucas ¡ya!' },
  { id: 5,  name: 'Tren Bio-Bío',         type: 'railroad',        price: 200, rent: [25,50,100,200], mortgage: 100,     description: 'El tren del pueblo, al sur al tiro' },
  { id: 6,  name: 'Maipú',               type: 'property', color: '#87CEEB', price: 100, rent: [6,30,90,270,400,550],  houseCost: 50,  mortgage: 50,  description: 'Maipú, la gran ciudad del pueblo' },
  { id: 7,  name: 'A la Buena de Dios',  type: 'chance',                          description: '¿Qué te manda el destino, cabro?' },
  { id: 8,  name: 'Pudahuel',            type: 'property', color: '#87CEEB', price: 100, rent: [6,30,90,270,400,550],  houseCost: 50,  mortgage: 50,  description: 'Pudahuel, cerca del aeropuerto, cachai' },
  { id: 9,  name: 'Quilicura',           type: 'property', color: '#87CEEB', price: 120, rent: [8,40,100,300,450,600], houseCost: 50,  mortgage: 60,  description: 'Quilicura, la raja pa vivir' },
  { id: 10, name: 'El Talego',           type: 'jail',                            description: 'Solo mirando, ¡no hiciste nada!' },
  { id: 11, name: 'Talca',              type: 'property', color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750], houseCost: 100, mortgage: 70,  description: 'Talca, París y Londres... dicen' },
  { id: 12, name: 'ENDESA',             type: 'utility',          price: 150, rent: [4,10], mortgage: 75,              description: 'La luz weon, ¡se necesita igual!' },
  { id: 13, name: 'Chillán',            type: 'property', color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750], houseCost: 100, mortgage: 70,  description: 'Chillán, tierra de longanizas y terremoto' },
  { id: 14, name: 'Los Ángeles',        type: 'property', color: '#FF69B4', price: 160, rent: [12,60,180,500,700,900], houseCost: 100, mortgage: 80,  description: 'Los Ángeles del Bío-Bío, la raja' },
  { id: 15, name: 'Bus Turbus',         type: 'railroad',         price: 200, rent: [25,50,100,200], mortgage: 100,    description: 'El Turbus, el mejor bus del país, po' },
  { id: 16, name: 'Temuco',             type: 'property', color: '#FF8C00', price: 180, rent: [14,70,200,550,750,950], houseCost: 100, mortgage: 90,  description: 'Temuco, capital de la Araucanía' },
  { id: 17, name: 'Caja Vecinal',       type: 'community_chest',               description: 'A ver qué te toca ahora...' },
  { id: 18, name: 'Valdivia',           type: 'property', color: '#FF8C00', price: 180, rent: [14,70,200,550,750,950], houseCost: 100, mortgage: 90,  description: 'Valdivia, ciudad de la cerveza artesanal' },
  { id: 19, name: 'Osorno',             type: 'property', color: '#FF8C00', price: 200, rent: [16,80,220,600,800,1000],houseCost: 100, mortgage: 100, description: 'Osorno, tierra de vacas y lluvia' },
  { id: 20, name: 'Descansando la Pera',type: 'free_parking',                    description: '¡Aquí no pasa nada, descansa no más!' },
  { id: 21, name: 'Concepción',         type: 'property', color: '#DC2626', price: 220, rent: [18,90,250,700,875,1050],houseCost: 150, mortgage: 110, description: 'Conce, la segunda capital, dicen po' },
  { id: 22, name: 'A la Buena de Dios', type: 'chance',                          description: '¡Vamos a ver weon!' },
  { id: 23, name: 'Talcahuano',         type: 'property', color: '#DC2626', price: 220, rent: [18,90,250,700,875,1050],houseCost: 150, mortgage: 110, description: 'Talcahuano, el puerto industrial' },
  { id: 24, name: 'Hualpén',            type: 'property', color: '#DC2626', price: 240, rent: [20,100,300,750,925,1100],houseCost: 150, mortgage: 120, description: 'Hualpén, siempre chill la zona' },
  { id: 25, name: 'Bus Pullman',        type: 'railroad',         price: 200, rent: [25,50,100,200], mortgage: 100,    description: 'Pullman Bus, al sur no más weon' },
  { id: 26, name: 'Antofagasta',        type: 'property', color: '#FACC15', price: 260, rent: [22,110,330,800,975,1150],houseCost: 150, mortgage: 130, description: 'Anto, ciudad del cobre, ¡cuática la calor!' },
  { id: 27, name: 'Iquique',            type: 'property', color: '#FACC15', price: 260, rent: [22,110,330,800,975,1150],houseCost: 150, mortgage: 130, description: 'Iquique, la Zona Franca, ¡de compras!' },
  { id: 28, name: 'Aguas Andinas',      type: 'utility',          price: 150, rent: [4,10], mortgage: 75,              description: 'El agua po, ¡imprescindible cabro!' },
  { id: 29, name: 'Arica',              type: 'property', color: '#FACC15', price: 280, rent: [24,120,360,850,1025,1200],houseCost: 150, mortgage: 140, description: 'Arica, la más al norte, qué calor la raja' },
  { id: 30, name: '¡Al Talego!',        type: 'go_to_jail',                      description: 'Te pillaron weon. ¡Derecho al talego!' },
  { id: 31, name: 'Valparaíso',         type: 'property', color: '#16A34A', price: 300, rent: [26,130,390,900,1100,1275],houseCost: 200, mortgage: 150, description: 'Valpo, la joya del Pacífico, ¡la raja!' },
  { id: 32, name: 'Viña del Mar',       type: 'property', color: '#16A34A', price: 300, rent: [26,130,390,900,1100,1275],houseCost: 200, mortgage: 150, description: 'Viña, ciudad jardín, ¡bacán el verano!' },
  { id: 33, name: 'Caja Vecinal',       type: 'community_chest',               description: 'La caja sabe lo que hace...' },
  { id: 34, name: 'Concón',             type: 'property', color: '#16A34A', price: 320, rent: [28,150,450,1000,1200,1400],houseCost: 200, mortgage: 160, description: 'Concón, empanadas fritas y playa ¡yerrr!' },
  { id: 35, name: 'Taxi Colectivo',     type: 'railroad',         price: 200, rent: [25,50,100,200], mortgage: 100,    description: 'El colectivo de siempre, rápido al tiro' },
  { id: 36, name: 'A la Buena de Dios', type: 'chance',                          description: '¡Suerte, po!' },
  { id: 37, name: 'Providencia',        type: 'property', color: '#1D4ED8', price: 350, rent: [35,175,500,1100,1300,1500],houseCost: 200, mortgage: 175, description: 'Provi, la comuna del jet set ¡muy bacán!' },
  { id: 38, name: 'Impuesto al Lujo',   type: 'tax',             taxAmount: 100,          description: 'Por andar tan fachero, paga 100 lucas' },
  { id: 39, name: 'Las Condes',         type: 'property', color: '#1D4ED8', price: 400, rent: [50,200,600,1400,1700,2000],houseCost: 200, mortgage: 200, description: '¡Las Condes, la mina de oro de Santiago!' },
];

export const COLOR_GROUPS: Record<string, number[]> = {
  '#7B3F00': [1, 3],
  '#87CEEB': [6, 8, 9],
  '#FF69B4': [11, 13, 14],
  '#FF8C00': [16, 18, 19],
  '#DC2626': [21, 23, 24],
  '#FACC15': [26, 27, 29],
  '#16A34A': [31, 32, 34],
  '#1D4ED8': [37, 39],
};

export const RAILROAD_IDS = [5, 15, 25, 35];
export const UTILITY_IDS = [12, 28];

export const COMMUNITY_CHEST_CARDS: GameCard[] = [
  { id: 1,  type: 'community_chest', text: '¡La boleta del seguro llegó! Cobra 200 lucas.',                       effect: { type: 'collect', amount: 200 } },
  { id: 2,  type: 'community_chest', text: 'Te multaron por cuático en el carrete. Paga 50 lucas.',              effect: { type: 'pay', amount: 50 } },
  { id: 3,  type: 'community_chest', text: '¡Te ganaste el Kino! Cobra 100 lucas, ¡la raja!',                    effect: { type: 'collect', amount: 100 } },
  { id: 4,  type: 'community_chest', text: 'El banco te devuelve un pago de AFP. Cobra 20 lucas.',               effect: { type: 'collect', amount: 20 } },
  { id: 5,  type: 'community_chest', text: '¡Se murió el tío rico de Curicó! Herencia de 100 lucas para ti.',    effect: { type: 'collect', amount: 100 } },
  { id: 6,  type: 'community_chest', text: '¡Es tu cumpleaños, cabro! Cada jugador te da 10 lucas.',             effect: { type: 'collect_from_each', amount: 10 } },
  { id: 7,  type: 'community_chest', text: 'Infracción de tránsito. Paga 50 lucas de multa.',                    effect: { type: 'pay', amount: 50 } },
  { id: 8,  type: 'community_chest', text: 'El SII te devuelve impuestos. Cobra 20 lucas.',                      effect: { type: 'collect', amount: 20 } },
  { id: 9,  type: 'community_chest', text: '¡Tarjeta libre del talego! Guárdala pa cuando la cagues.',           effect: { type: 'get_out_of_jail_card' } },
  { id: 10, type: 'community_chest', text: 'Avanza al ¡Pal Carrete! y cobra 200 lucas.',                         effect: { type: 'move_to', position: 0, collectGo: true } },
  { id: 11, type: 'community_chest', text: 'Te pillaron haciendo trampa en el truco. Paga 10 lucas a cada uno.', effect: { type: 'pay_each', amount: 10 } },
  { id: 12, type: 'community_chest', text: 'Vendiste empanadas en el estadio. Ganas 50 lucas.',                  effect: { type: 'collect', amount: 50 } },
  { id: 13, type: 'community_chest', text: 'Deuda en el consultorio. Paga 100 lucas al Fonasa.',                 effect: { type: 'pay', amount: 100 } },
  { id: 14, type: 'community_chest', text: '¡Premio de emprendimiento! Cobra 25 lucas.',                         effect: { type: 'collect', amount: 25 } },
  { id: 15, type: 'community_chest', text: 'Multa del municipio por basura en la calle. Paga 100 lucas.',        effect: { type: 'pay', amount: 100 } },
  { id: 16, type: 'community_chest', text: 'Vendiste mote con huesillos en la feria. Ganas 45 lucas.',           effect: { type: 'collect', amount: 45 } },
];

export const CHANCE_CARDS: GameCard[] = [
  { id: 101, type: 'chance', text: '¡Avanza al ¡Pal Carrete! y cobra 200 lucas!',                            effect: { type: 'move_to', position: 0, collectGo: true } },
  { id: 102, type: 'chance', text: '¡Al Talego, Cabro! Ve directo sin pasar por ¡Pal Carrete!',              effect: { type: 'go_to_jail' } },
  { id: 103, type: 'chance', text: 'El banco te debe plata de una apuesta ganada. Cobra 50 lucas.',          effect: { type: 'collect', amount: 50 } },
  { id: 104, type: 'chance', text: 'Te mandaron pa\' atrás. Retrocede 3 casillas.',                          effect: { type: 'move_back', spaces: 3 } },
  { id: 105, type: 'chance', text: '¡Tarjeta libre del talego! Guárdala pa cuando la cagues.',               effect: { type: 'get_out_of_jail_card' } },
  { id: 106, type: 'chance', text: 'Multa por andar curao en la vía pública. Paga 20 lucas.',                effect: { type: 'pay', amount: 20 } },
  { id: 107, type: 'chance', text: 'El banco te paga dividendos de tus acciones en CODELCO. Cobra 50.',      effect: { type: 'collect', amount: 50 } },
  { id: 108, type: 'chance', text: 'Avanza a Viña del Mar. Si pasas por ¡Pal Carrete!, cobra 200.',          effect: { type: 'move_to', position: 32, collectGo: true } },
  { id: 109, type: 'chance', text: 'Avanza a Las Condes. Si pasas por ¡Pal Carrete!, cobra 200.',            effect: { type: 'move_to', position: 39, collectGo: true } },
  { id: 110, type: 'chance', text: '¡Se te cayó la plata en el carrete! Paga 15 lucas a cada jugador.',      effect: { type: 'pay_each', amount: 15 } },
  { id: 111, type: 'chance', text: 'Inversión exitosa en acciones del cobre. ¡Cobra 150 lucas!',             effect: { type: 'collect', amount: 150 } },
  { id: 112, type: 'chance', text: 'Avanza al Bus Turbus. Si pasas por ¡Pal Carrete!, cobra 200.',           effect: { type: 'move_to', position: 15, collectGo: true } },
  { id: 113, type: 'chance', text: 'Reparación de tus propiedades. Paga 25 por ruca y 100 por quinta.',      effect: { type: 'pay_per_building', houseRate: 25, hotelRate: 100 } },
  { id: 114, type: 'chance', text: '¡Vendiste completos en el partido! Ganas 100 lucas, bacán!',             effect: { type: 'collect', amount: 100 } },
  { id: 115, type: 'chance', text: 'Avanza a Valparaíso. Si pasas por ¡Pal Carrete!, cobra 200.',            effect: { type: 'move_to', position: 31, collectGo: true } },
  { id: 116, type: 'chance', text: 'Préstamo bancario aprobado al tiro. ¡Cobra 200 lucas!',                  effect: { type: 'collect', amount: 200 } },
];

export const PLAYER_TOKENS = ['🌶️', '🐟', '⭐', '🌿'];
export const PLAYER_COLORS = ['#EF4444', '#3B82F6', '#EAB308', '#22C55E'];
export const PLAYER_NAMES_DEFAULT = ['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4'];

export const GO_SALARY = 200;
export const JAIL_POSITION = 10;
export const GO_TO_JAIL_POSITION = 30;
export const STARTING_MONEY = 1500;
