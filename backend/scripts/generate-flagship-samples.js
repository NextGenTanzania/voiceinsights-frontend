import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, getFlagshipSampleCatalog } from '../src/flagship-sample-library.js';
const out=resolve(process.argv[2]||'../samples/flagship-reports'); await mkdir(out,{recursive:true});
for(const sample of FLAGSHIP_SAMPLE_REPORTS){const model=buildFlagshipSampleReport(sample.key);await writeFile(join(out,`${sample.key}.json`),JSON.stringify(model,null,2));}
await writeFile(join(out,'catalog.json'),JSON.stringify(getFlagshipSampleCatalog(),null,2));
console.log(`Generated ${FLAGSHIP_SAMPLE_REPORTS.length} governed flagship sample models in ${out}`);
