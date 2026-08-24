'use strict';

const APIs = {
  xteam: 'https://api.xteam.xyz',
  dzx: 'https://api.dhamzxploit.my.id',
  lol: 'https://api.lolhuman.xyz',
  violetics: 'https://violetics.pw',
  neoxr: 'https://api.neoxr.my.id',
  zenzapis: 'https://zenzapis.xyz',
  akuari: 'https://api.akuari.my.id',
  akuari2: 'https://apimu.my.id',
  nrtm: 'https://fg-nrtm.ddns.net',
  bg: 'http://bochil.ddns.net',
  fgmods: 'https://api-fgmods.ddns.net',
};

const APIKeys = {
  [APIs.xteam]: process.env.XTEAM_API_KEY || '',
  [APIs.lol]: process.env.LOLHUMAN_API_KEY || '',
  [APIs.neoxr]: process.env.NEOXR_API_KEY || '',
  [APIs.violetics]: process.env.VIOLETICS_API_KEY || '',
  [APIs.zenzapis]: process.env.ZENZ_API_KEY || '',
  [APIs.fgmods]: process.env.FGMODS_API_KEY || '',
};

global.APIs = APIs;
global.APIKeys = APIKeys;

module.exports = { WARN_COUNT: 3, APIs, APIKeys };
