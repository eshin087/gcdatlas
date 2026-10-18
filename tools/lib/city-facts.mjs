// What a visitor reads about the cities, and the corrections to the tower lists. House style: short, concrete, true sentences; no em dashes; numbers with units.
// Every number has its source in a comment next to it.

export const SOURCES = {
  osm:{ what:'Roads, buildings, water, airports, ferries, ports, tall buildings', credit:'© OpenStreetMap contributors (ODbL)', url:'https://www.openstreetmap.org/copyright', licence:'ODbL 1.0' },
  s2:{ what:'Satellite colour (the 51 km layers everywhere; London and Dubai down to the finest)', credit:'Contains modified Copernicus Sentinel data 2025 and 2026', url:'https://sentinel.esa.int', licence:'Copernicus Sentinel data terms (free, full and open, with credit)' },
  fpac:{ what:'US aerial photos (New York, San Francisco, Los Angeles)', credit:'USDA NAIP aerial photos (2022 to 2025)', url:'https://naip-usdaonline.hub.arcgis.com', licence:'public domain (US government work)' },
  nyc:{ what:'New York building footprints and heights', credit:'NYC Open Data, Building Footprints (NYC Office of Technology and Innovation)', url:'https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue', licence:'NYC Open Data terms of use (free to use)' },
  gsi:{ what:'Tokyo aerial photos', credit:'Aerial photos: GSI Japan (国土地理院), seamless photographs, edited', url:'https://maps.gsi.go.jp/development/ichiran.html', licence:'GSI terms of use, Public Data License 1.0 (compatible with CC BY 4.0)' },
  ign:{ what:'Paris aerial photos', credit:'Aerial photos: IGN, BD ORTHO (Licence Ouverte 2.0)', url:'https://geoservices.ign.fr/bdortho', licence:'Licence Ouverte / Open Licence 2.0 (Etalab)' },
  bdtopo:{ what:'Paris building footprints and heights', credit:'IGN, BD TOPO (Licence Ouverte 2.0)', url:'https://geoservices.ign.fr/bdtopo', licence:'Licence Ouverte / Open Licence 2.0 (Etalab)' },
  terrain:{ what:'Ground height', credit:'Terrain: Mapzen Terrain Tiles on AWS (SRTM, USGS 3DEP and others)', url:'https://registry.opendata.aws/terrain-tiles/', licence:'free with credit' },
  meteo:{ what:'Each city\'s weather (through /api/weather)', credit:'Weather data by Open-Meteo.com', url:'https://open-meteo.com', licence:'CC BY 4.0' },
  population:{ what:'Population', credit:'US Census Bureau 2020; Statistics Bureau of Japan, Tokyo Metropolitan Government 2020 census; Dubai Statistics Center; ONS Census 2021; INSEE; Census and Statistics Department (Hong Kong); ABS Census 2021; ISTAT; IBGE Census 2022', licence:'official statistics' },
  nsw:{ what:'Sydney aerial photos', credit:'Aerial photos: NSW Imagery, © State of New South Wales and Spatial Services (CC BY)', url:'https://www.spatial.nsw.gov.au/products_and_services/web_services', licence:'Creative Commons Attribution (the dataset listings say 3.0, the copyright page 4.0)' },
};

// framings: look [la, lo, height m above the sea], az degrees from north the camera looks toward, tilt degrees down from the horizon, dist metres from the look point
export const FACTS = {
  newyork:{
    country:'United States', tz:'America/New_York',
    // 2020 United States Census, 1 April 2020: 8,804,190 (the city, five boroughs)
    population:{ n:8804190, year:2020, of:'the city', source:'2020 United States Census' },
    facts:['About 8.8 million people live in New York City.', 'Manhattan is 21.6 km long and at most 3.7 km wide.'],
    aka:'new york nyc new york city manhattan brooklyn queens bronx staten island big apple',
    views:[
      { look:[40.7415, -73.995, 120], az:25, tilt:9, dist:13000, why:'the skyline from the harbour' },
      { look:[40.7527, -73.9772, 200], az:300, tilt:16, dist:1100, why:'among the Midtown towers' },
      { look:[40.7127, -74.0134, 250], az:350, tilt:20, dist:1300, why:'One World Trade Center and Lower Manhattan' } ],
  },
  tokyo:{
    country:'Japan', tz:'Asia/Tokyo',
    // 2020 census (1 October 2020), Tokyo Metropolis: 14,047,594
    population:{ n:14047594, year:2020, of:'Tokyo Metropolis', source:'2020 census of Japan' },
    facts:['About 14 million people live in the Tokyo Metropolis.', 'Tokyo Skytree is 634 m tall, the tallest tower in Japan.'],
    aka:'tokyo tokio edo shinjuku shibuya chiyoda ginza marunouchi skytree',
    views:[
      { look:[35.672, 139.76, 60], az:20, tilt:12, dist:9500, why:'central Tokyo from the bay' },
      { look:[35.6896, 139.6921, 150], az:60, tilt:18, dist:1300, why:'the Shinjuku towers' },
      { look:[35.6812, 139.7671, 60], az:320, tilt:22, dist:1000, why:'Tokyo Station and the palace grounds' } ],
  },
  dubai:{
    country:'United Arab Emirates', tz:'Asia/Dubai',
    // Dubai Statistics Center, 2025 (as recorded on Wikidata): 3,944,751 in the emirate
    population:{ n:3944751, year:2025, of:'the emirate', source:'Dubai Statistics Center' },
    facts:['Burj Khalifa is 828 m tall and has been the tallest building in the world since 2009.', 'About 3.9 million people live in Dubai.'],
    aka:'dubai uae emirates burj khalifa marina palm jumeirah downtown',
    views:[
      { look:[25.16, 55.215, 150], az:130, tilt:13, dist:12000, why:'the coast from the Gulf' },
      { look:[25.1972, 55.2744, 400], az:320, tilt:10, dist:1500, why:'Burj Khalifa' },
      { look:[25.0875, 55.1465, 150], az:335, tilt:14, dist:1200, why:'the Marina towers' } ],
  },
  london:{
    country:'United Kingdom', tz:'Europe/London',
    // Census 2021 (21 March 2021), Greater London: 8,799,728 (ONS)
    population:{ n:8799728, year:2021, of:'Greater London', source:'ONS, Census 2021' },
    facts:['About 8.8 million people live in Greater London.', 'The City of London, its old centre, covers only 2.9 km2.'],
    aka:'london england uk britain thames westminster canary wharf shard city of london big ben',
    views:[
      { look:[51.505, -0.09, 80], az:330, tilt:11, dist:9000, why:'central London from the south-east' },
      { look:[51.5045, -0.0865, 150], az:345, tilt:20, dist:800, why:'the Shard and the City' },
      { look:[51.5049, -0.0195, 130], az:260, tilt:15, dist:1200, why:'Canary Wharf' } ],
  },
  paris:{
    country:'France', tz:'Europe/Paris',
    // INSEE legal population of the commune of Paris, 1 January 2023: 2,103,778; area 105.4 km2
    population:{ n:2103778, year:2023, of:'the city', source:'INSEE' },
    facts:['About 2.1 million people live in Paris, in only 105 km2.', 'The Eiffel Tower is 330 m tall and was the tallest structure in the world from 1889 to 1930.'],
    aka:'paris france seine eiffel louvre notre dame la defense',
    views:[
      { look:[48.857, 2.33, 60], az:300, tilt:9, dist:9000, why:'Paris and the Seine' },
      { look:[48.8584, 2.2945, 120], az:35, tilt:12, dist:800, why:'the Eiffel Tower and the Champ de Mars' },
      { look:[48.8905, 2.2405, 120], az:95, tilt:14, dist:1100, why:'the towers of La Défense' } ],
  },
  // ---- 0.19.0
  hongkong:{
    country:'China', tz:'Asia/Hong_Kong',
    // Census and Statistics Department, mid-2024: about 7.5 million
    population:{ n:7500000, year:2024, of:'Hong Kong', source:'Census and Statistics Department, mid-2024' },
    // International Commerce Centre 484 m (CTBUH); Victoria Peak 552 m (Lands Department)
    facts:['About 7.5 million people live in Hong Kong.', 'Its tallest building, the International Commerce Centre, is 484 m tall, and Victoria Peak rises 552 m above the harbour.'],
    aka:'hong kong hk victoria harbour kowloon central tsim sha tsui wan chai the peak victoria peak',
    views:[
      { look:[22.288, 114.165, 100], az:190, tilt:8, dist:9000, why:'the skyline across Victoria Harbour' },
      { look:[22.2825, 114.159, 200], az:160, tilt:14, dist:1500, why:'the towers of Central' },
      { look:[22.290, 114.168, 100], az:10, tilt:18, dist:3200, why:'the harbour from above the Peak' } ],
  },
  sanfrancisco:{
    country:'United States', tz:'America/Los_Angeles',
    // 2020 United States Census: 873,965
    population:{ n:873965, year:2020, of:'the city', source:'2020 United States Census' },
    // Golden Gate Bridge, opened 27 May 1937, main span 1,280 m (Golden Gate Bridge, Highway and Transportation District)
    facts:['About 870,000 people live in San Francisco.', 'The Golden Gate Bridge opened in 1937; its main span is 1,280 m long.'],
    aka:'san francisco sf frisco golden gate golden gate bridge bay area alcatraz',
    views:[
      { look:[37.795, -122.42, 80], az:240, tilt:8, dist:9000, why:'the city from the bay' },
      { look:[37.8199, -122.4783, 120], az:160, tilt:9, dist:2600, why:'the Golden Gate Bridge' },
      { look:[37.7915, -122.399, 150], az:300, tilt:14, dist:1300, why:'Salesforce Tower and downtown' } ],
  },
  sydney:{
    country:'Australia', tz:'Australia/Sydney',
    // ABS Census 2021, Greater Sydney (GCCSA): 5,231,147
    population:{ n:5231147, year:2021, of:'Greater Sydney', source:'ABS Census 2021' },
    // Sydney Opera House opened 20 October 1973; Sydney Harbour Bridge opened 1932, arch 134 m above the water (Transport for NSW)
    facts:['About 5.2 million people live in Greater Sydney.', 'The Opera House opened in 1973; the Harbour Bridge, opened in 1932, rises 134 m above the water.'],
    aka:'sydney harbour opera house harbour bridge circular quay the rocks bondi',
    views:[
      { look:[-33.858, 151.212, 60], az:225, tilt:9, dist:8000, why:'Sydney Harbour' },
      { look:[-33.8568, 151.2153, 40], az:290, tilt:10, dist:1200, why:'the Opera House and the Harbour Bridge' },
      { look:[-33.8523, 151.2108, 80], az:170, tilt:10, dist:1500, why:'the Harbour Bridge and the city' } ],
  },
  rome:{
    country:'Italy', tz:'Europe/Rome',
    // ISTAT: about 2.75 million (Roma Capitale)
    population:{ n:2750000, year:2024, of:'the city', source:'ISTAT' },
    // Colosseum finished AD 80, about 50,000 spectators; St Peter's dome 136.6 m to the top of the cross
    facts:['About 2.75 million people live in Rome.', 'The Colosseum, finished in AD 80, held about 50,000 people; the dome of St Peter\'s rises 136.6 m to the top of its cross.'],
    aka:'rome roma colosseum colosseo vatican st peters pantheon trevi forum',
    views:[
      { look:[41.896, 12.475, 40], az:90, tilt:10, dist:7000, why:'Rome from above the Tiber' },
      { look:[41.8902, 12.4922, 30], az:60, tilt:18, dist:700, why:'the Colosseum' },
      { look:[41.9022, 12.4539, 80], az:270, tilt:10, dist:1200, why:'St Peter\'s Basilica' } ],
  },
  losangeles:{
    country:'United States', tz:'America/Los_Angeles',
    // 2020 United States Census: 3,898,747
    population:{ n:3898747, year:2020, of:'the city', source:'2020 United States Census' },
    // Hollywood sign: letters 13.7 m (45 ft) tall, first put up in 1923 (Hollywood Sign Trust)
    facts:['About 3.9 million people live in the city of Los Angeles.', 'Each letter of the Hollywood sign is 13.7 m tall; the sign went up in 1923.'],
    aka:'los angeles la hollywood hollywood sign downtown santa monica beverly hills griffith',
    views:[
      { look:[34.05, -118.25, 100], az:135, tilt:9, dist:9000, why:'Downtown from the hills' },
      { look:[34.1341, -118.32165, 488], az:355, tilt:12, dist:170, why:'the Hollywood sign' },
      { look:[34.0505, -118.2552, 150], az:50, tilt:14, dist:1300, why:'the towers of Downtown' } ],
  },
  rio:{
    country:'Brazil', tz:'America/Sao_Paulo',
    // IBGE Census 2022: about 6.21 million
    population:{ n:6211000, year:2022, of:'the city', source:'IBGE Census 2022' },
    // Christ the Redeemer, finished 1931, 30 m on an 8 m pedestal, on Corcovado (710 m); Sugarloaf Mountain 396 m
    facts:['About 6.2 million people live in Rio de Janeiro.', 'Christ the Redeemer, finished in 1931, stands 30 m tall on Corcovado; Sugarloaf Mountain rises 396 m from the bay.'],
    aka:'rio de janeiro rio copacabana ipanema sugarloaf pao de acucar corcovado christ the redeemer cristo redentor',
    views:[
      { look:[-22.94, -43.19, 100], az:315, tilt:8, dist:9000, why:'the bay and the mountains' },
      { look:[-22.9519, -43.2105, 720], az:250, tilt:6, dist:600, why:'Christ the Redeemer' },
      { look:[-22.9492, -43.1545, 250], az:135, tilt:8, dist:2500, why:'Sugarloaf Mountain' } ],
  },
  lasvegas:{
    country:'United States', tz:'America/Los_Angeles',
    // 2020 United States Census: 641,903 (the city). The Strip runs through Paradise, an unincorporated town of Clark County, not the city
    population:{ n:641903, year:2020, of:'the city', source:'2020 United States Census' },
    // Sphere: 112 m (366 ft) high, 157 m (516 ft) wide, 54,000 m2 of LED on its outside, about 1.2 million LED pucks 20 cm (8 in) apart; opened 29 September 2023 (Sphere Entertainment; Wikipedia)
    facts:['About 640,000 people live in the city of Las Vegas. Most of the Strip lies outside it, in the town of Paradise.', 'The Sphere is 112 m tall and 157 m across, its outside covered in about 1.2 million LED pucks.'],
    aka:'las vegas vegas sin city the strip las vegas strip las vegas boulevard paradise nevada sphere fremont street',
    views:[
      { look:[36.112, -115.172, 640], az:0, tilt:9, dist:6500, why:'the Strip from the south' },
      { look:[36.1208, -115.1621, 670], az:262, tilt:7, dist:480, why:'the Sphere' },
      { look:[36.1130, -115.1728, 650], az:65, tilt:26, dist:950, why:'the Bellagio fountains, Paris and the High Roller' } ],
  },
};


// Corrections to OpenStreetMap's tower heights and names where they are known to differ from the official ones (Wikipedia, the building's own page, the Council on Tall
// Buildings and Urban Habitat); { re: matches the OSM (English) name, h, name, kind, thin, la, lo, src }. The OpenStreetMap height is kept for every tower not listed here.
export const TOWER_FIX = {
  lasvegas:[
    { re:/^Stratosphere Tower$/, name:'The STRAT', src:'OpenStreetMap (350 m, 1,149 ft: the Wikipedia figure; named Stratosphere Tower there, the STRAT since 2020)' },
    { re:/^Trump International Hotel Las Vegas$/, h:190, src:'Wikidata and Wikipedia (622 ft; OpenStreetMap has 224 m)' } ],
  newyork:[
    { re:/^One World Trade Center$/, kind:'building', src:'OpenStreetMap (541 m with the spire, 1,776 ft: the Wikipedia figure)' },
    { re:/^3 World Trade Center$/, h:329, src:'Wikipedia (OpenStreetMap has 352 m)' },
    { re:/^30 Hudson Yards$/, h:390, src:'Wikipedia (1,270 ft; OpenStreetMap has 395 m)' },
    { re:/^100 United Nations Plaza Tower$/, name:'Trump World Tower', h:262, src:'Wikipedia (861 ft; OpenStreetMap names this building 100 United Nations Plaza Tower)' },
    { re:/^599 Lexington Avenue$/, h:199, src:'Wikipedia (OpenStreetMap has 217 m)' },
    { re:/^14 Wall Street$/, h:164, src:'Wikipedia (OpenStreetMap has 199 m)' },
    { re:/^15 William$/, h:161, src:'Wikipedia (OpenStreetMap has 226 m)' } ],
  tokyo:[],
  dubai:[
    { re:/^Ain Dubai$/, h:250, src:'Wikipedia (OpenStreetMap has 210 m)' },
    { re:/^Marina 101$/, h:425, src:'Wikipedia (OpenStreetMap has 432 m)' } ],
  london:[
    { re:/^Landmark Pinnacle$/, h:233.7, src:'Wikipedia (OpenStreetMap has 263 m)' },
    { re:/^Newfoundland Quay$/, h:220, src:'Wikipedia (OpenStreetMap has 203 m)' },
    { re:/^Sky Garden$/, name:'20 Fenchurch Street', src:'OpenStreetMap (named Sky Garden there)' } ],
  paris:[
    { re:/^Eiffel Tower$/, h:330, thin:true, src:'Wikipedia (330 m since the antenna of 2022)' },
    { re:/^Tour First$/, h:231, src:'Wikipedia (OpenStreetMap has 259 m)' },
    { re:/^Hyatt Regency Paris/, h:137, src:'Wikipedia (OpenStreetMap has 174 m)' } ] };
// Landmarks OpenStreetMap does not tag with a height under the right name or place: { name, la, lo, h, kind, thin, src }
export const TOWER_ADD = {
  newyork:[], tokyo:[], dubai:[], london:[], paris:[] };
// Names to leave out (not towers, not built, a mast on a hotel, or a name and height that do not belong together)
export const TOWER_SKIP = {
  newyork:[ /^Times Square Ball$/, /^2 World Trade Center$/, /^The Torch$/, /^Trinity Commons$/ ],
  tokyo:[], dubai:[],
  london:[ /^Proposed Development/ ],
  lasvegas:[ /^Spartacus Law Firm$/ ],   // (a law firm's name on a 145 m tower with no outline: not the tower's name)
  paris:[ /^Pullman Paris Montparnasse$/, /^Tour Légende$/, /^Tour Hertzienne de Meudon$/ ] };
