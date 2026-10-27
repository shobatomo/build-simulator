import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {hashJson} from '../../../../server/deadlockSnapshot';
import payload from '../../../../data/trialDisplay6819.payload.json';
import provenance from '../../../../data/trialDisplay6819.provenance.json';

// Immutable, locally captured public projection. No remote requests, database,
// environment variables or fallback to an unversioned source on this path.
export function GET(){
  // Keep numeric lexemes inside a string. Importing the object itself lets the
  // build tool reserialize floating-point numbers before integrity validation.
  if(typeof payload!=='string'||createHash('sha256').update(payload).digest('hex')!==provenance.displaySha256)
    return NextResponse.json({code:'INVALID_TRIAL_CATALOG'},{status:503});
  const data=JSON.parse(payload);
  if(data.metadata.clientVersion!==6819||data.metadata.snapshotHash!==provenance.snapshotHash||hashJson(data)!==provenance.displayCanonicalHash)
    return NextResponse.json({code:'INVALID_TRIAL_CATALOG'},{status:503});
  return new NextResponse(payload,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
