import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  fullyParallel:true,
  retries:process.env.CI?1:0,
  reporter:'list',
  use:{baseURL:'http://127.0.0.1:4181',screenshot:'only-on-failure'},
  projects:[
    {name:'desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},
    {name:'mobile',use:{browserName:'chromium',viewport:{width:390,height:844}}},
    {name:'small-phone',use:{browserName:'chromium',viewport:{width:320,height:780}}}
  ],
  webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4181',env:{PORT:'4181'},reuseExistingServer:false}
});
