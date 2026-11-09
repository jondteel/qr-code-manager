// Fictional PostgreSQL test worker; no credentials/capabilities in stdout.
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { config } from '../../server/utils/recovery-crypto.mjs'
import { recoveryLedger } from '../../server/utils/recovery-ledger.mjs'
const p=JSON.parse(readFileSync(0,'utf8'))
if(p.url!=='postgresql://c12_owner@127.0.0.1:59513/c12_01a19a2c?connection_limit=1')process.exit(1)
if(!p.dataDir?.endsWith("/01a19a2c-af12-7360-84e1-df95fda70bea/pg17-c12"))process.exit(1)
const c=config({environment:'isolated-fixture',project:'pg17-fictional',activeKeyId:'k1',keys:new Map([['k1',Buffer.from(p.key,'base64')]]),recipientKey:Buffer.from(p.recipientKey,'base64')})
const db=new PrismaClient({datasources:{db:{url:p.url}},log:[]})
const identity=(await db.$queryRaw`SELECT current_setting('data_directory') AS dir, system_identifier::text AS id FROM pg_control_system()`)[0]
if(identity.dir.replaceAll('\\','/')!==p.dataDir||identity.id!==p.systemId)process.exit(1)
const ledger=recoveryLedger(db,c)
const claimed=!!await ledger.claim(p.capability),reserved=!!await ledger.reserve(p.recipient)
process.stdout.write(JSON.stringify({claimed,reserved}))
// Exit without settling: simulates worker termination after acknowledged commit.
process.exit(0)
