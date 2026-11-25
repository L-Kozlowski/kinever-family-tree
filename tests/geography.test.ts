import test from 'node:test';
import assert from 'node:assert/strict';
import { birthClusters, validLocation } from '../src/mocks/geography.ts';
import type { Person } from '../src/types/index.ts';
const person=(id:string,lat:number,lon:number)=>({id,birthLocation:{lat,lon}} as Person);
test('nearby birthplaces form a counted area and separate at street zoom',()=>{
 const people=[person('a',52.2297,21.0122),person('b',52.2297,21.0122),person('c',52.2307,21.0122),person('d',-33.8688,151.2093),{id:'unknown',birthPlace:'Warszawa'} as Person];
 const world=birthClusters(people,2);assert.equal(world.reduce((sum,c)=>sum+c.people.length,0),4);assert.ok(world.some(c=>c.people.length===3));
 const detail=birthClusters(people,18);assert.ok(detail.length>world.length);assert.ok(detail.some(c=>c.people.length===2));
});
test('unlinked city names and invalid coordinates never contribute to density',()=>{
 assert.equal(validLocation({lat:0,lon:0}),true);assert.equal(validLocation({lat:91,lon:0}),false);assert.equal(validLocation({lat:0,lon:181}),false);assert.equal(validLocation({lat:NaN,lon:0}),false);
 assert.deepEqual(birthClusters([{id:'a',birthPlace:'Kraków'} as Person,person('b',100,20)],3),[]);
});
