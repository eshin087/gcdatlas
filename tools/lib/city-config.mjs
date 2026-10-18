// The cities (five in 0.13.0, six more in 0.19.0): where their layers are, which photos, which airports. Facts and framings are in city-facts.mjs.
//   la, lo      the city's centre point (the origin of the roads' and lines' coordinates, and where the city's sun, clock and weather are taken)
//   drive       the side the cars drive on
//   photo       the aerial photo source for the 12.8 km and finer layers ('s2' where there is no open aerial photo)
//   layers      square layers (size in m, px) in the launch sites' format; r51 is always Sentinel-2 (matched in colour to the photos)
//   airports    IATA code, the size of the airport's own layer (m, 1,024 px) and an optional centre when the OpenStreetMap one is off
export const CITIES = [
  { key:'newyork', name:'New York', la:40.7580, lo:-73.9855, drive:'right', photo:['fpacny', 'fpac'], nyc:true,
    layers:[
      { id:'r51', name:'The region', la:40.72, lo:-73.98, size:51200, px:1024, bld:false },
      { id:'r12', name:'Manhattan and the harbour', la:40.745, lo:-73.985, size:12800, px:1536, bld:true },
      { id:'midtown', name:'Midtown', la:40.752, lo:-73.982, size:3200, px:2048, bld:true },
      { id:'fidi', name:'Lower Manhattan', la:40.711, lo:-74.010, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'JFK', size:6400 }, { iata:'LGA', size:3200 }, { iata:'EWR', size:5120 } ] },
  { key:'tokyo', name:'Tokyo', la:35.6812, lo:139.7671, drive:'left', photo:'gsi', bldKm:1.6, seaSkip:/Disney|Splash Mountain|Jungle Cruise|Gondola|Mark Twain|Canoe|Lost River|Mediterranean Harbor|American Waterfront|Venetian|Beaver Brothers|Port Discovery|Explorer/i,   // (the boats and landings of the theme parks)
 thin:[{ la:35.65855, lo:139.74543, r:90 }, { la:35.71007, lo:139.81071, r:110 }],   // (Tokyo Tower and Tokyo Skytree)

    layers:[
      { id:'r51', name:'The region', la:35.64, lo:139.76, size:51200, px:1024, bld:false },
      { id:'r12', name:'Central Tokyo', la:35.67, lo:139.76, size:12800, px:1536, bld:true },
      { id:'chiyoda', name:'Chiyoda and Marunouchi', la:35.6745, lo:139.758, size:3200, px:2048, bld:true },
      { id:'shinjuku', name:'Shinjuku', la:35.690, lo:139.700, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'HND', size:6400 }, { iata:'NRT', size:6400 } ] },
  { key:'dubai', name:'Dubai', la:25.1972, lo:55.2744, drive:'right', photo:'s2',
    layers:[
      { id:'r51', name:'The region', la:25.08, lo:55.18, size:51200, px:1024, bld:false },
      { id:'r12', name:'Dubai', la:25.17, lo:55.24, size:12800, px:1536, bld:true },
      { id:'downtown', name:'Downtown Dubai', la:25.1972, lo:55.2744, size:3200, px:2048, bld:true },
      { id:'marina', name:'Dubai Marina and the Palm', la:25.100, lo:55.140, size:6400, px:1536, bld:true } ],
    airports:[ { iata:'DXB', size:6400 }, { iata:'DWC', size:6400 } ] },
  { key:'london', name:'London', la:51.5074, lo:-0.1278, drive:'left', photo:'s2',
    layers:[
      { id:'r51', name:'The region', la:51.50, lo:-0.15, size:51200, px:1024, bld:false },
      { id:'r12', name:'Central London', la:51.51, lo:-0.09, size:12800, px:1536, bld:true },
      { id:'centre', name:'Westminster and the City', la:51.508, lo:-0.1005, size:6400, px:2048, bld:true },
      { id:'canary', name:'Canary Wharf', la:51.505, lo:-0.022, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'LHR', size:8000 }, { iata:'LGW', size:4800 }, { iata:'LCY', size:3200 }, { iata:'STN', size:4800 }, { iata:'LTN', size:3200 } ] },
  { key:'paris', name:'Paris', la:48.8566, lo:2.3522, drive:'right', photo:'ign', bdtopo:true, thin:[{ la:48.8583, lo:2.2945, r:100 }],   // (the Eiffel Tower: BD TOPO has it as a solid block 286 m tall)

    layers:[
      { id:'r51', name:'The region', la:48.86, lo:2.35, size:51200, px:1024, bld:false },
      { id:'r12', name:'Paris', la:48.865, lo:2.31, size:12800, px:1536, bld:true },
      { id:'cite', name:'Île de la Cité and the Louvre', la:48.8566, lo:2.34, size:3200, px:2048, bld:true },
      { id:'eiffel', name:'The Eiffel Tower', la:48.8584, lo:2.2945, size:3200, px:1536, bld:true },
      { id:'defense', name:'La Défense', la:48.892, lo:2.238, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'CDG', size:9600 }, { iata:'ORY', size:6400 } ] },
  // ---- 0.19.0 (owner's picks, 2026-10-07: Hong Kong, San Francisco, Sydney, Rome, Los Angeles, Rio de Janeiro). thin: buildings left out of the
  // heights because the page draws them as models (the Golden Gate Bridge's towers, the Opera House, the Colosseum, St Peter's)
  { key:'hongkong', name:'Hong Kong', la:22.2855, lo:114.1577, drive:'left', photo:'s2',
    layers:[
      { id:'r51', name:'The region', la:22.33, lo:114.10, size:51200, px:1024, bld:false },
      { id:'r12', name:'Victoria Harbour', la:22.29, lo:114.17, size:12800, px:1536, bld:true },
      { id:'central', name:'Central and Admiralty', la:22.281, lo:114.162, size:3200, px:2048, bld:true },
      { id:'tst', name:'Tsim Sha Tsui', la:22.298, lo:114.172, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'HKG', size:6400 } ] },
  { key:'sanfrancisco', name:'San Francisco', la:37.7915, lo:-122.3990, drive:'right', photo:'fpac',
    thin:[{ la:37.8108, lo:-122.4770, r:80 }, { la:37.8266, lo:-122.4795, r:80 }],
    layers:[
      { id:'r51', name:'The Bay', la:37.76, lo:-122.36, size:51200, px:1024, bld:false },
      { id:'r12', name:'San Francisco', la:37.785, lo:-122.435, size:12800, px:1536, bld:true },
      { id:'downtown', name:'Downtown', la:37.792, lo:-122.400, size:3200, px:2048, bld:true },
      { id:'goldengate', name:'The Golden Gate', la:37.815, lo:-122.475, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'SFO', size:6400 }, { iata:'OAK', size:4800 } ] },
  { key:'sydney', name:'Sydney', la:-33.8610, lo:151.2108, drive:'left', photo:'nsw',
    thin:[{ la:-33.8568, lo:151.2153, r:130 }],
    layers:[
      { id:'r51', name:'The region', la:-33.86, lo:151.17, size:51200, px:1024, bld:false },
      { id:'r12', name:'Sydney Harbour', la:-33.862, lo:151.215, size:12800, px:1536, bld:true },
      { id:'cbd', name:'The Rocks and the city centre', la:-33.864, lo:151.210, size:3200, px:2048, bld:true } ],
    airports:[ { iata:'SYD', size:6400 } ] },
  { key:'rome', name:'Rome', la:41.8961, lo:12.4823, drive:'right', photo:'s2',
    thin:[{ la:41.8902, lo:12.4922, r:115 }, { la:41.9022, lo:12.4539, r:125 }],
    layers:[
      { id:'r51', name:'The region', la:41.86, lo:12.42, size:51200, px:1024, bld:false },
      { id:'r12', name:'Rome', la:41.895, lo:12.475, size:12800, px:1536, bld:true },
      { id:'centro', name:'The historic centre and the Colosseum', la:41.896, lo:12.482, size:3200, px:2048, bld:true },
      { id:'vatican', name:'Vatican City', la:41.9022, lo:12.4539, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'FCO', size:6400 }, { iata:'CIA', size:3200 } ] },
  { key:'losangeles', name:'Los Angeles', la:34.0522, lo:-118.2437, drive:'right', photo:'fpac',
    layers:[
      { id:'r51', name:'The basin', la:34.02, lo:-118.33, size:51200, px:1024, bld:false },
      { id:'r12', name:'Downtown to Hollywood', la:34.085, lo:-118.29, size:12800, px:1536, bld:true },
      { id:'downtown', name:'Downtown', la:34.050, lo:-118.255, size:3200, px:2048, bld:true },
      { id:'hollywood', name:'Hollywood and the sign', la:34.125, lo:-118.325, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'LAX', size:6400 }, { iata:'BUR', size:3200 } ] },
  // (peaks: Corcovado's summit, 704 m under Christ the Redeemer, which the terrain tiles round down to about 520 m: city-terrain-fix.mjs)
  { key:'rio', name:'Rio de Janeiro', la:-22.935, lo:-43.180, drive:'right', photo:'s2', peaks:[{ la:-22.95192, lo:-43.21049, h:704, r:170 }],
    layers:[
      { id:'r51', name:'The region', la:-22.90, lo:-43.25, size:51200, px:1024, bld:false },
      { id:'r12', name:'The bay and the beaches', la:-22.935, lo:-43.190, size:12800, px:1536, bld:true },
      { id:'zonasul', name:'Copacabana, Botafogo and Sugarloaf', la:-22.958, lo:-43.178, size:3200, px:2048, bld:true },
      { id:'corcovado', name:'Corcovado', la:-22.952, lo:-43.211, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'GIG', size:6400 }, { iata:'SDU', size:3200 } ] },
  // ---- 0.22.0 (owner, 2026-10-17: Las Vegas "how it is present day"). The finer layers' photos are USDA NAIP of May 2024; the two sites that
  // changed since (the Tropicana, imploded in October 2024, now the Athletics' ballpark; the Mirage, closed in July 2024, now Hard Rock with its
  // guitar tower) take Sentinel-2's newest colours (`recent`). thin: buildings the page draws as models (the Sphere, the High Roller, the Luxor
  // pyramid, Paris Las Vegas's Eiffel Tower, the STRAT's tower)
  { key:'lasvegas', name:'Las Vegas', la:36.1155, lo:-115.1722, drive:'right', photo:'fpac',
    // (OpenStreetMap: the Sphere, the Luxor's pyramid, the STRAT's tower; the guitar tower and the ballpark are mapped as building=construction, which the heights leave out)
    thin:[{ id:'w976405284' }, { id:'w27858544' }, { id:'w135457469' }],
    // (the Tropicana's site, now the ballpark (OpenStreetMap's outline, 224 m across), and the Mirage's volcano, now the guitar tower)
    recent:[{ la:36.09927, lo:-115.16998, r:190 }, { la:36.12114, lo:-115.17299, r:85 }],
    layers:[
      { id:'r51', name:'The valley', la:36.13, lo:-115.17, size:51200, px:1024, bld:false },
      { id:'r12', name:'The Strip and Downtown', la:36.130, lo:-115.165, size:12800, px:1536, bld:true },
      { id:'south', name:'The south Strip', la:36.0975, lo:-115.1745, size:3200, px:2048, bld:true },
      { id:'centre', name:'The centre Strip and the Sphere', la:36.1170, lo:-115.1690, size:3200, px:2048, bld:true },
      { id:'north', name:'The north Strip and the STRAT', la:36.1420, lo:-115.1600, size:3200, px:1536, bld:true },
      { id:'downtown', name:'Downtown and Fremont Street', la:36.1700, lo:-115.1440, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'LAS', size:6400 } ] },
];
// airports' known elevations, to check OpenStreetMap's (m above sea level; official figures, aeronautical charts): JFK 4, LGA 6, EWR 5, HND 6, NRT 43, DXB 19, DWC 33, LHR 25, LGW 62, LCY 6, STN 106, LTN 160, CDG 119, ORY 89
// (0.19.0: HKG 9, SFO 4, OAK 3, SYD 6, FCO 4, CIA 129, LAX 38, BUR 236, GIG 9, SDU 3; 0.22.0: LAS 665, 2,181 ft)
export const ELE_CHECK = { JFK:4, LGA:6, EWR:5, HND:6, NRT:43, DXB:19, DWC:33, LHR:25, LGW:62, LCY:6, STN:106, LTN:160, CDG:119, ORY:89,
  HKG:9, SFO:4, OAK:3, SYD:6, FCO:4, CIA:129, LAX:38, BUR:236, GIG:9, SDU:3, LAS:665 };
