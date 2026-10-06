import {cp,mkdir} from 'node:fs/promises';
const destination=new URL('../../public/scoreboard/',import.meta.url);
await mkdir(destination,{recursive:true});await cp(new URL('../public/',import.meta.url),destination,{recursive:true});
