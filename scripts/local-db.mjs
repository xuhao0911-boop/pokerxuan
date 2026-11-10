import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function database(path=':memory:'){
 const sql=new DatabaseSync(path);sql.exec(fs.readFileSync(new URL('../drizzle/0000_rooms.sql',import.meta.url),'utf8').replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ').replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS '));
 return {prepare(query){let params=[];return {bind(...p){params=p;return this;},async first(){return sql.prepare(query).get(...params)||null;},async run(){const r=sql.prepare(query).run(...params);return {meta:{changes:Number(r.changes)}};}};},close(){sql.close();},sql};
}
