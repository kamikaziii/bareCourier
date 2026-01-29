/**
 * Portugal Municipalities Dataset
 *
 * Complete list of all 278 municipalities (concelhos) in continental Portugal,
 * organized by their 18 districts (distritos).
 *
 * Note: Portugal has 308 total municipalities (278 continental + 19 Azores + 11 Madeira).
 * This file only includes continental Portugal as it's the relevant service area.
 *
 * Source: INE - Instituto Nacional de Estatística / GEO API PT
 */

export interface Municipality {
	concelho: string;
	distrito: string;
}

export interface DistritoGroup {
	distrito: string;
	concelhos: string[];
}

/**
 * All 18 continental Portuguese districts with their municipalities
 */
export const PORTUGAL_DISTRITOS: DistritoGroup[] = [
	{
		distrito: 'Aveiro',
		concelhos: [
			'Águeda',
			'Albergaria-a-Velha',
			'Anadia',
			'Arouca',
			'Aveiro',
			'Castelo de Paiva',
			'Espinho',
			'Estarreja',
			'Ílhavo',
			'Mealhada',
			'Murtosa',
			'Oliveira de Azeméis',
			'Oliveira do Bairro',
			'Ovar',
			'Santa Maria da Feira',
			'São João da Madeira',
			'Sever do Vouga',
			'Vagos',
			'Vale de Cambra'
		]
	},
	{
		distrito: 'Beja',
		concelhos: [
			'Aljustrel',
			'Almodôvar',
			'Alvito',
			'Barrancos',
			'Beja',
			'Castro Verde',
			'Cuba',
			'Ferreira do Alentejo',
			'Mértola',
			'Moura',
			'Odemira',
			'Ourique',
			'Serpa',
			'Vidigueira'
		]
	},
	{
		distrito: 'Braga',
		concelhos: [
			'Amares',
			'Barcelos',
			'Braga',
			'Cabeceiras de Basto',
			'Celorico de Basto',
			'Esposende',
			'Fafe',
			'Guimarães',
			'Póvoa de Lanhoso',
			'Terras de Bouro',
			'Vieira do Minho',
			'Vila Nova de Famalicão',
			'Vila Verde',
			'Vizela'
		]
	},
	{
		distrito: 'Bragança',
		concelhos: [
			'Alfândega da Fé',
			'Bragança',
			'Carrazeda de Ansiães',
			'Freixo de Espada à Cinta',
			'Macedo de Cavaleiros',
			'Miranda do Douro',
			'Mirandela',
			'Mogadouro',
			'Torre de Moncorvo',
			'Vila Flor',
			'Vimioso',
			'Vinhais'
		]
	},
	{
		distrito: 'Castelo Branco',
		concelhos: [
			'Belmonte',
			'Castelo Branco',
			'Covilhã',
			'Fundão',
			'Idanha-a-Nova',
			'Oleiros',
			'Penamacor',
			'Proença-a-Nova',
			'Sertã',
			'Vila de Rei',
			'Vila Velha de Ródão'
		]
	},
	{
		distrito: 'Coimbra',
		concelhos: [
			'Arganil',
			'Cantanhede',
			'Coimbra',
			'Condeixa-a-Nova',
			'Figueira da Foz',
			'Góis',
			'Lousã',
			'Mira',
			'Miranda do Corvo',
			'Montemor-o-Velho',
			'Oliveira do Hospital',
			'Pampilhosa da Serra',
			'Penacova',
			'Penela',
			'Soure',
			'Tábua',
			'Vila Nova de Poiares'
		]
	},
	{
		distrito: 'Évora',
		concelhos: [
			'Alandroal',
			'Arraiolos',
			'Borba',
			'Estremoz',
			'Évora',
			'Montemor-o-Novo',
			'Mora',
			'Mourão',
			'Portel',
			'Redondo',
			'Reguengos de Monsaraz',
			'Vendas Novas',
			'Viana do Alentejo',
			'Vila Viçosa'
		]
	},
	{
		distrito: 'Faro',
		concelhos: [
			'Albufeira',
			'Alcoutim',
			'Aljezur',
			'Castro Marim',
			'Faro',
			'Lagoa',
			'Lagos',
			'Loulé',
			'Monchique',
			'Olhão',
			'Portimão',
			'São Brás de Alportel',
			'Silves',
			'Tavira',
			'Vila do Bispo',
			'Vila Real de Santo António'
		]
	},
	{
		distrito: 'Guarda',
		concelhos: [
			'Aguiar da Beira',
			'Almeida',
			'Celorico da Beira',
			'Figueira de Castelo Rodrigo',
			'Fornos de Algodres',
			'Gouveia',
			'Guarda',
			'Manteigas',
			'Mêda',
			'Pinhel',
			'Sabugal',
			'Seia',
			'Trancoso',
			'Vila Nova de Foz Côa'
		]
	},
	{
		distrito: 'Leiria',
		concelhos: [
			'Alcobaça',
			'Alvaiázere',
			'Ansião',
			'Batalha',
			'Bombarral',
			'Caldas da Rainha',
			'Castanheira de Pêra',
			'Figueiró dos Vinhos',
			'Leiria',
			'Marinha Grande',
			'Nazaré',
			'Óbidos',
			'Pedrógão Grande',
			'Peniche',
			'Pombal',
			'Porto de Mós'
		]
	},
	{
		distrito: 'Lisboa',
		concelhos: [
			'Alenquer',
			'Amadora',
			'Arruda dos Vinhos',
			'Azambuja',
			'Cadaval',
			'Cascais',
			'Lisboa',
			'Loures',
			'Lourinhã',
			'Mafra',
			'Odivelas',
			'Oeiras',
			'Sintra',
			'Sobral de Monte Agraço',
			'Torres Vedras',
			'Vila Franca de Xira'
		]
	},
	{
		distrito: 'Portalegre',
		concelhos: [
			'Alter do Chão',
			'Arronches',
			'Avis',
			'Campo Maior',
			'Castelo de Vide',
			'Crato',
			'Elvas',
			'Fronteira',
			'Gavião',
			'Marvão',
			'Monforte',
			'Nisa',
			'Ponte de Sor',
			'Portalegre',
			'Sousel'
		]
	},
	{
		distrito: 'Porto',
		concelhos: [
			'Amarante',
			'Baião',
			'Felgueiras',
			'Gondomar',
			'Lousada',
			'Maia',
			'Marco de Canaveses',
			'Matosinhos',
			'Paços de Ferreira',
			'Paredes',
			'Penafiel',
			'Porto',
			'Póvoa de Varzim',
			'Santo Tirso',
			'Trofa',
			'Valongo',
			'Vila do Conde',
			'Vila Nova de Gaia'
		]
	},
	{
		distrito: 'Santarém',
		concelhos: [
			'Abrantes',
			'Alcanena',
			'Almeirim',
			'Alpiarça',
			'Benavente',
			'Cartaxo',
			'Chamusca',
			'Constância',
			'Coruche',
			'Entroncamento',
			'Ferreira do Zêzere',
			'Golegã',
			'Mação',
			'Ourém',
			'Rio Maior',
			'Salvaterra de Magos',
			'Santarém',
			'Sardoal',
			'Tomar',
			'Torres Novas',
			'Vila Nova da Barquinha'
		]
	},
	{
		distrito: 'Setúbal',
		concelhos: [
			'Alcácer do Sal',
			'Alcochete',
			'Almada',
			'Barreiro',
			'Grândola',
			'Moita',
			'Montijo',
			'Palmela',
			'Santiago do Cacém',
			'Seixal',
			'Sesimbra',
			'Setúbal',
			'Sines'
		]
	},
	{
		distrito: 'Viana do Castelo',
		concelhos: [
			'Arcos de Valdevez',
			'Caminha',
			'Melgaço',
			'Monção',
			'Paredes de Coura',
			'Ponte da Barca',
			'Ponte de Lima',
			'Valença',
			'Viana do Castelo',
			'Vila Nova de Cerveira'
		]
	},
	{
		distrito: 'Vila Real',
		concelhos: [
			'Alijó',
			'Boticas',
			'Chaves',
			'Mesão Frio',
			'Mondim de Basto',
			'Montalegre',
			'Murça',
			'Peso da Régua',
			'Ribeira de Pena',
			'Sabrosa',
			'Santa Marta de Penaguião',
			'Valpaços',
			'Vila Pouca de Aguiar',
			'Vila Real'
		]
	},
	{
		distrito: 'Viseu',
		concelhos: [
			'Armamar',
			'Carregal do Sal',
			'Castro Daire',
			'Cinfães',
			'Lamego',
			'Mangualde',
			'Moimenta da Beira',
			'Mortágua',
			'Nelas',
			'Oliveira de Frades',
			'Penalva do Castelo',
			'Penedono',
			'Resende',
			'Santa Comba Dão',
			'São João da Pesqueira',
			'São Pedro do Sul',
			'Sátão',
			'Sernancelhe',
			'Tabuaço',
			'Tarouca',
			'Tondela',
			'Vila Nova de Paiva',
			'Viseu',
			'Vouzela'
		]
	}
];

/**
 * Flat list of all municipalities with their district information
 */
export const ALL_MUNICIPALITIES: Municipality[] = PORTUGAL_DISTRITOS.flatMap((d) =>
	d.concelhos.map((c) => ({ concelho: c, distrito: d.distrito }))
);

/**
 * Find a municipality by exact name match (case-insensitive)
 * @param name The municipality name to search for
 * @returns The municipality if found, undefined otherwise
 */
export function findMunicipality(name: string): Municipality | undefined {
	const normalized = name.toLowerCase().trim();
	return ALL_MUNICIPALITIES.find((m) => m.concelho.toLowerCase() === normalized);
}

/**
 * Search municipalities by partial name match (case-insensitive)
 * @param query The search query
 * @param limit Maximum number of results to return (default: 10)
 * @returns Array of matching municipalities
 */
export function searchMunicipalities(query: string, limit = 10): Municipality[] {
	if (!query.trim()) return [];
	const normalized = query.toLowerCase().trim();
	return ALL_MUNICIPALITIES.filter((m) => m.concelho.toLowerCase().includes(normalized)).slice(
		0,
		limit
	);
}

/**
 * Get all municipalities for a specific district
 * @param distrito The district name
 * @returns Array of municipality names, or empty array if district not found
 */
export function getMunicipalitiesByDistrito(distrito: string): string[] {
	const normalizedDistrito = distrito.toLowerCase().trim();
	const group = PORTUGAL_DISTRITOS.find((d) => d.distrito.toLowerCase() === normalizedDistrito);
	return group?.concelhos ?? [];
}

/**
 * Get the district for a municipality
 * @param concelho The municipality name
 * @returns The district name, or undefined if not found
 */
export function getDistritoForMunicipality(concelho: string): string | undefined {
	const municipality = findMunicipality(concelho);
	return municipality?.distrito;
}
