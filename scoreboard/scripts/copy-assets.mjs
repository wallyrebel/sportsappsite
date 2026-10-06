import {cp,mkdir} from 'node:fs/promises';
const to=new URL('../../public/scoreboard/',import.meta.url);
// Resolve repository public/ from scoreboard/scripts/.
const destination=new URL('../../../public/scoreboard/',import.meta.url);
await mkdir(destination,{recursive:true});await cp(new URL('../public/',new URL('../',import.meta.url)),destination,{recursive:true});
